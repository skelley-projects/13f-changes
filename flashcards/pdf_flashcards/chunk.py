"""Split a book into chapter-aware chunks small enough to feed to the model.

Coherent chunks matter a lot for card quality: we try to keep each chapter
together and only split on paragraph boundaries within a chapter, so the model
always sees a complete unit of thought rather than a sentence sliced in half.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .extract import Page

# Headings like "Chapter 3", "CHAPTER VII", "3. The Title", or a bare number on
# its own line. Deliberately conservative to avoid splitting on body text.
_CHAPTER_RE = re.compile(
    r"^\s*(chapter\s+[\divxlc]+\b.*|[A-Z][A-Z \-']{6,}|\d{1,2}\.?\s+[A-Z].{0,80})\s*$",
    re.IGNORECASE,
)


@dataclass
class Chunk:
    """A slice of the book sent to the model as one generation request."""

    chapter: str
    text: str
    page_start: int
    page_end: int


@dataclass
class _Section:
    title: str
    pages: list[Page] = field(default_factory=list)


def _detect_sections(pages: list[Page]) -> list[_Section]:
    """Group pages into chapters by scanning for heading lines.

    Falls back to a single untitled section when no headings are found, so the
    pipeline still works on books without detectable chapter markers.
    """
    sections: list[_Section] = []
    current = _Section(title="")
    for page in pages:
        heading = _find_heading(page.text)
        if heading:
            if current.pages:
                # A heading after we've collected pages starts a new chapter.
                sections.append(current)
                current = _Section(title=heading)
            else:
                # A heading before any body text just names the current section
                # (covers the very first chapter, which opens the book).
                current.title = heading
        if not current.title:
            current.title = "Introduction"
        current.pages.append(page)
    if current.pages:
        sections.append(current)
    return sections or [_Section(title="(whole book)", pages=pages)]


def _find_heading(page_text: str) -> str | None:
    """Return a chapter heading if one appears near the top of the page."""
    for line in page_text.splitlines()[:6]:
        candidate = line.strip()
        if 3 <= len(candidate) <= 90 and _CHAPTER_RE.match(candidate):
            return candidate
    return None


def chunk_pages(
    pages: list[Page],
    max_chars: int = 8000,
    overlap_chars: int = 200,
) -> list[Chunk]:
    """Turn extracted pages into a list of :class:`Chunk` objects.

    Each chapter is split into pieces of at most ``max_chars`` characters on
    paragraph boundaries. A small ``overlap_chars`` of trailing context is
    carried into the next piece so ideas spanning a split aren't lost.
    """
    chunks: list[Chunk] = []
    for section in _detect_sections(pages):
        for text, p_start, p_end in _split_section(section, max_chars, overlap_chars):
            if text.strip():
                chunks.append(
                    Chunk(
                        chapter=section.title,
                        text=text.strip(),
                        page_start=p_start,
                        page_end=p_end,
                    )
                )
    return chunks


def _split_section(
    section: _Section, max_chars: int, overlap_chars: int
) -> list[tuple[str, int, int]]:
    """Split one section into (text, first_page, last_page) tuples."""
    # Build a flat list of (paragraph, page_number) so we can track provenance.
    paras: list[tuple[str, int]] = []
    for page in section.pages:
        for para in re.split(r"\n\s*\n", page.text):
            para = para.strip()
            if para:
                paras.append((para, page.number))

    pieces: list[tuple[str, int, int]] = []
    buf: list[str] = []
    buf_len = 0
    first_page = section.pages[0].number if section.pages else 1
    last_page = first_page

    for para, page_no in paras:
        if not buf:
            first_page = page_no
        if buf_len + len(para) > max_chars and buf:
            pieces.append(("\n\n".join(buf), first_page, last_page))
            tail = _overlap_tail(buf, overlap_chars)
            buf = [tail] if tail else []
            buf_len = len(tail)
            first_page = page_no
        buf.append(para)
        buf_len += len(para) + 2
        last_page = page_no

    if buf:
        pieces.append(("\n\n".join(buf), first_page, last_page))
    return pieces


def _overlap_tail(buf: list[str], overlap_chars: int) -> str:
    """Return up to ``overlap_chars`` of trailing text to carry into the next piece."""
    if overlap_chars <= 0:
        return ""
    tail = buf[-1]
    return tail[-overlap_chars:] if len(tail) > overlap_chars else tail
