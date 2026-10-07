"""Kalo's Python API, used by the Next.js frontend."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from kalo.api import router as api_router
from kalo.config import load_settings, settings
from kalo.supabase import Session, SupabaseAuth, SupabaseError


app = FastAPI(
    title="Kalo API",
    description="Authenticated nutrition, workout, and AI services for Kalo's Next.js app.",
    version="0.2.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys((*settings.frontend_origins, "https://kalo.shedbody.com"))),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def bearer_auth_middleware(request: Request, call_next):
    """Validate the frontend's Supabase access token before API handlers run."""
    worker_env = request.scope.get("env")
    if worker_env is None:
        request.state.settings = settings
    else:
        # Cloudflare Worker variables and secrets are request-scoped bindings;
        # they are not available through os.environ at module import time.
        names = (
            "SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY", "OPENROUTER_API_KEY", "OPENROUTER_MODEL",
            "SITE_URL", "NEXT_PUBLIC_SITE_URL", "FRONTEND_ORIGINS", "DEBUG",
        )
        worker_values = {
            name: str(getattr(worker_env, name, "") or "")
            for name in names
        }
        request.state.settings = load_settings(worker_values)

    request.state.auth = SupabaseAuth(
        request.state.settings.supabase_url,
        request.state.settings.supabase_anon_key,
    )
    request.state.session = None
    if request.method == "OPTIONS" or not request.url.path.startswith("/api/"):
        return await call_next(request)

    auth_header = request.headers.get("authorization", "")
    bearer = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else ""
    if bearer:
        try:
            user = await request.state.auth.get_user(bearer)
            request.state.session = Session(bearer, "", 0, user)
        except SupabaseError:
            # Handlers then return a stable 401 without exposing auth-service data.
            request.state.session = None
    return await call_next(request)


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


@app.exception_handler(401)
async def unauthorized_handler(request: Request, exc):
    detail = getattr(exc, "detail", "Not signed in")
    return JSONResponse({"ok": False, "error": detail}, status_code=401)


app.include_router(api_router)


def _print_banner() -> None:
    print("\n  🥗 Kalo Python API")
    print(f"     Supabase: {'configured' if settings.configured else 'MISSING'}")
    print(f"     OpenRouter: {'configured' if settings.openrouter_api_key else 'MISSING (AI disabled)'}\n")


if __name__ == "__main__":
    import uvicorn

    _print_banner()
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
