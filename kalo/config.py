"""Environment configuration for the Python API.

Reads ``.env.local`` first for convenient local development, then ``.env``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent

# Original Next.js file first, then a conventional .env override.
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env", override=True)


def _first(*names: str, default: str = "") -> str:
    for name in names:
        val = os.environ.get(name, "").strip()
        if val:
            return val
    return default


@dataclass(frozen=True)
class Settings:
    supabase_url: str = ""
    supabase_anon_key: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "dots-studio/dots-3-note-preview:free"
    site_url: str = "http://localhost:8000"
    frontend_origins: tuple[str, ...] = ("http://localhost:3000",)
    debug: bool = False

    @property
    def configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)


def load_settings() -> Settings:
    return Settings(
        # Both spellings accepted: the NEXT_PUBLIC_* names come straight
        # from the original .env.local so it works unmodified.
        supabase_url=_first("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").rstrip("/"),
        supabase_anon_key=_first("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        openrouter_api_key=_first("OPENROUTER_API_KEY"),
        openrouter_model=_first("OPENROUTER_MODEL", default="dots-studio/dots-3-note-preview:free"),
        site_url=_first("SITE_URL", "NEXT_PUBLIC_SITE_URL", default="http://localhost:8000").rstrip("/"),
        frontend_origins=tuple(
            origin.strip().rstrip("/")
            for origin in _first("FRONTEND_ORIGINS", default="http://localhost:3000").split(",")
            if origin.strip()
        ),
        debug=os.environ.get("DEBUG", "").lower() in {"1", "true", "yes"},
    )


settings = load_settings()
