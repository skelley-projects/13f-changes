"""Ask Claude to propose candidate flashcards for each chunk of the book."""

from __future__ import annotations

import json
from typing import Callable

from .chunk import Chunk
from .store import Card

DEFAULT_MODEL = "claude-opus-4-8"

# The system prompt is identical for every chunk, so we mark it for prompt
# caching — after the first request the rest are billed at the cheap cache-read
# rate for this shared prefix.
SYSTEM_PROMPT = """\
You are an expert study-aid author. You are given an excerpt from a book a \
reader wants to remember. Produce high-quality spaced-repetition flashcards \
capturing the genuinely retention-worthy ideas in the excerpt.

Principles:
- Favor durable understanding over trivia. Prefer cards that test *why* and \
*how* a concept works, the implications of an idea, or a definition that \
unlocks later material — not incidental facts (names, dates, page numbers) \
unless they are central to the argument.
- One idea per card. Keep the front a single clear question and the back a \
concise, self-contained answer. Avoid yes/no questions.
- Write cards that stand on their own without the surrounding text, but keep \
them faithful to what the excerpt actually says. Do not invent facts.
- For every card, copy the SHORT verbatim sentence or phrase from the excerpt \
that the card is based on into `source_excerpt`, so the reader can verify it.
- Add 1-3 lowercase topic `tags` per card.
- If the excerpt is front-matter, a table of contents, references, or has no \
substantive ideas, return an empty `cards` list. Quality over quantity: it is \
better to return few excellent cards than many mediocre ones.\
"""

# Structured-output schema. Note: the API's structured outputs do not support
# array length constraints, so we steer the count via the prompt instead.
_CARD_SCHEMA = {
    "type": "object",
    "properties": {
        "cards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "front": {"type": "string"},
                    "back": {"type": "string"},
                    "source_excerpt": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["front", "back", "source_excerpt", "tags"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["cards"],
    "additionalProperties": False,
}


def _client():
    try:
        from anthropic import Anthropic
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "The anthropic SDK is required. Install it with: pip install anthropic\n"
            "Then set your key:  export ANTHROPIC_API_KEY=sk-ant-..."
        ) from exc
    return Anthropic()


def generate_cards_for_chunk(
    client,
    chunk: Chunk,
    model: str = DEFAULT_MODEL,
    max_cards: int = 6,
) -> list[Card]:
    """Generate candidate cards for a single chunk via one API call."""
    user_text = (
        f"Chapter/section: {chunk.chapter}\n"
        f"Create at most {max_cards} flashcards from this excerpt.\n\n"
        f"--- EXCERPT START ---\n{chunk.text}\n--- EXCERPT END ---"
    )

    response = client.messages.create(
        model=model,
        max_tokens=8000,
        thinking={"type": "adaptive"},
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        output_config={"format": {"type": "json_schema", "schema": _CARD_SCHEMA}},
        messages=[{"role": "user", "content": user_text}],
    )

    raw = _first_text(response)
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []

    cards: list[Card] = []
    for item in data.get("cards", []):
        front = (item.get("front") or "").strip()
        back = (item.get("back") or "").strip()
        if not front or not back:
            continue
        cards.append(
            Card(
                front=front,
                back=back,
                source_excerpt=(item.get("source_excerpt") or "").strip(),
                chapter=chunk.chapter,
                tags=[str(t).strip() for t in item.get("tags", []) if str(t).strip()],
                page_start=chunk.page_start,
                page_end=chunk.page_end,
            )
        )
    return cards


def generate(
    chunks: list[Chunk],
    model: str = DEFAULT_MODEL,
    max_cards: int = 6,
    progress: Callable[[int, int, int], None] | None = None,
    client=None,
) -> list[Card]:
    """Generate candidate cards across all chunks.

    ``progress(index, total, cards_so_far)`` is called after each chunk so the
    CLI can show a running count.
    """
    client = client or _client()
    cards: list[Card] = []
    total = len(chunks)
    for i, chunk in enumerate(chunks, start=1):
        cards.extend(
            generate_cards_for_chunk(client, chunk, model=model, max_cards=max_cards)
        )
        if progress:
            progress(i, total, len(cards))
    return cards


def _first_text(response) -> str:
    """Pull the text payload out of a Messages API response, skipping thinking blocks."""
    for block in response.content:
        if getattr(block, "type", None) == "text":
            return block.text
    return ""
