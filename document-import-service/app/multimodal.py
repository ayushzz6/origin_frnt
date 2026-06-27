"""Stage 5: multimodal/vision fallback via Gemini.

Only called when the deterministic + OCR text for a page leaves the
parser unable to recover at least one valid question — at that point the
plan says to escalate to a vision model on the rasterized page. We keep
the prompt tight (no streaming) and parse the JSON-only response.
"""

from __future__ import annotations

import json
from typing import Any

from PIL import Image

from .config import get_settings
from .contracts import ImportedQuestionDraft


_VISION_PROMPT = """You are a question-extraction assistant.

Given a single image of a page from a question paper, return ALL questions
visible on the page as a JSON array. Each item must match:

{
  "stem": "the full question text",
  "questionType": "mcq" | "msq" | "numerical" | "subjective",
  "options": [{"id": "a", "text": "...", "isCorrect": false}, ...],
  "correctOption": 0 | 1 | 2 | 3 | null,
  "correctOptions": [0,1] | null,
  "answerText": "..." | null,
  "subject": "...",
  "chapter": "...",
  "concept": "...",
  "difficulty": "easy" | "medium" | "hard" | "insane",
  "hasDiagram": true | false,
  "diagramDescription": "..." | null,
  "confidence": 0.0-1.0,
  "reviewReasons": ["..."]
}

If a question references a diagram you cannot read in this image, set
hasDiagram=true and add "missing diagram" to reviewReasons.
NEVER invent an answer key if the source doesn't show one — leave
correctOption and correctOptions as null and add "answer key missing" to
reviewReasons.

Return ONLY a JSON array. No prose, no Markdown fences."""


def vision_extract_page(
    image: Image.Image,
    page_number: int,
    *,
    subject_hint: str | None = None,
) -> list[ImportedQuestionDraft]:
    """Call Gemini Vision on a single page image and parse drafts.

    Returns [] if the API key is not configured, the API call fails, or
    the response can't be parsed — callers should fall back gracefully.
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        return []

    try:
        from google import genai
        from google.genai import types
    except ImportError:  # pragma: no cover
        return []

    client = genai.Client(api_key=settings.gemini_api_key)

    user_text = _VISION_PROMPT
    if subject_hint:
        user_text += f"\n\nSubject hint: {subject_hint}."

    try:
        response = client.models.generate_content(
            model=settings.gemini_vision_model,
            contents=[image, user_text],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
            ),
        )
        raw = (response.text or "").strip()
    except Exception:
        return []

    # Strip a stray ```json fence if the model returns one despite the prompt.
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        items: list[dict[str, Any]] = json.loads(raw)
    except json.JSONDecodeError:
        return []

    drafts: list[ImportedQuestionDraft] = []
    for item in items:
        try:
            drafts.append(
                ImportedQuestionDraft(
                    stem=str(item.get("stem", "")).strip(),
                    question_type=item.get("questionType") or "subjective",
                    options=[
                        {
                            "id": o.get("id"),
                            "text": o.get("text"),
                            "is_correct": bool(o.get("isCorrect", False)),
                        }
                        for o in (item.get("options") or [])
                    ] or None,
                    correct_option=item.get("correctOption"),
                    correct_options=item.get("correctOptions"),
                    answer_text=item.get("answerText"),
                    subject=item.get("subject") or "general",
                    chapter=item.get("chapter") or "general",
                    concept=item.get("concept") or item.get("chapter") or "general",
                    difficulty=item.get("difficulty") or "medium",
                    source_page=page_number,
                    confidence=float(item.get("confidence") or 0.5),
                    extraction_mode="MULTIMODAL_EXTRACT",
                    reference_kind="DIAGRAM" if item.get("hasDiagram") else "NONE",
                    review_reasons=list(item.get("reviewReasons") or []),
                )
            )
        except Exception:
            continue
    return drafts
