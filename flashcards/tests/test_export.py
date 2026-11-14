import csv
import io

from pdf_flashcards.export import to_anki_csv, to_markdown
from pdf_flashcards.store import Card


def _sample():
    return [
        Card(
            front="What is compounding?",
            back="Earning returns on prior returns.",
            source_excerpt="returns on returns",
            chapter="Chapter 1",
            tags=["finance", "core"],
        )
    ]


def test_anki_csv_has_directives_and_row():
    out = to_anki_csv(_sample())
    assert "#separator:Comma" in out
    assert "#columns:Front,Back,Tags" in out
    # The data row should round-trip through a CSV reader.
    data_lines = [ln for ln in out.splitlines() if not ln.startswith("#")]
    row = next(csv.reader(io.StringIO("\n".join(data_lines))))
    assert row[0] == "What is compounding?"
    assert row[2] == "finance core"


def test_markdown_includes_question_answer_and_excerpt():
    md = to_markdown(_sample())
    assert "**Q:** What is compounding?" in md
    assert "**A:** Earning returns on prior returns." in md
    assert "> returns on returns" in md
    assert "## Chapter 1" in md
