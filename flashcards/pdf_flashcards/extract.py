"""Pull text out of a PDF, with an optional OCR fallback for scanned books."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Page:
    """One page of the source PDF."""

    number: int  # 1-based page number
    text: str


def extract_pages(pdf_path: str) -> list[Page]:
    """Extract embedded text from every page of ``pdf_path``.

    Returns one :class:`Page` per page. Pages with no embedded text come back
    with an empty string — see :func:`needs_ocr` and :func:`ocr_pages` for the
    scanned-PDF path.
    """
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "pypdf is required to read PDFs. Install it with: pip install pypdf"
        ) from exc

    reader = PdfReader(pdf_path)
    pages: list[Page] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:  # noqa: BLE001 - a single bad page shouldn't abort the book
            text = ""
        pages.append(Page(number=i, text=_clean(text)))
    return pages


def needs_ocr(pages: list[Page], threshold: float = 0.5) -> bool:
    """Heuristic: does this PDF look like a scan with no embedded text?

    ``True`` when more than ``threshold`` of pages have essentially no text,
    which is the signature of an image-only (scanned) PDF.
    """
    if not pages:
        return False
    empty = sum(1 for p in pages if len(p.text.strip()) < 20)
    return empty / len(pages) > threshold


def ocr_pages(pdf_path: str, dpi: int = 200) -> list[Page]:
    """OCR a scanned PDF into text. Requires the optional OCR dependencies.

    Raises a clear error (rather than a cryptic ImportError) when the optional
    OCR stack isn't installed, so the CLI can tell the user what to do.
    """
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "This PDF appears to be scanned (no embedded text), so it needs OCR.\n"
            "Install the optional OCR dependencies and their system binaries:\n"
            "  pip install pytesseract pdf2image\n"
            "  # plus the Tesseract and Poppler binaries, e.g.\n"
            "  #   macOS:  brew install tesseract poppler\n"
            "  #   Debian: apt-get install tesseract-ocr poppler-utils"
        ) from exc

    images = convert_from_path(pdf_path, dpi=dpi)
    pages: list[Page] = []
    for i, image in enumerate(images, start=1):
        text = pytesseract.image_to_string(image)
        pages.append(Page(number=i, text=_clean(text)))
    return pages


def load_pages(pdf_path: str, use_ocr: bool | None = None) -> list[Page]:
    """Extract pages, automatically falling back to OCR for scanned PDFs.

    ``use_ocr``: ``None`` (default) auto-detects, ``True`` forces OCR, ``False``
    disables it even when the PDF looks scanned.
    """
    pages = extract_pages(pdf_path)
    if use_ocr is True:
        return ocr_pages(pdf_path)
    if use_ocr is None and needs_ocr(pages):
        return ocr_pages(pdf_path)
    return pages


def _clean(text: str) -> str:
    """Normalise whitespace and stitch hyphenated line breaks back together."""
    # Join words split across line breaks with a hyphen: "exam-\nple" -> "example".
    text = text.replace("-\n", "")
    lines = [line.rstrip() for line in text.splitlines()]
    # Collapse runs of blank lines down to a single paragraph break.
    out: list[str] = []
    blank = False
    for line in lines:
        if line.strip():
            out.append(line)
            blank = False
        elif not blank:
            out.append("")
            blank = True
    return "\n".join(out).strip()
