"""API integration tests using the in-memory Supabase stand-in.

The app's browser UI now lives in Next.js. These tests exercise the Python
service contract directly with Supabase access tokens and emulated RLS; they
never contact a real Supabase project or AI provider.
"""

from __future__ import annotations

from datetime import date

import httpx
import pytest

from tests.conftest import FAKE_PORT


def sign_up(client, email: str, password: str = "secret123") -> str:
    """Create a fake Supabase user and authenticate this API test client."""
    response = httpx.post(
        f"http://127.0.0.1:{FAKE_PORT}/auth/v1/signup",
        json={"email": email, "password": password},
        timeout=5,
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return token


def test_health_and_api_only_surface(client, anon_client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/").status_code == 404
    assert client.get("/login").status_code == 404
    assert anon_client.get("/api/state").status_code == 401


@pytest.mark.parametrize(
    "method,path,payload",
    [
        ("get", "/api/state", None),
        ("get", "/api/bmi?height_cm=172&weight_kg=70", None),
        ("post", "/api/meals", {"items": [{"name": "Oats"}]}),
        ("post", "/api/water", {"delta": 250}),
        ("post", "/api/ai", {"mode": "text", "text": "two eggs"}),
    ],
)
def test_api_rejects_anonymous_callers(anon_client, method, path, payload):
    response = getattr(anon_client, method)(path, json=payload) if payload is not None else getattr(anon_client, method)(path)
    assert response.status_code == 401
    assert response.json()["error"] == "Not signed in"


def test_invalid_bearer_token_is_rejected(client):
    client.headers["Authorization"] = "Bearer not-a-valid-token"
    response = client.get("/api/state")
    assert response.status_code == 401
    assert response.json()["error"] == "Not signed in"


def test_state_returns_a_complete_dashboard_payload(client):
    sign_up(client, "state@example.com")
    response = client.get("/api/state")
    assert response.status_code == 200
    state = response.json()
    assert state["today"] == date.today().isoformat()
    assert state["goal"] == 2000
    assert state["meals"] == []
    assert state["water"] == 0
    assert len(state["days"]) == 7
    assert {"profile", "targets", "bmi", "hist_stats", "cur_routine"} <= state.keys()


def test_state_can_load_a_requested_local_day(client):
    sign_up(client, "day@example.com")
    selected_day = "2026-09-25"
    response = client.post("/api/meals", json={
        "day": selected_day,
        "items": [{"name": "Toast", "kcal": 180, "p": 6, "c": 30, "f": 4}],
    })
    assert response.status_code == 200
    state = client.get(f"/api/state?day={selected_day}").json()
    assert state["today"] == selected_day
    assert state["eaten"] == 180
    assert state["meals"][0]["name"] == "Toast"


# ─── meals ───

def test_add_meals_as_one_batch(client):
    sign_up(client, "meals@example.com")
    response = client.post("/api/meals", json={"items": [
        {"name": "Oats", "kcal": 420, "p": 18, "c": 62, "f": 11},
        {"name": "Yogurt", "kcal": 150, "p": 20, "c": 9, "f": 4},
        {"name": "Latte", "kcal": 190, "p": 10, "c": 18, "f": 9},
    ]})
    assert response.status_code == 200
    assert response.json() == {"ok": True, "count": 3}
    state = client.get("/api/state").json()
    assert {meal["name"] for meal in state["meals"]} == {"Oats", "Yogurt", "Latte"}
    assert state["eaten"] == 760
    assert state["left"] == 1240


def test_meal_validation_rejects_empty_and_oversized_batches(client):
    sign_up(client, "validation@example.com")
    assert client.post("/api/meals", json={"items": []}).status_code == 400
    assert client.post("/api/meals", json={"items": [{"name": ""}]}).status_code == 422
    assert client.post("/api/meals", json={"items": [{"name": "x" * 300}]}).status_code == 422
    assert client.post("/api/meals", json={"items": [{"name": "y"}] * 51}).status_code == 422


def test_delete_meal_removes_it(client):
    sign_up(client, "del@example.com")
    client.post("/api/meals", json={"items": [{"name": "Soup", "kcal": 200}]})
    meal_id = client.get("/api/state").json()["meals"][0]["id"]
    assert client.delete(f"/api/meals/{meal_id}").status_code == 200
    assert client.get("/api/state").json()["meals"] == []


# ─── water and profile ───

def test_water_accumulates_and_clamps_at_zero(client):
    sign_up(client, "water@example.com")

    def post(delta):
        response = client.post("/api/water", json={"delta": delta})
        assert response.status_code == 200
        return response.json()["water_ml"]

    assert post(250) == 250
    assert post(250) == 500
    for _ in range(20):
        post(-250)
    assert post(-250) == 0
    assert post(-250) == 0
    assert post(250) == 250


def test_bmi_endpoint_validates_inputs(client):
    sign_up(client, "bmi@example.com")
    response = client.get("/api/bmi?height_cm=172&weight_kg=70")
    assert response.status_code == 200
    assert response.json()["category"][0] == "Healthy"
    assert client.get("/api/bmi?height_cm=0&weight_kg=70").status_code == 422


def test_tdee_recomputes_goal_for_existing_plan(client):
    sign_up(client, "goal@example.com")
    assert client.post("/api/plan", json={"plan": "cut"}).status_code == 200
    response = client.post("/api/tdee", json={
        "sex": "m", "age": 28, "height_cm": 176, "weight_kg": 74, "activity_factor": 1.55,
    })
    assert response.status_code == 200
    tdee = response.json()["tdee"]
    assert tdee == 2643
    state = client.get("/api/state").json()
    assert state["goal"] == round(tdee * 0.8)


def test_tdee_rejects_out_of_range_input(client):
    sign_up(client, "goaltest@example.com")
    valid = {"sex": "m", "age": 28, "height_cm": 176, "weight_kg": 74, "activity_factor": 1.55}
    for field, value in [("age", 0), ("height_cm", 0), ("weight_kg", -5), ("activity_factor", 0)]:
        response = client.post("/api/tdee", json={**valid, field: value})
        assert response.status_code == 422, f"{field}={value} should be rejected"


def test_profile_update_ignores_unknown_columns_and_rejects_bad_values(client):
    sign_up(client, "profile@example.com")
    response = client.post("/api/profile", json={"updates": {"goal": 1800, "is_admin": True}})
    assert response.status_code == 200
    profile = client.get("/api/state").json()["profile"]
    assert profile["goal"] == 1800
    assert "is_admin" not in profile
    assert client.post("/api/profile", json={"updates": {"goal": True}}).status_code == 400
    assert client.post("/api/profile", json={"updates": {"is_admin": True}}).status_code == 400


def test_plan_rejects_unknown_plan(client):
    sign_up(client, "badplan@example.com")
    assert client.post("/api/plan", json={"plan": "starve"}).status_code == 400


# ─── routines and workout ───

def test_routine_crud(client):
    sign_up(client, "routine@example.com")
    items = [{"id": "bp", "sets": 4, "reps": 8}, {"id": "lt", "sets": 3, "reps": 12}]
    assert client.post("/api/routines/current", json={"name": "Push day", "items": items}).status_code == 200
    assert client.post("/api/routines", json={"name": "Push day", "items": items}).status_code == 200
    state = client.get("/api/state").json()
    assert state["cur_routine"]["name"] == "Push day"
    assert len(state["saved_routines"]) == 1

    client.post("/api/routines", json={"name": "Push day", "items": items[:1]})
    assert len(client.get("/api/state").json()["saved_routines"]) == 1
    routine_id = state["saved_routines"][0]["id"]
    assert client.delete(f"/api/routines/{routine_id}").status_code == 200
    assert client.get("/api/state").json()["saved_routines"] == []


def test_workout_done_logs_a_session(client):
    sign_up(client, "workout@example.com")
    empty = client.post("/api/workout/done")
    assert empty.status_code == 400
    assert empty.json()["error"] == "No exercises in the routine"

    client.post("/api/routines/current", json={
        "name": "Legs", "items": [{"id": "sq", "sets": 3, "reps": 15}],
    })
    first = client.post("/api/workout/done").json()
    assert first["ok"] and first["min"] >= 1 and first["kcal"] > 0
    assert client.post("/api/workout/done").json()["ok"]
    state = client.get("/api/state").json()
    assert state["workout_sessions"] == 2
    assert state["workout_kcal"] > 0


# ─── user isolation ───

def test_users_cannot_see_or_delete_each_others_data(client, anon_client):
    sign_up(client, "alice@example.com")
    client.post("/api/meals", json={"items": [{"name": "Alice secret", "kcal": 100}]})
    meal_id = client.get("/api/state").json()["meals"][0]["id"]

    sign_up(anon_client, "bob@example.com")
    assert anon_client.get("/api/state").json()["meals"] == []
    assert anon_client.delete(f"/api/meals/{meal_id}").status_code == 200
    assert client.get("/api/state").json()["meals"][0]["name"] == "Alice secret"


# ─── AI route and CORS ───

def test_ai_rejects_missing_config_and_invalid_requests(client, monkeypatch):
    sign_up(client, "ai@example.com")
    response = client.post("/api/ai", json={"mode": "text", "text": "two eggs"})
    assert response.status_code == 500
    assert "not configured" in response.json()["error"]
    assert client.post("/api/ai", json={"mode": "telepathy", "text": "x"}).status_code == 422


def test_cors_allows_configured_frontend_origin(client):
    response = client.options(
        "/api/state",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
