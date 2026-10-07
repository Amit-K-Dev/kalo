"""Authenticated JSON API for the Next.js frontend.

Every route requires a verified Supabase user. Supabase receives that user's
JWT for database requests, so row-level security remains the data boundary.
"""

from __future__ import annotations

from datetime import date as calendar_date
from typing import Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .ai import AIError, estimate
from .deps import require_session
from .state import build_state
from .store import Store
from .supabase import Session, SupabaseDB, SupabaseError
from .nutrition import calc_bmi

router = APIRouter(prefix="/api")


# ─── Helpers ───

def _store(request: Request, session: Session) -> Store:
    cfg = request.state.settings
    db = SupabaseDB(cfg.supabase_url, cfg.supabase_anon_key, session.access_token)
    return Store(db, session.user_id)


def _ok(**extra: Any) -> JSONResponse:
    return JSONResponse({"ok": True, **extra})


def _err(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"ok": False, "error": message}, status_code=status)


def _handle(exc: SupabaseError) -> JSONResponse:
    if exc.status in (401, 403) or exc.code == "unreachable":
        return _err(exc.message, status=401 if exc.status in (401, 403) else 502)
    return _err(exc.message, status=502)


# ─── Dashboard data ───

@router.get("/state")
async def dashboard_state(request: Request, day: calendar_date | None = None):
    session = require_session(request)
    try:
        state = await build_state(session, _store(request, session), day)
        fields = (
            "profile", "meals", "water", "hist", "saved_routines", "cur_routine",
            "goal", "plan", "plans", "plan_id", "tdee", "weight_kg", "height_cm", "wg",
            "targets", "plan_options", "eaten", "left", "sum", "bmi", "today", "date_label",
            "workout_sessions", "workout_kcal", "days", "hist_stats",
        )
        return JSONResponse({key: state[key] for key in fields})
    except SupabaseError as exc:
        return _handle(exc)


@router.get("/bmi")
async def bmi_preview(
    request: Request,
    height_cm: float = Query(gt=0, le=300),
    weight_kg: float = Query(gt=0, le=500),
):
    require_session(request)
    return JSONResponse(calc_bmi(height_cm, weight_kg))


# ─── Meals ───

class MealIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    kcal: int = Field(default=0, ge=0, le=100_000)
    p: int = Field(default=0, ge=0, le=100_000)
    c: int = Field(default=0, ge=0, le=100_000)
    f: int = Field(default=0, ge=0, le=100_000)


class MealsIn(BaseModel):
    day: calendar_date | None = None
    items: list[MealIn] = Field(default_factory=list, max_length=50)


@router.post("/meals")
async def add_meals(request: Request, body: MealsIn):
    session = require_session(request)
    if not body.items:
        return _err("No meals supplied")
    try:
        # One insert for the whole batch — the original looped one-by-one.
        await _store(request, session).add_meals(
            [m.model_dump() for m in body.items], body.day.isoformat() if body.day else None
        )
        return _ok(count=len(body.items))
    except SupabaseError as exc:
        return _handle(exc)


@router.delete("/meals/{meal_id}")
async def delete_meal(request: Request, meal_id: str):
    session = require_session(request)
    try:
        await _store(request, session).delete_meal(meal_id)
        return _ok()
    except SupabaseError as exc:
        return _handle(exc)


# ─── Water ───

class WaterIn(BaseModel):
    delta: int = Field(default=0, ge=-10_000, le=10_000)
    day: calendar_date | None = None


@router.post("/water")
async def add_water(request: Request, body: WaterIn):
    session = require_session(request)
    store = _store(request, session)
    try:
        from .nutrition import today

        day = body.day.isoformat() if body.day else today()
        log = await store.get_daily_log(day)
        current = (log or {}).get("water_ml") or 0
        # Clamp at zero — the original did this client-side only, so a rapid
        # double-tap of "−" could persist a negative total.
        new_total = max(0, current + body.delta)
        await store.upsert_daily_log(day, {"water_ml": new_total})
        return _ok(water_ml=new_total)
    except SupabaseError as exc:
        return _handle(exc)


# ─── Profile ───

class ProfileIn(BaseModel):
    updates: dict[str, Any] = Field(default_factory=dict)


class TdeeIn(BaseModel):
    sex: str = Field(default="m", pattern="^(m|f)$")
    age: float = Field(ge=1, le=120)
    height_cm: float = Field(gt=0, le=300)
    weight_kg: float = Field(gt=0, le=500)
    activity_factor: float = Field(gt=0, le=3)


class PlanIn(BaseModel):
    plan: str = Field(min_length=1, max_length=20)


@router.post("/tdee")
async def recalc_tdee(request: Request, body: TdeeIn):
    """Recompute TDEE (and the goal kcal if a plan is already picked).

    The original did this in the Goal tab's React state; keeping it here
    means the macro math lives in exactly one place.
    """
    session = require_session(request)
    store = _store(request, session)
    from .nutrition import calc_tdee, get_plan, plan_calc

    try:
        tdee = calc_tdee(body.sex, body.age, body.height_cm, body.weight_kg, body.activity_factor)
        updates: dict[str, Any] = {
            "sex": body.sex,
            "age": body.age,
            "height_cm": body.height_cm,
            "weight_kg": body.weight_kg,
            "activity_factor": body.activity_factor,
            "tdee": tdee,
        }
        profile = await store.get_profile() or {}
        plan = get_plan(profile.get("plan"))
        if plan:
            updates["goal"] = plan_calc(plan, tdee, body.weight_kg)["kcal"]
        await store.update_profile(updates)
        return _ok(tdee=tdee)
    except SupabaseError as exc:
        return _handle(exc)


@router.post("/plan")
async def select_plan(request: Request, body: PlanIn):
    """Pick a plan, setting the daily kcal goal when TDEE is already known."""
    session = require_session(request)
    store = _store(request, session)
    from .nutrition import get_plan, plan_calc

    plan = get_plan(body.plan)
    if plan is None:
        return _err("Unknown plan", status=400)
    try:
        profile = await store.get_profile() or {}
        updates: dict[str, Any] = {"plan": plan["id"]}
        tdee = profile.get("tdee") or 0
        if tdee:
            updates["goal"] = plan_calc(plan, tdee, profile.get("weight_kg") or 70)["kcal"]
        await store.update_profile(updates)
        return _ok(goal=updates.get("goal"))
    except SupabaseError as exc:
        return _handle(exc)


@router.post("/profile")
async def update_profile(request: Request, body: ProfileIn):
    session = require_session(request)
    if not body.updates:
        return _err("No changes supplied")
    # Column allowlist — the client must not be able to write arbitrary keys.
    allowed = {
        "sex", "age", "height_cm", "weight_kg", "activity_factor",
        "tdee", "goal", "plan",
    }
    updates = {k: v for k, v in body.updates.items() if k in allowed}
    if not updates:
        return _err("No permitted fields supplied")
    numeric_bounds = {
        "age": (1, 120), "height_cm": (1, 300), "weight_kg": (1, 500),
        "activity_factor": (0.5, 3), "tdee": (0, 100_000), "goal": (0, 100_000),
    }
    for key, (low, high) in numeric_bounds.items():
        if key in updates:
            value = updates[key]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not low <= value <= high:
                return _err(f"Invalid value for {key}")
    if "sex" in updates and updates["sex"] not in ("m", "f"):
        return _err("Invalid value for sex")
    if "plan" in updates and updates["plan"] not in (None, "cut", "bulk", "recomp"):
        return _err("Invalid value for plan")
    try:
        await _store(request, session).update_profile(updates)
        return _ok()
    except SupabaseError as exc:
        return _handle(exc)


# ─── Routines ───

class RoutineIn(BaseModel):
    name: str = Field(default="", max_length=80)
    items: list[dict[str, Any]] = Field(default_factory=list, max_length=100)


@router.post("/routines")
async def save_routine(request: Request, body: RoutineIn):
    session = require_session(request)
    try:
        await _store(request, session).save_routine(body.name or "My routine", body.items)
        return _ok()
    except SupabaseError as exc:
        return _handle(exc)


@router.delete("/routines/{routine_id}")
async def delete_routine(request: Request, routine_id: str):
    session = require_session(request)
    try:
        await _store(request, session).delete_routine(routine_id)
        return _ok()
    except SupabaseError as exc:
        return _handle(exc)


@router.post("/routines/current")
async def save_current_routine(request: Request, body: RoutineIn):
    session = require_session(request)
    try:
        await _store(request, session).save_current_routine(body.name, body.items)
        return _ok()
    except SupabaseError as exc:
        return _handle(exc)


# ─── Workout log ───

@router.post("/workout/done")
async def workout_done(request: Request, day: calendar_date | None = None):
    session = require_session(request)
    store = _store(request, session)
    from .exercises import estimate_workout
    from .nutrition import today

    try:
        day_key = day.isoformat() if day else today()
        state = await build_state(session, store, day)
        cur = state["cur_routine"]
        if not cur["items"]:
            return _err("No exercises in the routine")
        est = estimate_workout(cur["items"], state["weight_kg"])
        log = await store.get_daily_log(day_key) or {}
        await store.upsert_daily_log(
            day_key,
            {
                "water_ml": log.get("water_ml") or state["water"],
                "workout_sessions": (log.get("workout_sessions") or 0) + 1,
                "workout_kcal": (log.get("workout_kcal") or 0) + est["kc"],
            },
        )
        return _ok(min=est["min"], kcal=est["kc"])
    except SupabaseError as exc:
        return _handle(exc)


# ─── AI estimation ───

class AIIn(BaseModel):
    mode: str = Field(default="text", pattern="^(text|scan)$")
    text: str = Field(default="", max_length=4000)
    image: str | None = Field(default=None, max_length=6_000_000)


def _text_prompt(meal: str) -> str:
    return (
        "You are a nutrition estimator. Break this meal description into individual "
        "food items with realistic portion-based estimates.\n"
        f'Meal: """{meal}"""\n'
        'Respond with ONLY JSON: {"items":[{"name":"item with portion","kcal":number,'
        '"p":grams protein,"c":grams carbs,"f":grams fat}]}'
    )


def _scan_prompt(hint: str) -> str:
    base = (
        "You are a nutrition estimator. Identify every distinct food and drink in the "
        "photo. For each, estimate the WEIGHT in grams of the portion shown (for drinks "
        "use ml as grams), using visual cues such as plate or bowl size, utensils, hands, "
        "packaging and typical serving sizes. Then give nutrition per 100 g of that food "
        "as prepared. If there is no food, return {\"items\":[]}."
    )
    if hint:
        base += f'\nThe person adds: """{hint}"""'
    return (
        base
        + '\nRespond with ONLY JSON: {"items":[{"name":"food name","grams":number,'
        '"kcal100":number,"p100":number,"c100":number,"f100":number}]}'
    )


@router.post("/ai")
async def ai_estimate(request: Request, body: AIIn):
    # Auth first: without this the endpoint was an open proxy that let anyone
    # spend the OpenRouter key.
    require_session(request)
    if body.mode == "text" and not body.text.strip():
        return _err("Describe the meal first")
    if body.mode == "scan" and not body.image:
        return _err("An image is required")
    if not request.state.settings.openrouter_api_key.strip():
        return JSONResponse({"error": "AI service is not configured"}, status_code=500)
    try:
        allowed = await _store(request, request.state.session).db.rpc(
            "reserve_ai_estimate", {"max_per_day": 30}
        )
    except SupabaseError as exc:
        return _handle(exc)
    if not allowed:
        return JSONResponse({"error": "Daily AI estimate limit reached"}, status_code=429)
    prompt = _scan_prompt(body.text) if body.mode == "scan" else _text_prompt(body.text)
    try:
        return JSONResponse(await estimate(prompt, body.image, config=request.state.settings))
    except AIError as exc:
        if exc.status == 429:
            return JSONResponse({"error": "Too many requests. Try again in a bit."}, status_code=429)
        if exc.status == 413:
            return JSONResponse({"error": "That image couldn't be read."}, status_code=413)
        if exc.status == 400:
            return JSONResponse({"error": exc.message}, status_code=400)
        if exc.status == 500:
            return JSONResponse({"error": exc.message}, status_code=500)
        return JSONResponse({"error": exc.message}, status_code=502)
