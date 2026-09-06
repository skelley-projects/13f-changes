"""Export kept cards to Anki-importable CSV and a human-readable markdown file."""

from __future__ import annotations

import csv
import io

from .store import Card


def to_anki_csv(cards: list[Card]) -> str:
    """Render cards as CSV ready to import into Anki.

    Columns: front, back, tags. The leading ``#``-comment lines are Anki import
    directives (recognised by Anki's text importer) that declare the column
    layout, the separator, and that the tags live in column 3.
    """
    buffer = io.StringIO()
    buffer.write("#separator:Comma\n")
    buffer.write("#html:false\n")
    buffer.write("#columns:Front,Back,Tags\n")
    buffer.write("#tags column:3\n")
    writer = csv.writer(buffer, quoting=csv.QUOTE_ALL)
    for card in cards:
        writer.writerow([card.front, card.back, " ".join(card.tags)])
    return buffer.getvalue()


def to_markdown(cards: list[Card]) -> str:
    """Render cards as a readable markdown study sheet grouped by chapter."""
    lines: list[str] = ["# Flashcards", ""]
    current_chapter = object()  # sentinel so the first chapter always prints
    for card in cards:
        if card.chapter != current_chapter:
            current_chapter = card.chapter
            lines.append(f"## {card.chapter or 'Cards'}")
            lines.append("")
        lines.append(f"**Q:** {card.front}")
        lines.append("")
        lines.append(f"**A:** {card.back}")
        if card.tags:
            lines.append("")
            lines.append("_Tags: " + ", ".join(card.tags) + "_")
        if card.source_excerpt:
            lines.append("")
            lines.append(f"> {card.source_excerpt}")
        lines.append("")
        lines.append("---")
        lines.append("")
    return "\n".join(lines)


def write_exports(cards: list[Card], stem: str) -> list[str]:
    """Write ``<stem>.csv`` and ``<stem>.md``. Returns the paths written."""
    csv_path = f"{stem}.csv"
    md_path = f"{stem}.md"
    with open(csv_path, "w", encoding="utf-8", newline="") as fh:
        fh.write(to_anki_csv(cards))
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write(to_markdown(cards))
    return [csv_path, md_path]
