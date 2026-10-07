"""An in-memory stand-in for the Supabase Auth + PostgREST APIs.

Lets the whole app be driven end-to-end (signup → dashboard → meals →
routines) without creating users or rows in a real Supabase project.
Implements exactly the surface :mod:`kalo.supabase` talks to:

* ``/auth/v1/signup``, ``/auth/v1/token`` (password / pkce / refresh)
* ``/auth/v1/user``, ``/auth/v1/logout``, ``/auth/v1/authorize``
* ``/rest/v1/{table}`` with ``select``, ``eq``/``gte``/… filters, ``order``,
  ``limit``, ``on_conflict`` and ``Prefer: return=representation``

Row Level Security is emulated: a request carrying user A's token can only
see and touch rows A owns, so an unscoped delete still fails the way it
would against real Supabase.

Run standalone::

    python tests/fake_supabase.py   # listens on 127.0.0.1:9001
"""

from __future__ import annotations

import itertools
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Header, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse

app = FastAPI(title="fake-supabase", docs_url=None, redoc_url=None)

# ─── state ───────────────────────────────────────────────────────────────

USERS: dict[str, dict[str, Any]] = {}  # email -> user
SESSIONS: dict[str, str] = {}  # token -> user email
AUTH_CODES: dict[str, str] = {}  # code -> user email

TABLES: dict[str, dict[str, dict[str, Any]]] = {
    "profiles": {},
    "daily_logs": {},
    "meals": {},
    "routines": {},
    "current_routine": {},
}

_seq = itertools.count(1)


def reset() -> None:
    USERS.clear()
    SESSIONS.clear()
    AUTH_CODES.clear()
    for t in TABLES.values():
        t.clear()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_id(email: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, email))


def _issue(email: str) -> dict[str, Any]:
    token = f"at-{uuid.uuid4().hex}"
    refresh = f"rt-{uuid.uuid4().hex}"
    SESSIONS[token] = email
    SESSIONS[refresh] = email
    return {
        "access_token": token,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": 3600,
        "user": _public_user(email),
    }


def _public_user(email: str) -> dict[str, Any]:
    u = USERS[email]
    return {
        "id": u["id"],
        "email": u["email"],
        "user_metadata": u["user_metadata"],
    }


def _bearer(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip()


def _current_user(authorization: str | None) -> str | None:
    token = _bearer(authorization)
    return SESSIONS.get(token) if token else None


# ─── auth ────────────────────────────────────────────────────────────────


@app.post("/auth/v1/signup")
async def signup(request: Request):
    body = await request.json()
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")
    if not email or not password:
        return JSONResponse({"msg": "email and password required"}, status_code=400)
    if email in USERS:
        return JSONResponse({"msg": "User already registered"}, status_code=400)
    USERS[email] = {
        "id": _user_id(email),
        "email": email,
        "password": password,
        "user_metadata": {"full_name": email.split("@")[0].title(), "avatar_url": ""},
    }
    return _issue(email)


@app.post("/auth/v1/token")
async def token(request: Request, grant_type: str = Query(...)):
    body = await request.json()
    if grant_type == "password":
        email = str(body.get("email") or "").strip().lower()
        user = USERS.get(email)
        if not user or user["password"] != str(body.get("password") or ""):
            return JSONResponse({"msg": "Invalid login credentials"}, status_code=400)
        return _issue(email)

    if grant_type == "refresh_token":
        email = SESSIONS.get(str(body.get("refresh_token") or ""))
        if not email:
            return JSONResponse({"msg": "Invalid refresh token"}, status_code=400)
        return _issue(email)

    if grant_type == "pkce":
        email = AUTH_CODES.pop(str(body.get("auth_code") or ""), None)
        if not email:
            return JSONResponse({"msg": "Invalid auth code"}, status_code=400)
        return _issue(email)

    return JSONResponse({"msg": f"unsupported grant_type {grant_type}"}, status_code=400)


@app.get("/auth/v1/user")
async def user(authorization: str | None = Header(None)):
    email = _current_user(authorization)
    if not email:
        return JSONResponse({"msg": "invalid token"}, status_code=401)
    return _public_user(email)


@app.post("/auth/v1/logout")
async def logout(authorization: str | None = Header(None)):
    token = _bearer(authorization)
    if token:
        SESSIONS.pop(token, None)
    return JSONResponse({}, status_code=200)


@app.get("/auth/v1/authorize")
async def authorize(provider: str = Query("google"), redirect_to: str = Query("/dashboard")):
    # Fake Google: mint a code for a provider-shaped address and bounce back.
    email = f"{provider}@example.com"
    USERS.setdefault(
        email,
        {
            "id": _user_id(email),
            "email": email,
            "password": "",
            "user_metadata": {
                "full_name": "Google User",
                "avatar_url": "https://example.com/avatar.png",
            },
        },
    )
    code = f"code-{uuid.uuid4().hex}"
    AUTH_CODES[code] = email
    sep = "&" if "?" in redirect_to else "?"
    return RedirectResponse(f"{redirect_to}{sep}code={code}", status_code=302)


# ─── rest ────────────────────────────────────────────────────────────────

_OPS = {
    "eq": lambda c: c == 0,
    "neq": lambda c: c != 0,
    "gt": lambda c: c > 0,
    "gte": lambda c: c >= 0,
    "lt": lambda c: c < 0,
    "lte": lambda c: c <= 0,
}


def _owner(token: str | None) -> str | None:
    email = SESSIONS.get(token or "")
    return USERS[email]["id"] if email else None


def _as_num(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _cmp(left: Any, right: str) -> int:
    """Compare a stored value against a query literal.

    Numeric columns must compare numerically — string ordering would make
    ``gte.10`` true for ``9`` — so fall back to strings only for non-numeric
    values such as dates.
    """
    ln, rn = _as_num(left), _as_num(right)
    if ln is not None and rn is not None:
        return (ln > rn) - (ln < rn)
    ls, rs = str(left), str(right)
    return (ls > rs) - (ls < rs)


def _matches(row: dict[str, Any], key: str, raw: str) -> bool:
    """Evaluate one PostgREST query param, e.g. ``date=gte.2026-01-01``."""
    if "." not in raw:
        return True
    op, _, val = raw.partition(".")
    if op not in _OPS:
        return True
    left = row.get(key)
    if left is None:
        return False
    return _OPS[op](_cmp(left, val))


def _visible(table: str, row: dict[str, Any], owner: str | None) -> bool:
    """Emulate the RLS policy: each user manages only their own rows."""
    if owner is None:
        return False
    if table == "profiles":
        return row.get("id") == owner
    return row.get("user_id") == owner


@app.api_route("/rest/v1/{table}", methods=["GET", "POST", "PATCH", "DELETE"])
async def rest(table: str, request: Request, authorization: str | None = Header(None)):
    if table not in TABLES:
        return JSONResponse({"message": f'relation "{table}" does not exist'}, status_code=404)

    token = _bearer(authorization)
    owner = _owner(token) if token else None
    if owner is None:
        return JSONResponse({"message": "JWT required"}, status_code=401)

    params = dict(request.query_params)
    prefer = (request.headers.get("prefer") or "").lower()
    wants_rows = "return=representation" in prefer

    body: Any = None
    if await request.body():
        try:
            body = await request.json()
        except ValueError:
            return JSONResponse({"message": "invalid JSON"}, status_code=400)

    filters = {k: v for k, v in params.items() if k not in {"select", "order", "limit", "on_conflict"}}
    store = TABLES[table]

    if request.method == "GET":
        rows = [r for r in store.values() if _visible(table, r, owner)]
        rows = [r for r in rows if all(_matches(r, k, v) for k, v in filters.items())]
        if "order" in params:
            col, _, direction = params["order"].partition(".")
            rows.sort(key=lambda r: (r.get(col) is None, r.get(col)), reverse=direction == "desc")
        if "limit" in params:
            rows = rows[: int(params["limit"])]
        cols = [c.strip() for c in params.get("select", "*").split(",")]
        if cols != ["*"]:
            rows = [{c: r.get(c) for c in cols} for r in rows]
        return JSONResponse(rows)

    if request.method in {"POST", "PATCH"}:
        incoming = body if isinstance(body, list) else [body]
        written: list[dict[str, Any]] = []
        for item in incoming:
            if not isinstance(item, dict):
                return JSONResponse({"message": "rows must be objects"}, status_code=400)
            row = dict(item)
            # Enforce ownership the way RLS would.
            if table == "profiles":
                row["id"] = owner
            else:
                row["user_id"] = owner

            if request.method == "PATCH":
                # Update the rows the filters select — never insert a new one.
                targets = [
                    r for r in store.values()
                    if _visible(table, r, owner)
                    and all(_matches(r, k, v) for k, v in filters.items())
                ]
                if not targets:
                    continue
                for target in targets:
                    target.update(row)
                    target["updated_at"] = _now()
                    written.append(target)
                continue

            if "on_conflict" in params:
                key_cols = params["on_conflict"].split(",")
                existing = next(
                    (r for r in store.values()
                     if all(str(r.get(c)) == str(row.get(c)) for c in key_cols)),
                    None,
                )
                if existing:
                    existing.update(row)
                    written.append(existing)
                    continue

            row.setdefault("id", str(next(_seq)))
            row.setdefault("created_at", _now())
            row["updated_at"] = row.get("updated_at") or _now()
            store[row["id"]] = row
            written.append(row)

        return JSONResponse(written if wants_rows else None)

    # DELETE
    doomed = [
        rid for rid, r in store.items()
        if _visible(table, r, owner) and all(_matches(r, k, v) for k, v in filters.items())
    ]
    removed = [store.pop(rid) for rid in doomed]
    return JSONResponse(removed if wants_rows else None)


@app.get("/__debug")
async def debug():
    return {
        "users": sorted(USERS),
        "tables": {k: json.dumps(v, default=str)[:400] for k, v in TABLES.items()},
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=9001)
