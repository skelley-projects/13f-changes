// Le Coach — application shell: hash router + views.
// Rendered as HTML strings into #app; one delegated event handler drives
// everything via data-action attributes (works from file:// with no build).
(function () {
  const $app = () => document.getElementById('app');
  const units = () => window.FRENCH.units;
  const esc = U.esc;

  const App = { session: {} };
  window.App = App;

  // ---------- deck helpers ----------

  function cardIdsForUnit(u) {
    return u.vocab.map((_, i) => u.id + ':' + i);
  }

  function vocabForCardId(id) {
    const [uid, idx] = id.split(':');
    const u = units().find((x) => x.id === uid);
    return u ? u.vocab[Number(idx)] : null;
  }

  function dueCards(now, graceMs) {
    const grace = graceMs || 0;
    return Object.entries(Store.state.cards)
      .filter(([, c]) => c.state !== 'new' && c.due <= now + grace)
      .sort((a, b) => a[1].due - b[1].due)
      .map(([id]) => id);
  }

  function newCardBudget() {
    return Math.max(0, (Store.state.settings.newPerDay || 10) - Store.introducedToday());
  }

  function freshCardIds(limit) {
    const out = [];
    const startedUnits = units().filter((u) => Store.state.started[u.id]);
    for (const u of startedUnits) {
      for (const id of cardIdsForUnit(u)) {
        if (out.length >= limit) return out;
        if (!Store.state.cards[id]) out.push(id);
      }
    }
    return out;
  }

  function deckStats(u) {
    const ids = cardIdsForUnit(u);
    const seen = ids.filter((id) => Store.state.cards[id]).length;
    const now = Date.now();
    const due = ids.filter((id) => Store.state.cards[id] && SRS.isDue(Store.state.cards[id], now)).length;
    return { total: ids.length, seen, due };
  }

  function totalDue() {
    return dueCards(Date.now()).length;
  }

  // ---------- chrome ----------

  function nav(active) {
    const due = totalDue();
    const link = (href, label, id) =>
      `<a href="${href}" class="${active === id ? 'active' : ''}">${label}</a>`;
    return `<nav>
      <a href="#/" class="brand">🇫🇷 Le Coach</a>
      <div class="links">
        ${link('#/review', `Réviser${due ? ` <span class="badge">${due}</span>` : ''}`, 'review')}
        ${link('#/reference', 'Référence', 'reference')}
        ${link('#/coach', 'Coach', 'coach')}
        ${link('#/settings', '⚙', 'settings')}
      </div>
    </nav>`;
  }

  function render(active, html) {
    Speech.stop();
    const warn = !Speech.canSpeak()
      ? `<div class="warn">No French text-to-speech voice detected yet — audio buttons may be silent.
         If this persists, use Chrome, Edge or Safari (their built-in French voices are free).</div>`
      : '';
    $app().innerHTML = nav(active) + warn + `<main>${html}</main>`;
    window.scrollTo(0, 0);
  }

  function sayBtn(text, cls) {
    return `<button class="say ${cls || ''}" data-action="say" data-say="${esc(text)}" title="Écouter">🔊</button>`;
  }

  // ---------- home ----------

  function viewHome() {
    const due = totalDue();
    const budget = newCardBudget();
    const fresh = freshCardIds(budget).length;
    const streak = Store.streak();
    const anyStarted = units().some((u) => Store.state.started[u.id]);

    const unitCards = units().map((u) => {
      const s = deckStats(u);
      const started = !!Store.state.started[u.id];
      const acts = ['reader', 'dialogue', 'quiz', 'dictation', 'writing']
        .filter((a) => Store.state.done[a + ':' + u.id]).length;
      return `<a class="unit-card ${started ? 'started' : ''}" href="#/unit/${u.id}">
        <div class="unit-num">${u.num}</div>
        <div class="unit-body">
          <h3>${esc(u.title)}</h3>
          <p>${esc(u.subtitle)}</p>
          <div class="unit-meta">
            ${started ? `${s.seen}/${s.total} cards · ${acts}/5 activities${s.due ? ` · <b>${s.due} due</b>` : ''}` : 'Not started'}
          </div>
        </div>
      </a>`;
    }).join('');

    render('home', `
      <header class="hero">
        <h1>Le Coach</h1>
        <p class="tagline">French for an English speaker who already knows Spanish.</p>
        <div class="stats">
          <div class="stat"><b>${streak}</b><span>day streak 🔥</span></div>
          <div class="stat"><b>${due}</b><span>cards due</span></div>
          <div class="stat"><b>${fresh}</b><span>new today</span></div>
        </div>
        ${due + fresh > 0
          ? `<a class="btn primary big" href="#/review">Réviser maintenant</a>`
          : anyStarted
            ? `<p class="all-done">✅ All caught up. Read, listen, or start the next unit.</p>`
            : `<p class="all-done">Start with <a href="#/unit/u0">Unit 0 — Le code sonore</a>, then add its deck to your reviews.</p>`}
      </header>

      <section class="plan">
        <h2>The daily 25 minutes</h2>
        <ol>
          <li><b>10 min — Flashcards</b> (Réviser): clears due cards and feeds in ${Store.state.settings.newPerDay}/day new ones.</li>
          <li><b>5 min — Mouth & ears</b>: the unit’s pronunciation drill (speak) or dictation (listen + type).</li>
          <li><b>10 min — Real language</b>: the unit’s reader or dialogue; on writing days, one writing prompt.</li>
        </ol>
        <p class="hint">Consistency beats intensity: 25 minutes daily outperforms 3 hours on Sunday. The streak counter is watching you.</p>
      </section>

      <h2>Units</h2>
      <div class="unit-grid">${unitCards}</div>
    `);
  }

  // ---------- unit ----------

  function viewUnit(uid) {
    const u = units().find((x) => x.id === uid);
    if (!u) { location.hash = '#/'; return; }
    const started = !!Store.state.started[u.id];
    const s = deckStats(u);

    const grammar = u.grammar.map((g) => `
      <div class="card">
        <h4>${esc(g.title)}</h4>
        ${g.esNote ? `<p class="es-note">🇪🇸 ${esc(g.esNote)}</p>` : ''}
        ${(g.body || []).map((p) => `<p>${esc(p)}</p>`).join('')}
        ${g.table ? `<table><thead><tr>${g.table.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${g.table.rows.map((r) => `<tr>${r.map((c, i) => `<td>${esc(c)}${i === 0 ? ' ' + sayBtn(c, 'mini') : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
      </div>`).join('');

    const pron = `
      <div class="card">
        <h4>${esc(u.pronunciationFocus.title)}</h4>
        <ul>${u.pronunciationFocus.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="drill">
          ${u.pronunciationFocus.drill.map((d) => `
            <div class="drill-row">
              ${sayBtn(d.fr)}
              <div><b>${esc(d.fr)}</b> <span class="hint">${esc(d.hint)}</span><br><span class="en">${esc(d.en)}</span></div>
            </div>`).join('')}
        </div>
        ${Speech.canListen() ? `<a class="btn" href="#/speak/${u.id}">🎤 Pronunciation drill with the mic</a>` : ''}
      </div>`;

    const vocabRows = u.vocab.map((v, i) => `
      <tr>
        <td>${sayBtn(v.fr, 'mini')} <b>${esc(v.fr)}</b><br><span class="hint">${esc(v.hint || '')}</span></td>
        <td>${esc(v.en)}<br><span class="es">🇪🇸 ${esc(v.es)}</span></td>
        <td class="note">${v.note ? esc(v.note) : ''}</td>
      </tr>`).join('');

    const act = (key, href, icon, label, desc) => {
      const done = Store.state.done[key + ':' + u.id];
      return `<a class="activity ${done ? 'done' : ''}" href="${href}">
        <span class="icon">${icon}</span><b>${label}</b><span>${desc}</span>${done ? '<span class="check">✓</span>' : ''}
      </a>`;
    };

    render(null, `
      <a class="back" href="#/">← Accueil</a>
      <header class="unit-head">
        <h1><span class="unit-num big">${u.num}</span> ${esc(u.title)}</h1>
        <p>${esc(u.subtitle)}</p>
        <p class="intro">${esc(u.intro)}</p>
        ${started
          ? `<p class="deck-state">📇 Deck active — ${s.seen}/${s.total} cards introduced${s.due ? `, <b>${s.due} due</b>` : ''}. <a href="#/review">Réviser →</a></p>`
          : `<button class="btn primary" data-action="start-unit" data-unit="${u.id}">📇 Add the ${s.total} cards of this unit to my review deck</button>`}
      </header>

      <div class="activities">
        ${act('reader', `#/reader/${u.id}`, '📖', 'Lecture', u.reader.title)}
        ${act('dialogue', `#/dialogue/${u.id}`, '💬', 'Dialogue', u.dialogue.title)}
        ${act('quiz', `#/quiz/${u.id}`, '✍️', 'Production', 'type the French')}
        ${act('dictation', `#/dictation/${u.id}`, '🎧', 'Dictée', 'listen & type')}
        ${act('writing', `#/writing/${u.id}`, '📝', 'Écriture', u.writing.length + ' prompts')}
      </div>

      <h2>Prononciation</h2>
      ${pron}

      <h2>Grammaire <span class="hint">(through Spanish eyes)</span></h2>
      ${grammar}

      <h2>Vocabulaire <span class="hint">(${u.vocab.length} cards)</span></h2>
      <table class="vocab"><tbody>${vocabRows}</tbody></table>
    `);
  }

  // ---------- review (SRS) ----------

  function buildQueue() {
    const now = Date.now();
    const due = dueCards(now);
    const fresh = freshCardIds(newCardBudget());
    return due.concat(fresh);
  }

  function viewReview() {
    const queue = buildQueue();
    if (!queue.length) {
      // learning cards coming due within 15 min keep the session alive
      const soon = dueCards(Date.now(), 15 * 60 * 1000);
      if (soon.length) {
        App.session.review = { queue: soon, idx: 0, revealed: false, count: App.session.review ? App.session.review.count : 0 };
        return renderReviewCard();
      }
      render('review', `
        <div class="center card">
          <h1>🎉 Rien à réviser</h1>
          <p>No cards due. ${units().some((u) => Store.state.started[u.id])
            ? 'Come back later, or read a story / run a dialogue in the meantime.'
            : 'Open a unit and add its deck to start.'}</p>
          <a class="btn" href="#/">← Accueil</a>
        </div>`);
      return;
    }
    App.session.review = { queue, idx: 0, revealed: false, count: App.session.review ? App.session.review.count || 0 : 0 };
    renderReviewCard();
  }

  function renderReviewCard() {
    const st = App.session.review;
    if (!st || st.idx >= st.queue.length) { viewReview(); return; }
    const id = st.queue[st.idx];
    const v = vocabForCardId(id);
    if (!v) { st.idx++; renderReviewCard(); return; }
    const card = Store.state.cards[id] || SRS.newCard();
    const isNew = !Store.state.cards[id];
    const now = Date.now();
    const remaining = st.queue.length - st.idx;

    const back = st.revealed ? `
      <div class="card-back">
        <p class="meaning">${esc(v.en)}</p>
        <p class="es">🇪🇸 ${esc(v.es)}</p>
        ${v.note ? `<p class="note">💡 ${esc(v.note)}</p>` : ''}
      </div>
      <div class="grades">
        <button class="btn grade again" data-action="grade" data-g="0">Encore<br><span>${SRS.previewLabel(card, 0, now)}</span></button>
        <button class="btn grade hard" data-action="grade" data-g="1">Difficile<br><span>${SRS.previewLabel(card, 1, now)}</span></button>
        <button class="btn grade good" data-action="grade" data-g="2">Bien<br><span>${SRS.previewLabel(card, 2, now)}</span></button>
        <button class="btn grade easy" data-action="grade" data-g="3">Facile<br><span>${SRS.previewLabel(card, 3, now)}</span></button>
      </div>` : `
      <button class="btn primary big" data-action="reveal-card">Voir la réponse</button>`;

    render('review', `
      <div class="review-meta">${remaining} left · ${st.count} done ${isNew ? '· <span class="badge new">NEW</span>' : ''}</div>
      <div class="card flashcard">
        <p class="front">${esc(v.fr)} ${sayBtn(v.fr)}</p>
        <p class="hint">${esc(v.hint || '')}</p>
        ${back}
      </div>
      <p class="hint center">Say it out loud before revealing — recall through the mouth sticks better.</p>
    `);
    if (Speech.canSpeak()) Speech.speak(v.fr);
  }

  App.revealCard = function () {
    App.session.review.revealed = true;
    renderReviewCard();
  };

  App.gradeCard = function (g) {
    const st = App.session.review;
    const id = st.queue[st.idx];
    const isNew = !Store.state.cards[id];
    const card = Store.state.cards[id] || SRS.newCard();
    Store.state.cards[id] = SRS.grade(card, g, Date.now());
    if (isNew) Store.logIntroduced();
    Store.logReview();
    st.count++;
    st.idx++;
    st.revealed = false;
    renderReviewCard();
  };

  // ---------- quiz (typed production) ----------

  function articleLenient(s) {
    return U.norm(s).replace(/^(le|la|les|l|un|une|des|du|de la|de) /, '');
  }
  function answerMatches(expected, given) {
    if (!given) return false;
    const e = U.norm(expected), g = U.norm(given);
    return e === g || articleLenient(expected) === articleLenient(given);
  }

  function viewQuiz(uid) {
    const u = units().find((x) => x.id === uid);
    if (!u) { location.hash = '#/'; return; }
    const picks = U.shuffle(u.vocab.map((_, i) => i)).slice(0, Math.min(10, u.vocab.length));
    App.session.quiz = { uid, picks, idx: 0, good: 0, checked: null };
    renderQuiz();
  }

  function renderQuiz() {
    const st = App.session.quiz;
    const u = units().find((x) => x.id === st.uid);
    if (st.idx >= st.picks.length) {
      if (st.good >= Math.ceil(st.picks.length * 0.7)) { Store.state.done['quiz:' + u.id] = true; Store.save(); }
      render(null, `
        <div class="center card">
          <h1>${st.good}/${st.picks.length}</h1>
          <p>${st.good >= st.picks.length * 0.7 ? 'Bien joué ! Production unlocked.' : 'Keep at it — review the deck and retry.'}</p>
          <button class="btn" data-action="quiz-restart">↻ Encore</button>
          <a class="btn" href="#/unit/${u.id}">← Unité ${u.num}</a>
        </div>`);
      return;
    }
    const v = u.vocab[st.picks[st.idx]];
    const checked = st.checked;
    render(null, `
      <a class="back" href="#/unit/${u.id}">← Unité ${u.num}</a>
      <div class="review-meta">${st.idx + 1}/${st.picks.length} · ${st.good} ✓</div>
      <div class="card flashcard">
        <p class="prompt-label">Write it in French:</p>
        <p class="front">${esc(v.en)}</p>
        <p class="es">🇪🇸 ${esc(v.es)}</p>
        <form data-action-submit="quiz-check">
          <input type="text" id="quiz-input" autocomplete="off" autocapitalize="off" spellcheck="false"
            placeholder="en français…" ${checked ? 'disabled' : 'autofocus'} value="${checked ? esc(checked.given) : ''}">
          ${checked ? '' : `<button class="btn primary" type="submit">Vérifier</button>`}
        </form>
        ${checked ? `
          <div class="verdict ${checked.ok ? 'ok' : 'ko'}">
            ${checked.ok ? '✅ Correct' : '❌'} — <b>${esc(v.fr)}</b> ${sayBtn(v.fr, 'mini')}
            ${v.hint ? `<span class="hint">${esc(v.hint)}</span>` : ''}
            ${!checked.ok && checked.given ? `<div class="diff">${U.wordDiff(v.fr, checked.given).map((d) =>
              `<span class="${d.t}">${esc(d.w)}</span>`).join(' ')}</div>` : ''}
          </div>
          <button class="btn primary" data-action="quiz-next" autofocus>Suivant →</button>` : ''}
      </div>
      <p class="hint center">Accents and apostrophes are forgiven; articles too (pain = le pain). Words are not.</p>
    `);
    const inp = document.getElementById('quiz-input');
    if (inp && !checked) inp.focus();
  }

  App.quizCheck = function () {
    const st = App.session.quiz;
    const u = units().find((x) => x.id === st.uid);
    const v = u.vocab[st.picks[st.idx]];
    const given = (document.getElementById('quiz-input') || {}).value || '';
    const ok = answerMatches(v.fr, given);
    if (ok) st.good++;
    st.checked = { ok, given };
    renderQuiz();
    if (Speech.canSpeak()) Speech.speak(v.fr);
  };

  App.quizNext = function () {
    App.session.quiz.idx++;
    App.session.quiz.checked = null;
    renderQuiz();
  };

  // ---------- dictation ----------

  function viewDictation(uid) {
    const u = units().find((x) => x.id === uid);
    if (!u) { location.hash = '#/'; return; }
    App.session.dict = { uid, idx: 0, good: 0, checked: null };
    renderDictation();
  }

  function renderDictation() {
    const st = App.session.dict;
    const u = units().find((x) => x.id === st.uid);
    if (st.idx >= u.dictation.length) {
      Store.state.done['dictation:' + u.id] = true; Store.save();
      render(null, `
        <div class="center card">
          <h1>Dictée terminée 🎧</h1>
          <p>${st.good}/${u.dictation.length} clean on the first try.</p>
          <a class="btn" href="#/unit/${u.id}">← Unité ${u.num}</a>
        </div>`);
      return;
    }
    const item = u.dictation[st.idx];
    const checked = st.checked;
    render(null, `
      <a class="back" href="#/unit/${u.id}">← Unité ${u.num}</a>
      <div class="review-meta">Dictée ${st.idx + 1}/${u.dictation.length}</div>
      <div class="card flashcard">
        <p class="prompt-label">Listen, then type what you hear:</p>
        <p>
          <button class="btn" data-action="say" data-say="${esc(item.fr)}">▶ Écouter</button>
          <button class="btn" data-action="say" data-say="${esc(item.fr)}" data-rate="0.6">🐢 Lentement</button>
        </p>
        <form data-action-submit="dict-check">
          <input type="text" id="dict-input" autocomplete="off" autocapitalize="off" spellcheck="false"
            placeholder="ce que vous entendez…" ${checked ? 'disabled' : ''} value="${checked ? esc(checked.given) : ''}">
          ${checked ? '' : `<button class="btn primary" type="submit">Vérifier</button>`}
        </form>
        ${checked ? `
          <div class="verdict ${checked.ok ? 'ok' : 'ko'}">
            ${checked.ok ? '✅ Parfait !' : 'Almost — compare:'}
            <div class="diff">${U.wordDiff(item.fr, checked.given).map((d) => `<span class="${d.t}">${esc(d.w)}</span>`).join(' ')}</div>
            <p><b>${esc(item.fr)}</b><br><span class="en">${esc(item.en)}</span></p>
          </div>
          <button class="btn primary" data-action="dict-next">Suivant →</button>` : ''}
      </div>
      <p class="hint center">Dictation welds French spelling to French sound — the exact join that’s weak when coming from Spanish.</p>
    `);
    if (!checked && Speech.canSpeak()) Speech.speak(item.fr);
  }

  App.dictCheck = function () {
    const st = App.session.dict;
    const u = units().find((x) => x.id === st.uid);
    const item = u.dictation[st.idx];
    const given = (document.getElementById('dict-input') || {}).value || '';
    const ok = U.norm(item.fr) === U.norm(given);
    if (ok) st.good++;
    st.checked = { ok, given };
    renderDictation();
  };

  App.dictNext = function () {
    App.session.dict.idx++;
    App.session.dict.checked = null;
    renderDictation();
  };

  // ---------- reader ----------

  function glossMap(u) {
    const m = {};
    Object.entries(u.reader.glosses || {}).forEach(([k, v]) => { m[U.norm(k)] = { word: k, gloss: v }; });
    return m;
  }

  function viewReader(uid) {
    const u = units().find((x) => x.id === uid);
    if (!u) { location.hash = '#/'; return; }
    App.session.reader = { uid, showEn: false, gloss: null };
    Store.state.done['reader:' + u.id] = true; Store.save();
    renderReader();
  }

  function renderReader() {
    const st = App.session.reader;
    const u = units().find((x) => x.id === st.uid);
    const paras = u.reader.fr.map((p, i) => {
      const words = p.split(' ').map((w) =>
        `<span class="w" data-action="gloss" data-w="${esc(w)}">${esc(w)}</span>`).join(' ');
      return `<div class="para">
        ${sayBtn(p, 'mini para-say')}
        <p class="fr">${words}</p>
        ${st.showEn ? `<p class="en">${esc(u.reader.en[i])}</p>` : ''}
      </div>`;
    }).join('');

    render(null, `
      <a class="back" href="#/unit/${u.id}">← Unité ${u.num}</a>
      <div class="card reader">
        <h1>${esc(u.reader.title)}</h1>
        ${u.reader.note ? `<p class="hint">${esc(u.reader.note)}</p>` : ''}
        <p class="hint">Tap any word for a gloss · 🔊 reads a paragraph aloud</p>
        ${paras}
        <button class="btn" data-action="toggle-en">${st.showEn ? 'Hide' : 'Show'} English</button>
      </div>
      <div class="gloss-bar ${st.gloss ? 'on' : ''}">${st.gloss
        ? `<b>${esc(st.gloss.word)}</b> — ${esc(st.gloss.gloss)}`
        : 'Tap a word…'}</div>
    `);
  }

  App.gloss = function (raw) {
    const st = App.session.reader;
    const m = glossMap(units().find((x) => x.id === st.uid));
    const key = U.norm(raw);
    let hit = m[key];
    if (!hit) {
      // try without elided prefixes: l', d', j', n', s', qu', m', t', c'
      const bare = raw.replace(/^[ldjnsmtc]’/i, '').replace(/^qu’/i, '');
      hit = m[U.norm(bare)];
    }
    st.gloss = hit || { word: raw.replace(/[«»".,!?;:]/g, ''), gloss: '(no gloss — try the cognate rules!)' };
    renderReader();
  };

  App.toggleEn = function () {
    App.session.reader.showEn = !App.session.reader.showEn;
    renderReader();
  };

  // ---------- dialogue ----------

  function viewDialogue(uid) {
    const u = units().find((x) => x.id === uid);
    if (!u) { location.hash = '#/'; return; }
    App.session.dlg = { uid, revealed: {}, feedback: {}, showAll: false };
    renderDialogue();
  }

  function renderDialogue() {
    const st = App.session.dlg;
    const u = units().find((x) => x.id === st.uid);
    const d = u.dialogue;
    const allYouDone = d.lines.every((l, i) => l.who !== 'you' || st.revealed[i] || st.showAll);
    if (allYouDone) { Store.state.done['dialogue:' + u.id] = true; Store.save(); }

    const lines = d.lines.map((l, i) => {
      const yours = l.who === 'you';
      const open = !yours || st.showAll || st.revealed[i];
      const fb = st.feedback[i];
      return `<div class="line ${yours ? 'you' : 'them'}">
        <div class="speaker">${esc(l.name)}</div>
        ${open ? `
          <div class="bubble">
            <p class="fr">${esc(l.fr)} ${sayBtn(l.fr, 'mini')}</p>
            <p class="en">${esc(l.en)}</p>
            ${fb ? `<p class="feedback ${fb.cls}">${fb.msg}</p>` : ''}
          </div>` : `
          <div class="bubble hidden-line">
            <p class="en">Your line: <i>${esc(l.en)}</i></p>
            <div class="line-actions">
              ${Speech.canListen() ? `<button class="btn mini" data-action="dlg-say" data-i="${i}">🎤 Say it in French</button>` : ''}
              <button class="btn mini" data-action="dlg-reveal" data-i="${i}">Reveal</button>
            </div>
            ${fb ? `<p class="feedback ${fb.cls}">${fb.msg}</p>` : ''}
          </div>`}
      </div>`;
    }).join('');

    render(null, `
      <a class="back" href="#/unit/${u.id}">← Unité ${u.num}</a>
      <div class="card">
        <h1>💬 ${esc(d.title)}</h1>
        <p class="hint">${esc(d.setting)}</p>
        <p>
          <button class="btn mini" data-action="dlg-play-all">▶ Play their lines</button>
          <button class="btn mini" data-action="dlg-toggle-all">${st.showAll ? 'Practice mode' : 'Show everything'}</button>
        </p>
        <div class="dialogue">${lines}</div>
      </div>
      <p class="hint center">First pass: read & listen (Show everything). Second pass: Practice mode — produce your lines from the English before revealing.</p>
    `);
  }

  App.dlgReveal = function (i) {
    const st = App.session.dlg;
    st.revealed[i] = true;
    renderDialogue();
    const u = units().find((x) => x.id === st.uid);
    if (Speech.canSpeak()) Speech.speak(u.dialogue.lines[i].fr);
  };

  App.dlgSay = function (i) {
    const st = App.session.dlg;
    const u = units().find((x) => x.id === st.uid);
    const line = u.dialogue.lines[i];
    st.feedback[i] = { cls: '', msg: '🎤 Listening… speak now' };
    renderDialogue();
    Speech.listen((res) => {
      if (res.error) {
        st.feedback[i] = { cls: 'ko', msg: res.error === 'no-speech' ? 'Didn’t catch anything — try again.' : 'Mic error: ' + res.error };
      } else {
        const best = Math.max(...(res.alternatives || [res.text]).map((t) => U.similarity(line.fr, t)));
        st.revealed[i] = true;
        st.feedback[i] = best >= 0.75
          ? { cls: 'ok', msg: `✅ Heard: « ${res.text} » — nailed it` }
          : best >= 0.4
            ? { cls: 'mid', msg: `🟡 Heard: « ${res.text} » — close, listen and retry` }
            : { cls: 'ko', msg: `❌ Heard: « ${res.text} »` };
      }
      renderDialogue();
    });
  };

  App.dlgPlayAll = function () {
    const st = App.session.dlg;
    const u = units().find((x) => x.id === st.uid);
    const theirLines = u.dialogue.lines.filter((l) => l.who !== 'you').map((l) => l.fr);
    Speech.speak(theirLines.join(' … '));
  };

  App.dlgToggleAll = function () {
    App.session.dlg.showAll = !App.session.dlg.showAll;
    renderDialogue();
  };

  // ---------- speak drill ----------

  function viewSpeak(uid) {
    const u = units().find((x) => x.id === uid);
    if (!u) { location.hash = '#/'; return; }
    App.session.speak = { uid, scores: {} };
    renderSpeak();
  }

  function renderSpeak() {
    const st = App.session.speak;
    const u = units().find((x) => x.id === st.uid);
    const rows = u.pronunciationFocus.drill.map((d, i) => {
      const sc = st.scores[i];
      return `<div class="drill-row">
        ${sayBtn(d.fr)}
        <div class="grow">
          <b>${esc(d.fr)}</b> <span class="hint">${esc(d.hint)}</span><br><span class="en">${esc(d.en)}</span>
          ${sc ? `<div class="feedback ${sc.cls}">${sc.msg}</div>` : ''}
        </div>
        ${Speech.canListen() ? `<button class="btn mini" data-action="speak-mic" data-i="${i}">🎤</button>` : ''}
      </div>`;
    }).join('');
    render(null, `
      <a class="back" href="#/unit/${u.id}">← Unité ${u.num}</a>
      <div class="card">
        <h1>🎤 ${esc(u.pronunciationFocus.title)}</h1>
        <p class="hint">Listen (🔊), imitate, then test yourself against the speech recognizer (🎤).
          If a French recognizer understands you, a French person will.</p>
        <div class="drill">${rows}</div>
      </div>
    `);
  }

  App.speakMic = function (i) {
    const st = App.session.speak;
    const u = units().find((x) => x.id === st.uid);
    const d = u.pronunciationFocus.drill[i];
    st.scores[i] = { cls: '', msg: '🎤 Listening…' };
    renderSpeak();
    Speech.listen((res) => {
      if (res.error) {
        st.scores[i] = { cls: 'ko', msg: res.error === 'no-speech' ? 'Didn’t catch anything.' : 'Mic error: ' + res.error };
      } else {
        const best = Math.max(...(res.alternatives || [res.text]).map((t) => U.similarity(d.fr, t)));
        st.scores[i] = best >= 0.75
          ? { cls: 'ok', msg: `✅ « ${res.text} »` }
          : best >= 0.4
            ? { cls: 'mid', msg: `🟡 « ${res.text} » — almost` }
            : { cls: 'ko', msg: `❌ « ${res.text} » — listen again, mind the hint` };
      }
      renderSpeak();
    });
  };

  // ---------- writing ----------

  function viewWriting(uid) {
    const u = units().find((x) => x.id === uid);
    if (!u) { location.hash = '#/'; return; }
    App.session.writing = { uid, model: {} };
    renderWriting();
  }

  function renderWriting() {
    const st = App.session.writing;
    const u = units().find((x) => x.id === st.uid);
    const blocks = u.writing.map((w, i) => {
      const key = 'w:' + u.id + ':' + i;
      const draft = Store.state.drafts[key] || '';
      return `<div class="card">
        <p><b>${i + 1}.</b> ${esc(w.prompt)}</p>
        <textarea id="draft-${i}" rows="4" placeholder="Écrivez ici…">${esc(draft)}</textarea>
        <div class="line-actions">
          <button class="btn mini" data-action="write-save" data-i="${i}">💾 Save draft</button>
          <button class="btn mini" data-action="write-model" data-i="${i}">${st.model[i] ? 'Hide' : 'Show'} model answer</button>
        </div>
        ${st.model[i] ? `<div class="model"><pre>${esc(w.model)}</pre>${sayBtn(w.model, 'mini')}</div>` : ''}
      </div>`;
    }).join('');
    render(null, `
      <a class="back" href="#/unit/${u.id}">← Unité ${u.num}</a>
      <h1>📝 Écriture — Unité ${u.num}</h1>
      <p class="hint">Write first, peek second. Then paste your draft into the <a href="#/coach">Coach</a> workflow for corrections.</p>
      ${blocks}
    `);
  }

  App.writeSave = function (i) {
    const st = App.session.writing;
    const u = units().find((x) => x.id === st.uid);
    const ta = document.getElementById('draft-' + i);
    Store.state.drafts['w:' + u.id + ':' + i] = ta ? ta.value : '';
    Store.state.done['writing:' + u.id] = true;
    Store.save();
    renderWriting();
  };

  App.writeModel = function (i) {
    const st = App.session.writing;
    // persist textarea values across re-render
    const u = units().find((x) => x.id === st.uid);
    u.writing.forEach((_, j) => {
      const ta = document.getElementById('draft-' + j);
      if (ta) Store.state.drafts['w:' + u.id + ':' + j] = ta.value;
    });
    st.model[i] = !st.model[i];
    renderWriting();
  };

  // ---------- reference ----------

  function viewReference() {
    const phonics = window.FRENCH.phonics.map((g) => `
      <div class="card">
        <h3>${esc(g.group)}</h3>
        <table><tbody>${g.rules.map((r) => `
          <tr>
            <td class="spell">${esc(r.spell)}</td>
            <td>${esc(r.sound)}</td>
            <td>${r.examples.map((e) => `${sayBtn(e.fr, 'mini')} <b>${esc(e.fr)}</b> <span class="hint">${esc(e.hint)}</span>`).join('<br>')}</td>
          </tr>`).join('')}</tbody></table>
      </div>`).join('');

    const rules = window.FRENCH.cognateRules.map((r) => `
      <div class="card slim">
        <h4>${r.from === 'es' ? '🇪🇸' : '🇬🇧'} ${esc(r.rule)}</h4>
        ${r.note ? `<p class="hint">${esc(r.note)}</p>` : ''}
        <p>${r.examples.map((e) => `${esc(e.src)} → <b>${esc(e.fr)}</b> ${sayBtn(e.fr, 'mini')}`).join(' · ')}</p>
      </div>`).join('');

    const faux = window.FRENCH.fauxAmis.map((f) => `
      <tr>
        <td>${sayBtn(f.fr, 'mini')} <b>${esc(f.fr)}</b><br><span class="hint">${esc(f.hint)}</span></td>
        <td>${esc(f.means)}</td>
        <td class="note">${esc(f.trap)}</td>
      </tr>`).join('');

    render('reference', `
      <h1>Référence</h1>
      <h2>🔤 The sound code</h2>
      <p class="hint">French spelling is far more regular than English — it just isn’t Spanish. Internalize this table and you can pronounce anything you read.</p>
      ${phonics}
      <h2>🔁 The cognate engine</h2>
      <p class="hint">Conversion rules that turn words you already own into French.</p>
      <div class="rule-grid">${rules}</div>
      <h2>⚠️ Faux amis (Spanish traps)</h2>
      <table class="vocab"><thead><tr><th>French word</th><th>actually means</th><th>the trap</th></tr></thead><tbody>${faux}</tbody></table>
    `);
  }

  // ---------- coach ----------

  function viewCoach() {
    render('coach', `
      <h1>🧑‍🏫 Conversation coach</h1>
      <div class="card">
        <h3>Talk with Claude — your free conversation partner</h3>
        <p>This repo ships a slash command: open the project in Claude Code and run
          <code>/french-coach</code> (optionally <code>/french-coach unité 3</code>).
          Claude becomes a French conversation partner calibrated to the units you’ve covered:
          it stays inside your vocabulary, corrects gently, and explains through Spanish when it helps.</p>
        <p>Good cadence: after finishing a unit, run one 10-minute conversation on that unit’s topic.
          Paste your <a href="#/coach">writing drafts</a> in for correction at the end.</p>
      </div>
      <div class="card">
        <h3>Solo speaking habits (zero tech required)</h3>
        <ul>
          <li><b>Shadowing:</b> in any dialogue, play a line (🔊) and speak along with it, matching rhythm. 2 minutes a day rewires your mouth.</li>
          <li><b>Narrate your day:</b> while making coffee — « Je prépare le café. Il est huit heures. Je vais travailler. » Unit 5 gives you everything you need.</li>
          <li><b>The Spanish bridge:</b> when you don’t know a word, say the Spanish word with French sounds and the cognate rules. You’ll be right ~60% of the time, and being wrong out loud is how you find the faux amis.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Listening beyond the app</h3>
        <ul>
          <li>Every flashcard, story and dialogue here has TTS — replay readers at slow speed (🐢 in dictée), then normal.</li>
          <li>Free & graded, when you want more: RFI « Journal en français facile » (daily news, slow), and the InnerFrench podcast (from A2 up). Both free.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Where to write</h3>
        <p>Each unit has an <b>Écriture</b> activity with prompts and model answers; drafts save locally.
        Bring drafts to <code>/french-coach</code> for line-by-line correction — that loop
        (write → correct → rewrite) is the fastest writing gain there is.</p>
      </div>
    `);
  }

  // ---------- settings ----------

  function viewSettings() {
    const s = Store.state.settings;
    const voices = Speech.voices();
    render('settings', `
      <h1>⚙ Réglages</h1>
      <div class="card">
        <h3>Audio</h3>
        <label>French voice:
          <select id="voice-select" data-change="voice">
            <option value="">(auto)</option>
            ${voices.map((v) => `<option value="${esc(v.voiceURI)}" ${s.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}
          </select>
        </label>
        <label>Speed: <input type="range" min="0.5" max="1.2" step="0.05" value="${s.rate}" data-change="rate">
          <span id="rate-val">${s.rate}×</span></label>
        <button class="btn mini" data-action="say" data-say="Bonjour ! Je suis votre coach de français.">▶ Test</button>
        ${!voices.length ? '<p class="warn">No French voices found in this browser. Chrome, Edge and Safari ship them for free.</p>' : ''}
        ${!Speech.canListen() ? '<p class="hint">Speech recognition (🎤 drills) needs Chrome, Edge or Safari.</p>' : ''}
      </div>
      <div class="card">
        <h3>Flashcards</h3>
        <label>New cards per day:
          <input type="number" min="0" max="50" value="${s.newPerDay}" data-change="newPerDay" style="width:4em">
        </label>
        <p class="hint">10/day ≈ each unit’s deck absorbed in ~4 days, ~70 reviews/day at steady state. Lower it if reviews pile up; raising it past 15 usually hurts.</p>
      </div>
      <div class="card">
        <h3>Progress data</h3>
        <p class="hint">Everything lives in this browser’s localStorage. Export before switching machines.</p>
        <div class="line-actions">
          <button class="btn mini" data-action="export">⬇ Export JSON</button>
          <button class="btn mini" data-action="import">⬆ Import JSON</button>
          <button class="btn mini danger" data-action="reset-progress">🗑 Reset everything</button>
        </div>
        <textarea id="io" rows="5" placeholder="Export writes here · paste an export here then press Import"></textarea>
      </div>
      <div class="card">
        <h3>About this program</h3>
        <p>Built for one learner: native English, B2 Spanish, zero French, aiming for basic conversation and reading.
        Design choices that follow from that profile:</p>
        <ul>
          <li><b>Sound first.</b> A Spanish speaker’s grammar transfers; their ears don’t. Unit 0 and every unit’s pronunciation focus attack the orthography→sound mapping (the actual hard part).</li>
          <li><b>Cognates as a lever, faux amis as a tax.</b> The Reference tab converts your existing Spanish/English lexicon instead of teaching from zero.</li>
          <li><b>SM-2 spaced repetition</b> for the ~330 highest-yield words & chunks, with Spanish anchors on every card.</li>
          <li><b>Output from day one:</b> typed production with lenient grading, dictation, mic drills against the browser’s free French recognizer, and a Claude conversation loop.</li>
        </ul>
        <p class="hint">100% static, offline-capable, free: no accounts, no servers, no APIs. Your data never leaves this browser.</p>
      </div>
    `);
  }

  App.exportData = function () {
    const ta = document.getElementById('io');
    ta.value = Store.exportJSON();
    ta.select();
  };
  App.importData = function () {
    const ta = document.getElementById('io');
    try {
      Store.importJSON(ta.value);
      alert('Import OK — progress restored.');
      location.hash = '#/';
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
  };
  App.resetProgress = function () {
    if (confirm('Wipe all progress (cards, streak, drafts)? This cannot be undone.')) {
      Store.reset();
      location.hash = '#/';
      route();
    }
  };

  // ---------- router & events ----------

  function route() {
    const h = location.hash || '#/';
    const m = h.match(/^#\/([a-z]+)?\/?([\w-]+)?/);
    const page = (m && m[1]) || '';
    const arg = m && m[2];
    App.session = {};
    if (page === '' || page === undefined) return viewHome();
    if (page === 'unit') return viewUnit(arg);
    if (page === 'review') return viewReview();
    if (page === 'quiz') return viewQuiz(arg);
    if (page === 'dictation') return viewDictation(arg);
    if (page === 'reader') return viewReader(arg);
    if (page === 'dialogue') return viewDialogue(arg);
    if (page === 'speak') return viewSpeak(arg);
    if (page === 'writing') return viewWriting(arg);
    if (page === 'reference') return viewReference();
    if (page === 'coach') return viewCoach();
    if (page === 'settings') return viewSettings();
    viewHome();
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'say') Speech.speak(el.dataset.say, el.dataset.rate ? { rate: Number(el.dataset.rate) } : {});
    else if (a === 'start-unit') { Store.state.started[el.dataset.unit] = Date.now(); Store.save(); route(); }
    else if (a === 'reveal-card') App.revealCard();
    else if (a === 'grade') App.gradeCard(Number(el.dataset.g));
    else if (a === 'quiz-next') App.quizNext();
    else if (a === 'quiz-restart') viewQuiz(App.session.quiz.uid);
    else if (a === 'dict-next') App.dictNext();
    else if (a === 'gloss') App.gloss(el.dataset.w);
    else if (a === 'toggle-en') App.toggleEn();
    else if (a === 'dlg-reveal') App.dlgReveal(Number(el.dataset.i));
    else if (a === 'dlg-say') App.dlgSay(Number(el.dataset.i));
    else if (a === 'dlg-play-all') App.dlgPlayAll();
    else if (a === 'dlg-toggle-all') App.dlgToggleAll();
    else if (a === 'speak-mic') App.speakMic(Number(el.dataset.i));
    else if (a === 'write-save') App.writeSave(Number(el.dataset.i));
    else if (a === 'write-model') App.writeModel(Number(el.dataset.i));
    else if (a === 'export') App.exportData();
    else if (a === 'import') App.importData();
    else if (a === 'reset-progress') App.resetProgress();
  });

  document.addEventListener('submit', (ev) => {
    const form = ev.target.closest('[data-action-submit]');
    if (!form) return;
    ev.preventDefault();
    const a = form.dataset.actionSubmit;
    if (a === 'quiz-check') App.quizCheck();
    else if (a === 'dict-check') App.dictCheck();
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-change]');
    if (!el) return;
    const k = el.dataset.change;
    if (k === 'voice') Store.state.settings.voiceURI = el.value || null;
    else if (k === 'rate') {
      Store.state.settings.rate = Number(el.value);
      const span = document.getElementById('rate-val');
      if (span) span.textContent = el.value + '×';
    } else if (k === 'newPerDay') Store.state.settings.newPerDay = Math.max(0, Number(el.value) || 0);
    Store.save();
  });

  window.addEventListener('hashchange', route);
  route();
})();
