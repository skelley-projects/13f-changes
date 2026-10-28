"""A tiny local Flask app for vetting candidate cards one at a time.

Run via ``python -m pdf_flashcards review cards.json``. Each keep/edit/discard
decision is persisted to the project file immediately, so it's safe to close
the browser and resume later.
"""

from __future__ import annotations

import threading

from . import store
from .store import STATUS_DISCARDED, STATUS_KEPT


def create_app(project_path: str):
    try:
        from flask import Flask, jsonify, request
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "Flask is required for the review app. Install it with: pip install Flask"
        ) from exc

    app = Flask(__name__)
    lock = threading.Lock()  # serialise read-modify-write on the JSON file

    def _load():
        return store.load(project_path)

    @app.get("/")
    def index():
        return _PAGE

    @app.get("/api/cards")
    def api_cards():
        project = _load()
        pending = project.pending()
        return jsonify(
            {
                "source": project.source,
                "kept": len(project.kept()),
                "total": len(project.cards),
                "remaining": len(pending),
                "cards": [
                    {
                        "id": c.id,
                        "front": c.front,
                        "back": c.back,
                        "source_excerpt": c.source_excerpt,
                        "chapter": c.chapter,
                        "tags": c.tags,
                        "page_start": c.page_start,
                        "page_end": c.page_end,
                    }
                    for c in pending
                ],
            }
        )

    @app.post("/api/cards/<card_id>")
    def api_update(card_id: str):
        body = request.get_json(force=True) or {}
        action = body.get("action")
        if action not in {"keep", "discard"}:
            return jsonify({"error": "action must be 'keep' or 'discard'"}), 400

        with lock:
            project = _load()
            card = project.get(card_id)
            if card is None:
                return jsonify({"error": "card not found"}), 404
            # Persist any inline edits the reviewer made before deciding.
            if "front" in body:
                card.front = body["front"].strip()
            if "back" in body:
                card.back = body["back"].strip()
            if "tags" in body:
                card.tags = [t.strip() for t in body["tags"] if t.strip()]
            card.status = STATUS_KEPT if action == "keep" else STATUS_DISCARDED
            store.save(project, project_path)

        return jsonify({"ok": True})

    return app


def serve(project_path: str, host: str = "127.0.0.1", port: int = 5001) -> None:
    app = create_app(project_path)
    print(f"\n  Review app running at http://{host}:{port}")
    print("  Shortcuts:  k = keep   d = discard   e = edit   (Esc to stop editing)")
    print("  Press Ctrl+C when you're done.\n")
    app.run(host=host, port=port)


# Single-page UI. Kept inline so the package is self-contained (no template dir).
_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flashcard review</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; background: #f4f4f5;
         color: #18181b; }
  @media (prefers-color-scheme: dark) {
    body { background: #18181b; color: #e4e4e7; }
    .card, header { background: #27272a !important; }
    input, textarea { background: #1f1f23; color: inherit; border-color: #3f3f46; }
    .excerpt { background: #1f1f23 !important; }
  }
  header { background: #fff; padding: 12px 20px; display: flex; gap: 16px;
           align-items: center; border-bottom: 1px solid rgba(127,127,127,.2); }
  .bar { flex: 1; height: 8px; background: rgba(127,127,127,.2); border-radius: 4px;
         overflow: hidden; }
  .bar > div { height: 100%; background: #22c55e; width: 0; transition: width .2s; }
  main { max-width: 720px; margin: 32px auto; padding: 0 16px; }
  .card { background: #fff; border-radius: 12px; padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .chapter { font-size: 13px; text-transform: uppercase; letter-spacing: .04em;
             opacity: .6; margin-bottom: 16px; }
  label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em;
          opacity: .6; display: block; margin: 16px 0 4px; }
  input, textarea { width: 100%; padding: 10px 12px; border: 1px solid #d4d4d8;
                    border-radius: 8px; font: inherit; }
  textarea { resize: vertical; min-height: 70px; }
  .excerpt { background: #f4f4f5; border-left: 3px solid #a1a1aa; padding: 10px 14px;
             border-radius: 0 8px 8px 0; margin-top: 16px; font-size: 14px;
             white-space: pre-wrap; opacity: .85; }
  .actions { display: flex; gap: 12px; margin-top: 24px; }
  button { flex: 1; padding: 14px; border: none; border-radius: 8px; font: inherit;
           font-weight: 600; cursor: pointer; }
  .keep { background: #22c55e; color: #052e16; }
  .discard { background: #ef4444; color: #450a0a; }
  .keep:hover { filter: brightness(1.05); } .discard:hover { filter: brightness(1.05); }
  .hint { opacity: .5; font-size: 13px; text-align: center; margin-top: 16px; }
  .done { text-align: center; padding: 60px 20px; }
  .done h2 { font-size: 28px; }
</style>
</head>
<body>
<header>
  <strong>Flashcard review</strong>
  <div class="bar"><div id="prog"></div></div>
  <span id="counts"></span>
</header>
<main id="app"></main>
<script>
let queue = [], current = null, stats = {kept:0, total:0, remaining:0};

async function load() {
  const r = await fetch('/api/cards');
  const data = await r.json();
  queue = data.cards;
  stats = {kept: data.kept, total: data.total, remaining: data.remaining};
  next();
}

function render() {
  const done = stats.kept, total = stats.total;
  document.getElementById('prog').style.width =
    total ? (100 * (total - queue.length) / total) + '%' : '0%';
  document.getElementById('counts').textContent =
    `${queue.length} left · ${stats.kept} kept`;
  const app = document.getElementById('app');
  if (!current) {
    app.innerHTML = `<div class="done"><h2>All done 🎉</h2>
      <p>${stats.kept} cards kept out of ${stats.total} candidates.</p>
      <p class="hint">Export them with:<br><code>python -m pdf_flashcards export</code></p>
      </div>`;
    return;
  }
  const c = current;
  const pages = c.page_start ? `pp. ${c.page_start}-${c.page_end}` : '';
  app.innerHTML = `
    <div class="card">
      <div class="chapter">${escapeHtml(c.chapter || '')} ${pages}</div>
      <label>Front (question)</label>
      <textarea id="front">${escapeHtml(c.front)}</textarea>
      <label>Back (answer)</label>
      <textarea id="back">${escapeHtml(c.back)}</textarea>
      <label>Tags (comma-separated)</label>
      <input id="tags" value="${escapeHtml((c.tags||[]).join(', '))}">
      ${c.source_excerpt ? `<div class="excerpt">${escapeHtml(c.source_excerpt)}</div>` : ''}
      <div class="actions">
        <button class="discard" onclick="decide('discard')">Discard (d)</button>
        <button class="keep" onclick="decide('keep')">Keep (k)</button>
      </div>
      <p class="hint">k = keep · d = discard · e = edit front</p>
    </div>`;
}

function next() { current = queue.length ? queue[0] : null; render(); }

async function decide(action) {
  if (!current) return;
  const body = {
    action,
    front: document.getElementById('front').value,
    back: document.getElementById('back').value,
    tags: document.getElementById('tags').value.split(',').map(s => s.trim()),
  };
  const id = current.id;
  await fetch('/api/cards/' + id, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  queue.shift();
  if (action === 'keep') stats.kept++;
  next();
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, ch => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'textarea' || tag === 'input';
  if (e.key === 'Escape' && typing) { e.target.blur(); return; }
  if (typing) return;
  if (e.key === 'k') decide('keep');
  else if (e.key === 'd') decide('discard');
  else if (e.key === 'e') { const f = document.getElementById('front'); if (f) f.focus(); }
});

load();
</script>
</body>
</html>
"""
