"""The ``cards.json`` project file: the shared state across generate/review/export."""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

# Card lifecycle: a freshly generated candidate is "pending" until you vet it
# in the review app, where it becomes "kept" or "discarded".
STATUS_PENDING = "pending"
STATUS_KEPT = "kept"
STATUS_DISCARDED = "discarded"


@dataclass
class Card:
    front: str
    back: str
    source_excerpt: str
    chapter: str = ""
    tags: list[str] = field(default_factory=list)
    page_start: int = 0
    page_end: int = 0
    status: str = STATUS_PENDING
    id: str = field(default_factory=lambda: uuid.uuid4().hex)


@dataclass
class Project:
    source: str
    cards: list[Card] = field(default_factory=list)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # --- convenience views -------------------------------------------------
    def pending(self) -> list[Card]:
        return [c for c in self.cards if c.status == STATUS_PENDING]

    def kept(self) -> list[Card]:
        return [c for c in self.cards if c.status == STATUS_KEPT]

    def get(self, card_id: str) -> Card | None:
        return next((c for c in self.cards if c.id == card_id), None)


def save(project: Project, path: str) -> None:
    """Write the project to ``path`` as pretty-printed JSON."""
    payload = {
        "source": project.source,
        "created_at": project.created_at,
        "cards": [asdict(c) for c in project.cards],
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)


def load(path: str) -> Project:
    """Read a project written by :func:`save`."""
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    return Project(
        source=payload.get("source", ""),
        created_at=payload.get("created_at", ""),
        cards=[Card(**c) for c in payload.get("cards", [])],
    )
