"""Nutrition calculation utilities — port of ``lib/nutrition.js``.

Rounding goes through :func:`kalo.jsmath.jround` so the port produces
byte-identical numbers to the original JavaScript.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from .jsmath import jround

__all__ = [
    "PLANS",
    "jround",
    "calc_tdee",
    "plan_calc",
    "calc_bmi",
    "water_goal",
    "today",
    "dkey",
]


PLANS: list[dict[str, Any]] = [
    {
        "id": "cut",
        "n": "🔥 Lose fat",
        "d": "20% deficit · high protein to keep muscle",
        "adj": -0.2,
        "pr": 2.2,
    },
    {
        "id": "bulk",
        "n": "💪 Bulk",
        "d": "10% surplus · lean muscle gain",
        "adj": 0.1,
        "pr": 1.8,
    },
    {
        "id": "recomp",
        "n": "⚖️ Body recomp",
        "d": "Near maintenance (−5%) · lose fat, build muscle",
        "adj": -0.05,
        "pr": 2.4,
    },
]

PLANS_BY_ID = {p["id"]: p for p in PLANS}


def get_plan(plan_id: str | None) -> dict[str, Any] | None:
    """Look up a plan dict by id, or ``None`` for unknown/empty ids."""
    if not plan_id:
        return None
    return PLANS_BY_ID.get(plan_id)


def calc_tdee(sex: str, age: float, height_cm: float, weight_kg: float, activity_factor: float) -> int:
    """Mifflin-St Jeor BMR scaled by an activity factor."""
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if sex == "m" else -161)
    return jround(bmr * activity_factor)


def plan_calc(plan: dict[str, Any], tdee: float, weight_kg: float) -> dict[str, int]:
    """Daily kcal + macro targets for a plan at a given TDEE and bodyweight."""
    kcal = max(1200, jround(tdee * (1 + plan["adj"])))
    p = jround(plan["pr"] * weight_kg)
    f = jround(kcal * 0.25 / 9)
    c = max(0, jround((kcal - p * 4 - f * 9) / 4))
    return {"kcal": kcal, "P": p, "C": c, "F": f}


def calc_bmi(height_cm: float, weight_kg: float) -> dict[str, Any] | None:
    """BMI with its WHO category (label + accent colour) and healthy weight band."""
    if not (height_cm > 0 and weight_kg > 0):
        return None
    h = height_cm / 100
    bmi = weight_kg / (h * h)
    if bmi < 18.5:
        category = ("Underweight", "#4f9ad9")
    elif bmi < 25:
        category = ("Healthy", "#3fb27f")
    elif bmi < 30:
        category = ("Overweight", "#f0a63a")
    else:
        category = ("Obese", "#d2473c")
    return {
        "bmi": bmi,
        "category": category,
        "lo": 18.5 * h * h,
        "hi": 24.9 * h * h,
    }


def water_goal(weight_kg: float) -> int:
    """Daily water target in ml — 35 ml per kg, snapped to 250 ml glasses."""
    return max(1500, jround(weight_kg * 35 / 250) * 250)


def today() -> str:
    """Today's date as ``YYYY-MM-DD``.

    The original JavaScript used ``toISOString().slice(0, 10)``, which is the
    *UTC* date while the UI rendered *local* dates — so for any timezone ahead
    of UTC the logged day flipped at a different moment than the label shown.
    This uses the server's local date instead.
    """
    return datetime.now().astimezone().date().isoformat()


def dkey(n: int) -> str:
    """The date ``n`` days ago as ``YYYY-MM-DD`` (0 == today, local time)."""
    return (date.today() - timedelta(days=n)).isoformat()
