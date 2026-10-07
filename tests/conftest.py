"""Test fixtures.

Environment is configured at *import* time (before ``kalo.config`` is
imported anywhere) so the app under test talks to the in-memory fake
Supabase instead of a real project. Nothing here creates users or rows in
an actual Supabase instance.
"""

from __future__ import annotations

import os
import socket
import threading
import time

import pytest

FAKE_PORT = 9091

os.environ["SUPABASE_URL"] = f"http://127.0.0.1:{FAKE_PORT}"
os.environ["SUPABASE_ANON_KEY"] = "test-anon-key"
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["SITE_URL"] = "http://testserver"
# Explicit empty value: _first() treats it as unset, so tests can't spend
# a real key even though .env.local defines one.
os.environ["OPENROUTER_API_KEY"] = ""

from tests.fake_supabase import app as fake_app, reset as reset_fake  # noqa: E402


def _port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


@pytest.fixture(scope="session")
def fake_supabase():
    """Run the in-memory Supabase stand-in for the whole test session."""
    if not _port_free(FAKE_PORT):
        pytest.skip(f"port {FAKE_PORT} already in use")
    reset_fake()

    import uvicorn

    server = uvicorn.Server(
        uvicorn.Config(fake_app, host="127.0.0.1", port=FAKE_PORT, log_level="error")
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    deadline = time.time() + 15
    while time.time() < deadline:
        if not server.started:
            time.sleep(0.05)
            continue
        break
    if not server.started:
        pytest.fail("fake Supabase did not start")

    yield f"http://127.0.0.1:{FAKE_PORT}"

    server.should_exit = True
    thread.join(timeout=5)


@pytest.fixture(scope="session")
def client(fake_supabase):
    """A cookie-preserving TestClient for the real app."""
    from fastapi.testclient import TestClient

    import main  # noqa: F401  (import after env is configured)

    with TestClient(main.app) as c:
        yield c


@pytest.fixture()
def anon_client(fake_supabase, client):
    """A fresh, signed-out client sharing the same app."""
    from fastapi.testclient import TestClient

    import main

    with TestClient(main.app) as c:
        yield c


def sign_up(client, email: str, password: str = "secret123") -> str:
    """Create an account through the real signup form and return the email."""
    res = client.post("/signup", data={"email": email, "password": password},
                      follow_redirects=False)
    assert res.status_code == 303, res.text
    return email


def oauth_code(client) -> str:
    """Walk the real Google flow and return the ``?code=`` the fake hands back.

    ``TestClient`` is pinned to ``http://testserver`` so it cannot follow the
    redirect to the fake's own host — that hop is done with plain httpx.
    """
    import httpx
    import re

    start = client.get("/auth/google", follow_redirects=False)
    assert start.status_code == 302, start.text

    authorize = httpx.get(start.headers["location"], follow_redirects=False)
    assert authorize.status_code == 302, authorize.text

    match = re.search(r"code=([^&]+)", authorize.headers["location"])
    assert match, "fake authorize must return a code"
    return match.group(1)
