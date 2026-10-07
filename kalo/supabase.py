"""Thin async Supabase client — Auth + PostgREST over ``httpx``.

The JavaScript app used ``@supabase/ssr`` from the *browser*, talking to
Supabase directly with the anon key and letting Row Level Security do the
authorising. This port does the same thing from the server: every request
carries the signed-in user's own JWT, so RLS still scopes every row.
Talking to Supabase over plain HTTP (rather than pulling in ``supabase-py``)
keeps the dependency surface down to ``httpx``, which the AI route needs
anyway.
"""

from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlencode

import httpx

__all__ = ["SupabaseError", "SupabaseAuth", "SupabaseDB", "Session"]


class SupabaseError(Exception):
    """Any Supabase auth or REST failure, carrying the upstream message."""

    def __init__(self, message: str, *, status: int = 0, code: str = ""):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


class Session:
    """An access/refresh token pair plus the owning user's basic profile."""

    __slots__ = ("access_token", "refresh_token", "expires_at", "user")

    def __init__(self, access_token: str, refresh_token: str, expires_at: float, user: dict[str, Any]):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = float(expires_at or 0)
        self.user = user or {}

    @property
    def user_id(self) -> str:
        return str(self.user.get("id") or "")

    @property
    def email(self) -> str:
        return str(self.user.get("email") or "")

    @property
    def name(self) -> str:
        meta = self.user.get("user_metadata") or {}
        return str(meta.get("full_name") or meta.get("name") or self.email)

    @property
    def avatar(self) -> str:
        meta = self.user.get("user_metadata") or {}
        return str(meta.get("avatar_url") or meta.get("picture") or "")

    @property
    def expired(self) -> bool:
        # 30s of slack so a request never starts with a token about to die.
        return bool(self.expires_at) and time.time() >= self.expires_at - 30

    def to_dict(self) -> dict[str, Any]:
        return {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "expires_at": self.expires_at,
            "user": self.user,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Session":
        return cls(
            access_token=str(d.get("access_token") or ""),
            refresh_token=str(d.get("refresh_token") or ""),
            expires_at=float(d.get("expires_at") or 0),
            user=dict(d.get("user") or {}),
        )


def _message(payload: Any) -> str:
    if isinstance(payload, dict):
        for key in ("msg", "message", "error_description", "error"):
            if payload.get(key):
                return str(payload[key])
    return str(payload or "Supabase request failed")


class SupabaseAuth:
    """Supabase GoTrue endpoints (signup, password, PKCE, refresh, OAuth)."""

    def __init__(self, url: str, anon_key: str, timeout: float = 20.0):
        self._url = url.rstrip("/")
        self._key = anon_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {"apikey": self._key, "Content-Type": "application/json"}

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._url}/auth/v1/{path}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                res = await client.post(url, json=body, headers=self._headers())
        except httpx.HTTPError as exc:
            raise SupabaseError(f"Auth service unreachable: {exc}", code="unreachable") from exc
        try:
            data = res.json()
        except ValueError:
            data = {"msg": (res.text or "Supabase request failed")[:300]}
        if res.status_code >= 400:
            raise SupabaseError(_message(data), status=res.status_code)
        return data

    @staticmethod
    def _session_from(payload: dict[str, Any]) -> Session:
        return Session(
            access_token=str(payload.get("access_token") or ""),
            refresh_token=str(payload.get("refresh_token") or ""),
            expires_at=time.time() + float(payload.get("expires_in") or 0),
            user=dict(payload.get("user") or {}),
        )

    async def sign_up(self, email: str, password: str) -> Session | None:
        """Create an account.

        Returns a session, or ``None`` when email confirmation is enabled —
        Supabase then sends no tokens, only a confirmation email.
        """
        payload = await self._post("signup", {"email": email, "password": password})
        if not payload.get("access_token"):
            return None
        return self._session_from(payload)

    async def sign_in(self, email: str, password: str) -> Session:
        payload = await self._post("token?grant_type=password", {"email": email, "password": password})
        return self._session_from(payload)

    async def exchange_code(self, code: str) -> Session:
        """Turn an OAuth ``?code=`` query param into a session (PKCE)."""
        payload = await self._post("token?grant_type=pkce", {"auth_code": code})
        return self._session_from(payload)

    async def refresh(self, refresh_token: str) -> Session:
        payload = await self._post("token?grant_type=refresh_token", {"refresh_token": refresh_token})
        return self._session_from(payload)

    async def get_user(self, access_token: str) -> dict[str, Any]:
        url = f"{self._url}/auth/v1/user"
        headers = {**self._headers(), "Authorization": f"Bearer {access_token}"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                res = await client.get(url, headers=headers)
        except httpx.HTTPError as exc:
            raise SupabaseError(f"Auth service unreachable: {exc}", code="unreachable") from exc
        if res.status_code >= 400:
            raise SupabaseError(_message(res.json() if res.content else {}), status=res.status_code)
        return res.json()

    async def sign_out(self, refresh_token: str) -> None:
        """Revoke the refresh token. Local logout matters more than this."""
        url = f"{self._url}/auth/v1/logout"
        headers = {**self._headers(), "Authorization": f"Bearer {refresh_token}"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                await client.post(url, headers=headers)
        except httpx.HTTPError:
            pass

    def authorize_url(self, provider: str, redirect_to: str) -> str:
        """Browser redirect URL, e.g. ``provider='google'``."""
        q = urlencode({"provider": provider, "redirect_to": redirect_to})
        return f"{self._url}/auth/v1/authorize?{q}"


class SupabaseDB:
    """PostgREST table access. Pass the *user's* JWT so RLS applies."""

    def __init__(self, url: str, anon_key: str, token: str, timeout: float = 20.0):
        self._base = url.rstrip("/").removesuffix("/rest/v1")
        self._key = anon_key
        self._token = token
        self._timeout = timeout

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }
        if extra:
            h.update(extra)
        return h

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, Any] | None = None,
        body: Any = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        url = f"{self._base}/rest/v1/{table}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                res = await client.request(
                    method, url, params=params, json=body, headers=self._headers(headers)
                )
        except httpx.HTTPError as exc:
            raise SupabaseError(f"Database unreachable: {exc}", code="unreachable") from exc
        if res.status_code >= 400:
            try:
                payload = res.json() if res.content else {}
            except ValueError:
                payload = {"msg": (res.text or "")[:300]}
            raise SupabaseError(_message(payload), status=res.status_code)
        if not res.content:
            return None
        try:
            return res.json()
        except ValueError:
            return None

    async def select(
        self,
        table: str,
        *,
        filters: dict[str, Any] | None = None,
        order: str | None = None,
        single: bool = False,
        columns: str = "*",
    ) -> Any:
        params: dict[str, Any] = {"select": columns}
        for key, val in (filters or {}).items():
            params[key] = val
        if order:
            params["order"] = order
        if single:
            # Without `Prefer: returns=representation` PostgREST returns a
            # plain array; limit=1 keeps the "no row" case an empty list
            # rather than the error `.single()` raised in the original code.
            params["limit"] = "1"
        data = await self._request("GET", table, params=params)
        if single:
            if isinstance(data, list):
                return data[0] if data else None
            return data if isinstance(data, dict) else None
        if isinstance(data, list):
            return data
        return [] if data is None else [data]

    async def insert(self, table: str, row: dict[str, Any]) -> Any:
        data = await self._request(
            "POST", table, body=row, headers={"Prefer": "return=representation"}
        )
        return data[0] if isinstance(data, list) and data else data

    async def update(
        self, table: str, row: dict[str, Any], filters: dict[str, Any]
    ) -> list[Any]:
        data = await self._request(
            "PATCH",
            table,
            params=dict(filters),
            body=row,
            headers={"Prefer": "return=representation"},
        )
        if isinstance(data, list):
            return data
        return [] if data is None else [data]

    async def upsert(self, table: str, row: dict[str, Any], on_conflict: str) -> Any:
        data = await self._request(
            "POST",
            table,
            params={"on_conflict": on_conflict},
            body=row,
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        return data[0] if isinstance(data, list) and data else data

    async def delete(self, table: str, filters: dict[str, Any]) -> list[Any]:
        data = await self._request(
            "DELETE", table, params=dict(filters), headers={"Prefer": "return=representation"}
        )
        if isinstance(data, list):
            return data
        return [] if data is None else [data]

    async def rpc(self, function: str, arguments: dict[str, Any]) -> Any:
        """Call a PostgREST database function using this user's JWT."""
        return await self._request("POST", f"rpc/{function}", body=arguments)
