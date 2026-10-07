"""OpenRouter nutrition estimation — port of ``app/api/ai/route.js``.

Differences from the original:

* **Callers must be signed in.** The original endpoint was an unauthenticated
  proxy to OpenRouter — anyone who found it could POST and spend the API key.
  This module is only reached from handlers that already resolved a session.
* Reply parsing, size caps and error mapping are otherwise unchanged.
"""

from __future__ import annotations

import base64
import binascii
import math
import re
from typing import Any

import httpx

from .config import Settings, settings

__all__ = ["AIError", "estimate"]

MAX_PROMPT = 6000
# Base64 payload cap — ~3.3 MB of actual JPEG.
MAX_IMAGE_CHARS = 4_500_000
MAX_TOKENS = 1000
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

_FENCE_RE = re.compile(r"```json|```")
_JSON_RE = re.compile(r"\{[\s\S]*\}|\[[\s\S]*\]")


class AIError(Exception):
    """Upstream failure already mapped to the status code the client expects."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message = message
        self.status = status


def _extract_json(text: str) -> dict[str, Any]:
    """Pull the first JSON object/array out of a possibly chatty reply.

    Mirrors the original: strip code fences, grab the outermost ``{...}`` or
    ``[...]``, and wrap a bare array in ``{"items": [...]}``.
    """
    cleaned = _FENCE_RE.sub("", text)
    match = _JSON_RE.search(cleaned)
    candidate = match.group(0) if match else cleaned
    try:
        import json

        parsed = json.loads(candidate)
    except (ValueError, TypeError) as exc:
        raise AIError("Could not parse AI reply", status=502) from exc

    if isinstance(parsed, list):
        return {"items": parsed}
    if isinstance(parsed, dict):
        return parsed
    raise AIError("Could not parse AI reply", status=502)


async def estimate(
    prompt: str,
    image_b64: str | None = None,
    *,
    config: Settings | None = None,
) -> dict[str, Any]:
    """Ask OpenRouter for a JSON nutrition breakdown.

    Raises :class:`AIError` with an HTTP status suitable for returning
    straight to the client (400 / 413 / 429 / 502).
    """
    config = config or settings
    api_key = config.openrouter_api_key.strip()
    if not api_key:
        raise AIError("Server not configured", status=500)

    prompt = str(prompt or "")[:MAX_PROMPT]
    if not prompt:
        raise AIError("Missing prompt", status=400)

    content: list[dict[str, Any]] = []
    if image_b64:
        if len(image_b64) > MAX_IMAGE_CHARS:
            raise AIError("Image too large", status=413)
        try:
            if not base64.b64decode(image_b64, validate=True):
                raise ValueError("empty image")
        except (binascii.Error, ValueError) as exc:
            raise AIError("Invalid image", status=400) from exc
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
            }
        )
    content.append(
        {
            "type": "text",
            "text": prompt + "\n\nReply with a single JSON object only, no other text.",
        }
    )

    body = {
        "model": config.openrouter_model,
        "max_tokens": MAX_TOKENS,
        "messages": [{"role": "user", "content": content}],
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": config.site_url,
        "X-Title": "Kalo",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(OPENROUTER_URL, json=body, headers=headers)
    except httpx.HTTPError as exc:
        raise AIError("Meal estimate service is unavailable", status=502) from exc

    if res.status_code == 429:
        raise AIError("Rate limited", status=429)
    if res.status_code >= 400:
        raise AIError("Meal estimate service is unavailable", status=502)

    try:
        data = res.json()
    except ValueError as exc:
        raise AIError("Upstream returned non-JSON", status=502) from exc

    if not isinstance(data, dict):
        raise AIError("Meal estimate service returned an invalid response", status=502)
    choices = data.get("choices")
    if not isinstance(choices, list):
        choices = []
    text = ""
    if choices:
        choice = choices[0] if isinstance(choices[0], dict) else {}
        message = choice.get("message") if isinstance(choice.get("message"), dict) else {}
        text = message.get("content") if isinstance(message.get("content"), str) else ""
    if not text.strip():
        raise AIError("Empty AI reply", status=502)
    result = _extract_json(text)
    items = result.get("items")
    if not isinstance(items, list) or len(items) > 50:
        raise AIError("Meal estimate service returned invalid nutrition data", status=502)
    scan = image_b64 is not None
    numeric_fields = ("grams", "kcal100", "p100", "c100", "f100") if scan else ("kcal", "p", "c", "f")
    for item in items:
        if not isinstance(item, dict):
            raise AIError("Meal estimate service returned invalid nutrition data", status=502)
        name = item.get("name")
        if not isinstance(name, str) or not name.strip() or len(name) > 200:
            raise AIError("Meal estimate service returned invalid nutrition data", status=502)
        for field in numeric_fields:
            value = item.get(field)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100_000:
                raise AIError("Meal estimate service returned invalid nutrition data", status=502)
    return result
