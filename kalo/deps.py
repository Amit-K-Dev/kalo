"""FastAPI dependencies: read the session the middleware resolved."""

from __future__ import annotations

from fastapi import HTTPException, Request

from .supabase import Session

__all__ = ["current_session", "require_session"]


def current_session(request: Request) -> Session | None:
    """The signed-in session, or ``None``.

    Loading (and refreshing) happens in middleware so it can write a renewed
    cookie back onto the outgoing response; this only reads the result.
    """
    return getattr(request.state, "session", None)


def require_session(request: Request) -> Session:
    """For API routes: 401 when signed out, so the JS client can redirect."""
    session = current_session(request)
    if session is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    return session
