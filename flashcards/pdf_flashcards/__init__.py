"""Turn an ebook PDF into reviewable, human-vetted flashcards.

Pipeline: extract text from a PDF -> chunk it chapter-by-chapter -> ask Claude
to propose candidate cards (each tied to the source passage it came from) ->
vet them in a small local web app -> export the keepers to Anki-importable CSV
and markdown.
"""

__version__ = "0.1.0"
