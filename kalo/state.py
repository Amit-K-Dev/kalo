"""Assemble the dashboard JSON view model in one pass.

The Next.js dashboard loads this in one request rather than maintaining
separate client-side Supabase queries for each data group.
"""

from __future__ import annotations

import asyncio
from datetime import date as calendar_date, timedelta
from typing import Any

from .nutrition import PLANS, calc_bmi, get_plan, plan_calc, today, water_goal
from .store import Store
from .supabase import Session

__all__ = ["build_state", "sum_meals"]

_MACRO_COL = {"kcal": "kcal", "p": "protein_g", "c": "carbs_g", "f": "fat_g"}


def _date_label(day: calendar_date) -> str:
    """Today as ``Monday, October 6`` (no zero-padded day, as JS renders it)."""
    return f"{day:%A}, {day:%B} {day.day}"


def sum_meals(meals: list[dict[str, Any]], key: str) -> int:
    """Total one macro across today's meals (``kcal`` / ``p`` / ``c`` / ``f``)."""
    col = _MACRO_COL.get(key, key)
    return round(sum(float(m.get(col) or 0) for m in meals))


async def build_state(
    session: Session, store: Store, current_day: calendar_date | None = None
) -> dict[str, Any]:
    """Run the six dashboard queries concurrently and derive the view model."""
    current_day = current_day or calendar_date.fromisoformat(today())
    day_key = current_day.isoformat()
    profile, meals, log, hist, saved, cur = await asyncio.gather(
        store.get_profile(),
        store.get_meals(day_key),
        store.get_daily_log(day_key),
        store.get_history(7, current_day),
        store.get_saved_routines(),
        store.get_current_routine(),
    )
    profile = profile or {}

    goal = profile.get("goal") or 2000
    plan_id = profile.get("plan")
    plan = get_plan(plan_id)
    tdee = profile.get("tdee") or 0
    weight_kg = profile.get("weight_kg") or 70
    height_cm = profile.get("height_cm") or 172
    wg = water_goal(weight_kg)
    water = (log or {}).get("water_ml") or 0

    targets = plan_calc(plan, tdee, weight_kg) if plan and tdee else None
    plan_options = {
        plan_item["id"]: plan_calc(plan_item, tdee, weight_kg)
        for plan_item in PLANS
    } if tdee else {}
    eaten = sum_meals(meals, "kcal")

    bmi = calc_bmi(height_cm, weight_kg)

    today_hist = hist.get(day_key, {})

    # The 7-day series the Home tab charts. Day 0 is overridden with the
    # live in-memory values (as the React version did) so today's bar moves
    # before a refetch lands.
    days = []
    for n in (6, 5, 4, 3, 2, 1, 0):
        k = (current_day - timedelta(days=n)).isoformat()
        if n == 0:
            e = {
                "k": eaten,
                "w": water,
                "g": goal,
                "wk": today_hist.get("wk") or 0,
                "b": today_hist.get("b") or 0,
            }
        else:
            e = hist.get(k, {})
        days.append({"k": k, "n": n, "e": e})

    def _num(bucket, key):
        return float(bucket.get(key) or 0)

    logged = [d for d in days if _num(d["e"], "k") > 0]
    water_days = [d for d in days if _num(d["e"], "w") > 0]
    hist_stats = {
        "logged": len(logged),
        "avg": round(sum(_num(d["e"], "k") for d in logged) / len(logged)) if logged else 0,
        "sessions": round(sum(_num(d["e"], "wk") for d in days)),
        "burned": round(sum(_num(d["e"], "b") for d in days)),
        "water_days": len(water_days),
        "hits": sum(1 for d in days if _num(d["e"], "w") >= wg),
    }

    return {
        "session": session,
        "user": session.user,
        "user_name": session.name,
        "user_email": session.email,
        "avatar": session.avatar,
        "letter": (session.name[:1] or session.email[:1] or "U").upper(),
        "profile": profile,
        "meals": meals,
        "water": water,
        "hist": hist,
        "saved_routines": saved,
        "cur_routine": {"name": cur.get("name") or "", "items": cur.get("items") or []},
        "goal": goal,
        "plan": plan,
        "plans": [{"id": item["id"], "n": item["n"], "d": item["d"]} for item in PLANS],
        "plan_id": plan_id,
        "tdee": tdee,
        "weight_kg": weight_kg,
        "height_cm": height_cm,
        "wg": wg,
        "targets": targets,
        "plan_options": plan_options,
        "eaten": eaten,
        "left": goal - eaten,
        "sum": {k: sum_meals(meals, k) for k in ("kcal", "p", "c", "f")},
        "bmi": bmi,
        "today": day_key,
        # "Monday, October 6" — matches the original's toLocaleDateString.
        "date_label": _date_label(current_day),
        "workout_sessions": (log or {}).get("workout_sessions") or 0,
        "workout_kcal": (log or {}).get("workout_kcal") or 0,
        "today_hist": today_hist,
        "days": days,
        "hist_stats": hist_stats,
    }
