from pdf_flashcards.store import (
    STATUS_DISCARDED,
    STATUS_KEPT,
    Card,
    Project,
    load,
    save,
)


def test_save_and_load_roundtrip(tmp_path):
    project = Project(
        source="book.pdf",
        cards=[
            Card(front="Q1", back="A1", source_excerpt="x", chapter="Ch 1"),
            Card(front="Q2", back="A2", source_excerpt="y", chapter="Ch 1"),
        ],
    )
    path = tmp_path / "cards.json"
    save(project, str(path))
    loaded = load(str(path))
    assert loaded.source == "book.pdf"
    assert [c.front for c in loaded.cards] == ["Q1", "Q2"]


def test_status_views():
    project = Project(source="b", cards=[Card("a", "b", "c") for _ in range(3)])
    project.cards[0].status = STATUS_KEPT
    project.cards[1].status = STATUS_DISCARDED
    assert len(project.pending()) == 1
    assert len(project.kept()) == 1


def test_get_by_id():
    card = Card("a", "b", "c")
    project = Project(source="b", cards=[card])
    assert project.get(card.id) is card
    assert project.get("missing") is None
