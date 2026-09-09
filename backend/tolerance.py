"""Deterministic tolerance evaluation for validation measured values.

Parses engineering tolerance strings (e.g. "Plumb ± 1/4 in", "16 in O.C. ± 1/2 in",
"min 30 in", "no more than 1/8 in") against a measured value ("1/8 in", "1 1/4", "16")
and decides whether the reading is in-tolerance, out-of-tolerance, or unknown.
No AI — pure string/number parsing.
"""
import re
from fractions import Fraction

_NUM_RE = re.compile(r"\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?|\.\d+")


def parse_number(token: str):
    if token is None:
        return None
    token = str(token).strip()
    if not token:
        return None
    m = re.match(r"^(\d+)\s+(\d+)/(\d+)$", token)  # mixed  "1 1/4"
    if m:
        return float(int(m.group(1)) + Fraction(int(m.group(2)), int(m.group(3))))
    m = re.match(r"^(\d+)/(\d+)$", token)  # fraction "1/8"
    if m:
        return float(Fraction(int(m.group(1)), int(m.group(2))))
    try:
        return float(token)
    except ValueError:
        return None


def _numbers_with_pos(s: str):
    out = []
    for m in _NUM_RE.finditer(s):
        v = parse_number(m.group(0))
        if v is not None:
            out.append((v, m.start()))
    return out


def _first_number(s: str):
    nums = _numbers_with_pos(str(s))
    return nums[0][0] if nums else None


def evaluate(measured_str, tolerance_str) -> dict:
    """Return {status: 'in'|'out'|'unknown', ...details}."""
    if not measured_str or not tolerance_str:
        return {"status": "unknown"}

    measured = _first_number(measured_str)
    if measured is None:
        return {"status": "unknown"}

    t = str(tolerance_str).lower()
    t = t.replace("+/-", "±").replace("plus or minus", "±").replace("plus/minus", "±").replace("+-", "±")
    nums = _numbers_with_pos(t)
    eps = 1e-6

    idx = t.find("±")
    if idx != -1:
        after = [v for (v, i) in nums if i > idx]
        before = [v for (v, i) in nums if i < idx]
        if after:
            band = after[0]
            nominal = before[0] if before else 0.0
            lo, hi = nominal - band, nominal + band
            status = "in" if (lo - eps) <= measured <= (hi + eps) else "out"
            return {"status": status, "nominal": nominal, "band": band,
                    "low": lo, "high": hi, "measured": measured}

    if any(k in t for k in [">=", "≥", "at least", "minimum", "min ", "no less"]) and nums:
        nominal = nums[0][0]
        return {"status": "in" if measured >= nominal - eps else "out",
                "nominal": nominal, "measured": measured, "bound": "min"}

    if any(k in t for k in ["<=", "≤", "no more than", "maximum", "max ", "at most", "up to"]) and nums:
        nominal = nums[0][0]
        return {"status": "in" if measured <= nominal + eps else "out",
                "nominal": nominal, "measured": measured, "bound": "max"}

    return {"status": "unknown", "measured": measured}
