"""Unit tests for the ported nutrition maths."""

import math

import pytest

from kalo.nutrition import PLANS, calc_bmi, calc_tdee, dkey, get_plan, plan_calc, today, water_goal
from kalo.jsmath import jround, to_fixed


# ─── JS rounding parity ───

@pytest.mark.parametrize(
    "value,expected",
    [(0.5, 1), (1.5, 2), (2.5, 3), (-0.5, 0), (-1.5, -1), (-2.5, -2),
     (2.4, 2), (2.6, 3), (0, 0), (99.5, 100)],
)
def test_jround_matches_javascript(value, expected):
    """JS Math.round breaks ties toward +inf; Python's round() does not."""
    assert jround(value) == expected


def test_jround_rejects_non_finite():
    with pytest.raises(ValueError):
        jround(float("nan"))
    with pytest.raises(ValueError):
        jround(float("inf"))
    with pytest.raises(TypeError):
        jround("3")  # type: ignore[arg-type]


def test_to_fixed_breaks_ties_like_javascript():
    # Each expectation below is what `v.toFixed(d)` prints in V8 — verified
    # with node. The first case is the one a plain ':.1f' gets wrong.
    for value, digits, expected in [
        (67.25, 1, "67.3"),   # f"{67.25:.1f}" would give "67.2"
        (107.0, 1, "107.0"),
        (0.005, 2, "0.01"),
        (3.85, 1, "3.9"),     # exact double sits just above 3.85
        (1.005, 2, "1.00"),   # exact double sits just below 1.005
        (113.2, 1, "113.2"),
        (-67.25, 1, "-67.3"),  # ties go away from zero in toFixed
    ]:
        assert to_fixed(value, digits) == expected


# ─── TDEE ───

def test_calc_tdee_male():
    # bmr = 10*70 + 6.25*172 - 5*25 + 5 = 1655; 1655*1.55 = 2565.25
    assert calc_tdee("m", 25, 172, 70, 1.55) == 2565


def test_calc_tdee_female_uses_mifflin_offset():
    assert calc_tdee("f", 25, 172, 70, 1.55) == jround((1655 - 166) * 1.55)


# ─── Plans ───

def test_plan_calc_cut():
    # kcal 2000, P 154, F round(55.55)=56, C round(880/4)=220
    assert plan_calc(get_plan("cut"), 2500, 70) == {"kcal": 2000, "P": 154, "C": 220, "F": 56}


def test_plan_calc_has_calorie_floor():
    assert plan_calc(get_plan("cut"), 1000, 70)["kcal"] == 1200


def test_plan_calc_macros_never_negative():
    for plan in PLANS:
        c = plan_calc(plan, 5000, 300)
        assert c["C"] >= 0 and c["P"] >= 0 and c["F"] >= 0


def test_unknown_plan_is_none():
    assert get_plan("nope") is None
    assert get_plan(None) is None
    assert get_plan("") is None


# ─── BMI ───

@pytest.mark.parametrize(
    "cm,kg,category",
    [(172, 50, "Underweight"), (172, 70, "Healthy"),
     (172, 80, "Overweight"), (172, 100, "Obese")],
)
def test_bmi_categories(cm, kg, category):
    assert calc_bmi(cm, kg)["category"][0] == category


def test_bmi_bounds_and_invalid_inputs():
    assert calc_bmi(0, 70) is None
    assert calc_bmi(172, 0) is None
    assert calc_bmi(-1, -1) is None
    d = calc_bmi(172, 70)
    assert d["lo"] < d["hi"]
    assert 18.5 * 1.72**2 == pytest.approx(d["lo"])


# ─── Water ───

def test_water_goal_snaps_to_glasses():
    assert water_goal(70) == 2500
    assert water_goal(1) == 1500  # floor
    assert water_goal(999) % 250 == 0


# ─── Dates ───

def test_today_and_dkey_are_local_and_iso():
    assert len(today()) == 10 and today()[4] == "-"
    assert len(dkey(0)) == 10
    # dkey(6) must be exactly six days before dkey(0).
    from datetime import date

    a = date.fromisoformat(dkey(0))
    b = date.fromisoformat(dkey(6))
    assert (a - b).days == 6
