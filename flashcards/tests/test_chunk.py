from pdf_flashcards.chunk import chunk_pages
from pdf_flashcards.extract import Page


def test_groups_pages_by_detected_chapter():
    pages = [
        Page(1, "Chapter 1\n\nThe first idea is interesting and worth knowing."),
        Page(2, "Chapter 2\n\nThe second idea builds on the first one nicely."),
    ]
    chunks = chunk_pages(pages)
    chapters = {c.chapter for c in chunks}
    assert any("Chapter 1" in c for c in chapters)
    assert any("Chapter 2" in c for c in chapters)


def test_splits_long_chapter_into_multiple_chunks():
    big = "\n\n".join(f"Paragraph number {i} with some content." for i in range(400))
    pages = [Page(1, "Chapter 1\n\n" + big)]
    chunks = chunk_pages(pages, max_chars=1000)
    assert len(chunks) > 1
    assert all(len(c.text) <= 1200 for c in chunks)  # max_chars + overlap slack


def test_tracks_page_provenance():
    pages = [Page(5, "Some substantive text about a topic worth remembering.")]
    chunks = chunk_pages(pages)
    assert chunks[0].page_start == 5
    assert chunks[0].page_end == 5


def test_no_chapters_falls_back_to_single_section():
    pages = [Page(1, "Just some prose with no heading at all, plainly written.")]
    chunks = chunk_pages(pages)
    assert len(chunks) == 1
