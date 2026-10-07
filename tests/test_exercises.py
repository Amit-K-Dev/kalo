"""Unit tests for the ported exercise library and SVG figure generator."""

import re

import pytest

from kalo.exercises import CATS, EX, EX_BY_ID, MET, TPL, estimate_workout, get_exercise, get_unit
from kalo.figures import clear_figure_cache, generate_figure_svg, get_figure_svg

# The reference values below were produced by running the original
# lib/exercises.js and lib/figures.js under node, so these tests pin the
# port to the JavaScript it replaced.


def test_library_shape():
    assert len(EX) == 53
    assert len(EX_BY_ID) == 53  # no duplicate ids
    assert CATS[0] == "All" and len(CATS) == 11
    assert len(TPL) == 7


@pytest.mark.parametrize("e", EX, ids=lambda e: e["id"])
def test_every_exercise_is_complete(e):
    assert e["name"] and e["cat"] and e["muscles"] and e["how"]
    assert e["cat"] in CATS, f"{e['id']} has a category with no filter chip"
    assert e["cat"] in MET, f"{e['id']} category {e['cat']} has no MET value"
    assert e["unit"] in {"reps", "sec", "min"}
    assert e["sets"] >= 1 and e["reps"] >= 1
    assert len(e["a"]) == 9 and len(e["b"]) == 9


def test_lookup_helpers():
    assert get_exercise("pu")["name"] == "Push-up"
    assert get_exercise("nope") is None
    assert get_unit({"unit": "reps"}) == "reps"
    assert get_unit({"unit": "sec"}) == "sec"


def test_templates_only_reference_known_exercises():
    for name, ids in TPL:
        assert ids, name
        for eid in ids:
            assert eid in EX_BY_ID, f"{name} references unknown exercise {eid}"


# ─── estimate_workout ───

def test_estimate_matches_javascript_reference():
    # node: estimateWorkout([{id:'pu',sets:3,reps:12}], 70) -> {min:3, kc:19}
    assert estimate_workout([{"id": "pu", "sets": 3, "reps": 12}], 70) == {"min": 3, "kc": 19}


def test_estimate_counts_rest_between_sets():
    # 3 sets x 12 reps x 3s = 108s, plus 2 rests x 45s = 198s total.
    est = estimate_workout([{"id": "pu", "sets": 3, "reps": 12}], 70)
    assert est["min"] == 3


def test_estimate_handles_each_unit():
    reps = estimate_workout([{"id": "pu", "sets": 1, "reps": 10}], 70)
    sec = estimate_workout([{"id": "pk", "sets": 1, "reps": 60}], 70)
    mins = estimate_workout([{"id": "rn", "sets": 1, "reps": 5}], 70)
    # 10 reps * 3s = 30s; 60s; 5 min = 300s.
    assert (reps["min"], sec["min"], mins["min"]) == (1, 1, 5)
    assert mins["kc"] > reps["kc"]


def test_estimate_is_always_at_least_one_minute():
    assert estimate_workout([{"id": "pu", "sets": 1, "reps": 1}], 70)["min"] == 1


def test_estimate_tolerates_bad_input():
    # Unknown ids and zero/negative counts must not crash or go negative.
    assert estimate_workout([{"id": "zzz", "sets": 3, "reps": 10}], 70) == {"min": 1, "kc": 0}
    assert estimate_workout([{"id": "pu", "sets": 0, "reps": 0}], 70)["kc"] == 0
    assert estimate_workout([], 70) == {"min": 1, "kc": 0}
    assert estimate_workout([{"id": "pu", "sets": 3}], 70)["min"] >= 1


def test_estimate_scales_with_bodyweight():
    light = estimate_workout([{"id": "rn", "sets": 1, "reps": 20}], 60)
    heavy = estimate_workout([{"id": "rn", "sets": 1, "reps": 20}], 90)
    assert heavy["kc"] > light["kc"]
    assert light["min"] == heavy["min"]


# ─── figures ───

@pytest.mark.parametrize("e", EX, ids=lambda e: e["id"])
def test_figure_svg_is_wellformed_and_cached(e):
    svg = generate_figure_svg(e["a"], e["b"])
    assert svg.startswith('<svg viewBox="0 0 160 120"')
    assert svg.endswith("</svg>")
    assert svg.count("<svg") == 1 and svg.count("</svg>") == 1
    # Balanced groups and no NaN leaking into coordinates.
    assert svg.count("<g ") == svg.count("</g>")
    assert "NaN" not in svg and "Infinity" not in svg
    # JS joins point pairs as "x,y" and points as " ".
    assert re.search(r'points="[-0-9.]+,[-0-9.]+ [-0-9.]+,[-0-9.]+"', svg)

    clear_figure_cache()
    assert get_figure_svg(e["id"], e["a"], e["b"]) == svg
    assert get_figure_svg(e["id"], e["a"], e["b"]) == svg  # second call cached


def test_figure_renders_both_poses():
    svg = generate_figure_svg(EX[0]["a"], EX[0]["b"])
    assert svg.count('class="fa"') == 1
    assert svg.count('class="fb"') == 1
    # Two polylines per limb group x 5 limbs + head circle.
    assert svg.count("<polyline") == 10
    assert svg.count("<circle") == 2
