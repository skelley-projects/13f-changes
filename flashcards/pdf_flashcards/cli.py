"""Command-line entry point: generate -> review -> export."""

from __future__ import annotations

import argparse
import os
import sys

from . import store
from .chunk import chunk_pages
from .extract import load_pages
from .generate import DEFAULT_MODEL, generate


def _cmd_generate(args: argparse.Namespace) -> int:
    if not os.path.exists(args.pdf):
        print(f"error: no such file: {args.pdf}", file=sys.stderr)
        return 1

    use_ocr = None
    if args.ocr == "on":
        use_ocr = True
    elif args.ocr == "off":
        use_ocr = False

    print(f"Reading {args.pdf} ...")
    pages = load_pages(args.pdf, use_ocr=use_ocr)
    chunks = chunk_pages(pages, max_chars=args.max_chars)
    if not chunks:
        print("No text found in the PDF. If it's a scan, try --ocr on.", file=sys.stderr)
        return 1
    print(f"  {len(pages)} pages -> {len(chunks)} chunks across the book.")
    print(f"Generating candidate cards with {args.model} ...")

    def progress(i: int, total: int, so_far: int) -> None:
        print(f"  chunk {i}/{total}  ({so_far} cards so far)", end="\r", flush=True)

    cards = generate(
        chunks, model=args.model, max_cards=args.max_cards, progress=progress
    )
    print()

    # Merge into an existing project if one is present, so you can run generate
    # again (e.g. for more chapters) without losing prior decisions.
    if os.path.exists(args.out) and not args.overwrite:
        project = store.load(args.out)
        project.cards.extend(cards)
    else:
        project = store.Project(source=os.path.abspath(args.pdf), cards=cards)

    store.save(project, args.out)
    print(f"Wrote {len(cards)} candidate cards to {args.out}")
    print(f"Next:  python -m pdf_flashcards review {args.out}")
    return 0


def _cmd_review(args: argparse.Namespace) -> int:
    if not os.path.exists(args.cards):
        print(f"error: no project file at {args.cards}", file=sys.stderr)
        return 1
    from .webapp import serve

    serve(args.cards, host=args.host, port=args.port)
    return 0


def _cmd_export(args: argparse.Namespace) -> int:
    if not os.path.exists(args.cards):
        print(f"error: no project file at {args.cards}", file=sys.stderr)
        return 1
    from .export import write_exports

    project = store.load(args.cards)
    kept = project.kept()
    if not kept:
        print(
            "No kept cards to export yet. Run the review app first:\n"
            f"  python -m pdf_flashcards review {args.cards}",
            file=sys.stderr,
        )
        return 1
    paths = write_exports(kept, args.out)
    print(f"Exported {len(kept)} cards:")
    for p in paths:
        print(f"  {p}")
    print("\nImport the .csv into Anki via File > Import.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pdf_flashcards",
        description="Turn an ebook PDF into human-vetted flashcards.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    g = sub.add_parser("generate", help="extract a PDF and propose candidate cards")
    g.add_argument("pdf", help="path to the ebook PDF")
    g.add_argument("--out", default="cards.json", help="project file to write")
    g.add_argument("--model", default=DEFAULT_MODEL, help="Claude model id")
    g.add_argument(
        "--max-cards", type=int, default=6, help="max cards per chunk (default 6)"
    )
    g.add_argument(
        "--max-chars",
        type=int,
        default=8000,
        help="max characters per chunk (default 8000)",
    )
    g.add_argument(
        "--ocr",
        choices=["auto", "on", "off"],
        default="auto",
        help="OCR scanned PDFs (default: auto-detect)",
    )
    g.add_argument(
        "--overwrite",
        action="store_true",
        help="replace the project file instead of appending to it",
    )
    g.set_defaults(func=_cmd_generate)

    r = sub.add_parser("review", help="vet candidate cards in a local web app")
    r.add_argument("cards", nargs="?", default="cards.json", help="project file")
    r.add_argument("--host", default="127.0.0.1")
    r.add_argument("--port", type=int, default=5001)
    r.set_defaults(func=_cmd_review)

    e = sub.add_parser("export", help="export kept cards to CSV + markdown")
    e.add_argument("cards", nargs="?", default="cards.json", help="project file")
    e.add_argument(
        "--out", default="flashcards", help="output filename stem (default: flashcards)"
    )
    e.set_defaults(func=_cmd_export)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)
