"""Cloudflare Python Worker entrypoint for Kalo's FastAPI application."""

from workers import asgi

from main import app

Default = asgi.entrypoint(app)
