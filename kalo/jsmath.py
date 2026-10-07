"""JavaScript-compatible rounding helpers.

Python and JavaScript disagree in two places that matter when porting
numbers verbatim:

* ``Math.round`` rounds ties toward +infinity, while Python's ``round``
  rounds ties to even.
* ``Number.prototype.toFixed`` also breaks exact ties toward the larger
  integer, while Python's ``format(x, '.1f')`` rounds to even.

``jround`` and ``to_fixed`` reproduce the JavaScript behaviour so a port
emits byte-identical values.
"""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal

__all__ = ["jround", "to_fixed"]


def jround(x: float) -> int:
    """Round exactly like JavaScript's ``Math.round`` (ties toward +inf)."""
    if isinstance(x, bool) or not isinstance(x, (int, float)):
        raise TypeError(f"jround() requires a number, got {type(x)!r}")
    if not math.isfinite(x):
        raise ValueError(f"jround() requires a finite number, got {x!r}")
    return math.floor(x + 0.5)


def to_fixed(x: float, digits: int = 1) -> str:
    """Format like JavaScript's ``Number.prototype.toFixed(digits)``.

    ``ROUND_HALF_UP`` is used for the tie case, which matches JavaScript's
    "pick the larger n" rule for the non-negative values this is used on
    (stroke widths, radii, SVG coordinates).
    """
    if isinstance(x, bool) or not isinstance(x, (int, float)):
        raise TypeError(f"to_fixed() requires a number, got {type(x)!r}")
    if not math.isfinite(x):
        raise ValueError(f"to_fixed() requires a finite number, got {x!r}")
    if not isinstance(digits, int) or not 0 <= digits <= 20:
        raise ValueError(f"digits must be an int in [0, 20], got {digits!r}")
    quantum = Decimal(1).scaleb(-digits)
    return str(Decimal(x).quantize(quantum, rounding=ROUND_HALF_UP))
