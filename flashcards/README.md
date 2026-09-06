# PDF Flashcard Generator

Turn an ebook PDF into spaced-repetition flashcards you actually vet yourself.

The idea: you're reading something worth remembering but can't take notes as you
go. This tool reads the PDF, asks Claude to propose candidate flashcards for the
key ideas — **each one tied to the source passage it came from** — and then lets
you keep, edit, or discard each card in a small local web app. The keepers
export to a CSV you can import into [Anki](https://apps.ankiweb.net/) (free,
proven spaced repetition, syncs to your phone) plus a plain markdown study sheet.

```
   book.pdf ──generate──▶ cards.json ──review──▶ cards.json ──export──▶ deck.csv + deck.md
              (Claude)                  (you, in a web app)             (import into Anki)
```

## Why this shape

- **Claude is good at distilling** a passage into a question, and **not reliably
  good at judging** whether a card is worth keeping — so a human-in-the-loop
  review step is the design, not an afterthought.
- **Source excerpts on every card** let you verify a card against the book in a
  second, and catch anything the model got wrong or made up.
- **Chapter-by-chapter friendly.** You can run `generate` on the chapters you've
  finished and append to the same project as you read on.

## Install

```bash
cd flashcards
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...      # your Claude API key
```

Scanned (image-only) PDFs need the optional OCR extras — see
[OCR](#scanned-pdfs-ocr) below. Text-based ebooks need nothing extra.

## Usage

### 1. Generate candidate cards

```bash
python -m pdf_flashcards generate book.pdf
```

Extracts the text, splits it into chapter-aware chunks, asks Claude for cards,
and writes them to `cards.json` (as `pending`). Useful flags:

| Flag | Default | Purpose |
|------|---------|---------|
| `--out` | `cards.json` | Project file to write (appends if it exists) |
| `--model` | `claude-opus-4-8` | Claude model id (see [Cost](#cost)) |
| `--max-cards` | `6` | Max cards proposed per chunk |
| `--max-chars` | `8000` | Max characters per chunk |
| `--ocr` | `auto` | `auto` / `on` / `off` for scanned PDFs |
| `--overwrite` | off | Replace the project instead of appending |

Re-running `generate` (e.g. on more chapters) **appends** to the existing
project by default, so you never lose review decisions you've already made.

### 2. Review them

```bash
python -m pdf_flashcards review
```

Opens a local web app at `http://127.0.0.1:5001`. Step through one candidate at a
time alongside its source passage, edit the front/back/tags inline if you like,
then keep or discard. Every decision saves to `cards.json` immediately, so you
can stop and resume anytime.

Keyboard shortcuts: **k** keep · **d** discard · **e** edit front · **Esc** stop editing.

### 3. Export the keepers

```bash
python -m pdf_flashcards export
```

Writes `flashcards.csv` (Anki-importable, with column directives baked in) and
`flashcards.md` (a readable study sheet). In Anki: **File ▸ Import**, pick the
CSV; the tags column is mapped automatically.

## Scanned PDFs (OCR)

If a PDF has no embedded text (a scan), the tool auto-detects it and falls back
to OCR — but OCR needs extra pieces:

```bash
pip install pytesseract pdf2image
# plus the system binaries:
#   macOS:  brew install tesseract poppler
#   Debian: apt-get install tesseract-ocr poppler-utils
```

Force or disable OCR with `--ocr on` / `--ocr off`.

## Cost

Card generation makes one API call per chunk. The shared instruction prompt is
cached, so most of each request bills at the cheap cache-read rate. A
book-length PDF is many chunks, so for a cheaper run you can pass a smaller
model, e.g. `--model claude-sonnet-4-6` or `--model claude-haiku-4-5`. The
default is the most capable model, `claude-opus-4-8`.

## Project file

`cards.json` is the single source of truth shared across the three commands:

```jsonc
{
  "source": "/abs/path/book.pdf",
  "created_at": "2026-06-08T...",
  "cards": [
    {
      "id": "…", "front": "…", "back": "…",
      "source_excerpt": "…", "chapter": "Chapter 2",
      "tags": ["…"], "page_start": 12, "page_end": 13,
      "status": "pending"        // -> "kept" or "discarded" after review
    }
  ]
}
```

## Development

```bash
pip install pytest
python -m pytest        # runs the offline unit tests (no API key needed)
```

The pure logic (chunking, export, project store) is covered by tests that don't
touch the network; only `generate` calls the Claude API.
