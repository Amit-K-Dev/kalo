"""SVG stick-figure generator — port of ``lib/figures.js``.

Renders the two animation poses of an exercise as inline SVG polylines.
"""

from __future__ import annotations

import math
from typing import Any

from .jsmath import to_fixed

__all__ = ["generate_figure_svg", "get_figure_svg", "clear_figure_cache"]

L = {"t": 34, "u": 28, "s": 28, "a": 19, "f": 19}


def _pts(p0: list[float]) -> dict[str, Any]:
    p = list(p0)
    # Mirror the original's guards against a fully-collapsed pose.
    if p[1] == p[3] and p[2] == p[4]:
        p[3] -= 8
        p[4] -= 6
    if p[5] == p[7] and p[6] == p[8]:
        p[7] -= 5
        p[8] -= 3

    r = lambda d: d * math.pi / 180
    v = lambda a, l: (math.sin(r(a)) * l, math.cos(r(a)) * l)

    td = (math.sin(r(p[0])), -math.cos(r(p[0])))
    n = (td[0] * L["t"], td[1] * L["t"])
    h = (0.0, 0.0)
    hd = (n[0] + td[0] * 11, n[1] + td[1] * 11)

    def lim(o, a, b, l1, l2):
        k = (o[0] + v(a, l1)[0], o[1] + v(a, l1)[1])
        return [o, k, (k[0] + v(b, l2)[0], k[1] + v(b, l2)[1])]

    arms = [lim(n, p[1], p[2], L["a"], L["f"]), lim(n, p[3], p[4], L["a"], L["f"])]
    legs = [lim(h, p[5], p[6], L["u"], L["s"]), lim(h, p[7], p[8], L["u"], L["s"])]

    all_pts = [n, h, *arms[0], *arms[1], *legs[0], *legs[1], (hd[0], hd[1] + 8)]
    my = max(q[1] for q in all_pts)
    return {"N": n, "H": h, "hd": hd, "arms": arms, "legs": legs, "my": my}


def generate_figure_svg(a_pose: list[float], b_pose: list[float]) -> str:
    """Render poses A and B as a 160x120 SVG with both figures overlaid."""
    figs = [_pts(a_pose), _pts(b_pose)]

    x0, x1, y0 = 1e9, -1e9, 1e9
    for f in figs:
        pts = [
            f["N"], f["H"],
            *f["arms"][0], *f["arms"][1],
            *f["legs"][0], *f["legs"][1],
            (f["hd"][0] - 8, f["hd"][1]),
            (f["hd"][0] + 8, f["hd"][1]),
            (f["hd"][0], f["hd"][1] - 8),
        ]
        for q in pts:
            x = q[0] - f["H"][0]
            y = q[1] - f["my"]
            x0 = min(x0, x)
            x1 = max(x1, x)
            y0 = min(y0, y)

    w = x1 - x0
    h = -y0
    s = min(128 / w, 84 / h, 1.3)
    ox = 80 - (x0 + w / 2) * s
    oy = 104.0

    def grp(f, cls: str) -> str:
        def T(q):
            # JS emits .toFixed(1); plain f-string ':.1f' rounds ties to even.
            return [
                to_fixed(ox + s * (q[0] - f["H"][0]), 1),
                to_fixed(oy + s * (q[1] - f["my"]), 1),
            ]

        def pl(a, col, o, wd) -> str:
            # JS joins [[x, y], ...] with " ", and each inner array stringifies
            # to "x,y" — so the separators are "," within a point, " " between.
            points = " ".join(f"{T(q)[0]},{T(q)[1]}" for q in a)
            return (
                f'<polyline points="{points}" stroke="{col}" opacity="{o}" '
                f'stroke-width="{to_fixed(wd * s, 1)}"/>'
            )

        hc = T(f["hd"])
        return (
            f'<g class="{cls}" fill="none" stroke-linecap="round" stroke-linejoin="round">'
            f'{pl(f["arms"][1], "var(--ac)", .45, 5)}'
            f'{pl(f["legs"][1], "var(--tx)", .4, 6)}'
            f'{pl([f["H"], f["N"]], "var(--ac)", 1, 7)}'
            f'{pl(f["legs"][0], "var(--tx)", 1, 6)}'
            f'{pl(f["arms"][0], "var(--ac)", 1, 5)}'
            f'<circle cx="{hc[0]}" cy="{hc[1]}" r="{to_fixed(8 * s, 1)}" fill="var(--card)" '
            f'stroke="var(--tx)" stroke-width="2.5"/></g>'
        )

    return (
        '<svg viewBox="0 0 160 120" role="img">'
        f'<line x1="14" y1="{oy + 3:g}" x2="146" y2="{oy + 3:g}" stroke="var(--ln)" '
        f'stroke-width="3" stroke-linecap="round"/>'
        f"{grp(figs[0], 'fa')}{grp(figs[1], 'fb')}"
        "</svg>"
    )


_fig_cache: dict[str, str] = {}


def get_figure_svg(exercise_id: str, pose_a: list[float], pose_b: list[float]) -> str:
    """Memoised figure renderer — one SVG per exercise id."""
    if exercise_id not in _fig_cache:
        _fig_cache[exercise_id] = generate_figure_svg(pose_a, pose_b)
    return _fig_cache[exercise_id]


def clear_figure_cache() -> None:
    _fig_cache.clear()

