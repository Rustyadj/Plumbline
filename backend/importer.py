"""Deterministic (no-AI) CSV/XLSX task importer for PLUMBLINE.

Reads any spreadsheet, finds the task-name column automatically, and infers:
  - category via keyword matching on the task name
  - course from prefix (1st/2nd/3rd/4th/5th) or 'all'
  - unit from row/header hints (LF/SF/EA/HRS/%)
  - estimated_hours + estimated_qty from adjacent numeric columns

No LLM required. Fast, cheap, predictable.
"""
import io
import csv
import re
from typing import List, Dict, Any, Tuple, Optional

from openpyxl import load_workbook


# ── DETECTION RULES ────────────────────────────────────────────────
_JUNK_VALUES = {"#REF!", "#DIV/0!", "#N/A", "#VALUE!", "#NAME?", "#NULL!", "#NUM!"}

# Junk phrases (case-insensitive substring OR whole-word matches)
_JUNK_TASK_TOKENS = {
    "total", "subtotal", "grand total", "week ending", "job number",
    "recap", "installer hrs", "apprentice hrs", "foreman hrs",
    "laborer hrs", "labor hrs", "over/under", "ratio", "spent",
    "earned", "actual", "estimated", "unnamed", "titan icf",
    "abilene int ss", "notes", "date", "day",
    "apprentice", "installer", "foreman", "laborer", "journeyman",
    "helper", "operator", "driver", "forklift", "bonus", "overtime",
    "per diem", "pto", "vacation", "holiday", "sick",
    "task", "wall production", "titan production",
    "hours worked", "quantity", "each",
}

# Category keyword → category. Order matters — more specific first.
_CATEGORY_KEYWORDS = [
    ("precon", "Precon"),
    ("pre-buck", "Precon"),
    ("prebuck", "Precon"),
    ("mobilization", "Precon"),
    ("mobiliz", "Precon"),
    ("unload", "Startup"),
    ("startup", "Startup"),
    ("shakeout", "Startup"),
    ("layout", "Layout"),
    ("control line", "Layout"),
    ("verify dowel", "Layout"),
    ("elevation check", "Layout"),
    ("course level", "Layout"),
    ("elevation", "Layout"),
    ("foam cut", "Layout"),
    ("opening & foam", "Layout"),
    ("opening layout", "Layout"),
    ("rebar", "Rebar"),
    ("dowel", "Rebar"),
    ("epoxy", "Rebar"),
    ("gfrp", "Rebar"),
    ("splice", "Rebar"),
    ("tie ", "Rebar"),
    ("horizontal", "Rebar"),
    ("vertical bar", "Rebar"),
    ("post-pour", "Pour"),
    ("post pour", "Pour"),
    ("pre-pour", "Pour"),
    ("pre pour", "Pour"),
    ("pour", "Pour"),
    ("concrete", "Pour"),
    ("vibrate", "Pour"),
    ("blowout", "Pour"),
    ("stripped", "Strip"),
    ("strip", "Strip"),
    ("bracing down", "Strip"),
    ("brace down", "Strip"),
    ("walkboard", "Strip"),
    ("handrail", "Strip"),
    ("cleanup", "Cleanup"),
    ("clean up", "Cleanup"),
    ("power wash", "Cleanup"),
    ("load up", "Cleanup"),
    ("loaded up", "Cleanup"),
    ("demobiliz", "Cleanup"),
    ("de-mobiliz", "Cleanup"),
    ("top plate", "Cleanup"),
    ("pilaster patch", "Cleanup"),
    ("punch list", "Cleanup"),
    ("buck", "Install"),
    ("waterstop", "Install"),
    ("brace", "Install"),
    ("bracing", "Install"),
    ("crankup", "Install"),
    ("crank up", "Install"),
    ("staged", "Install"),
    ("stage", "Install"),
    ("install", "Install"),
    ("blocking", "Install"),
    ("radius", "Install"),
    ("insulated", "Install"),
    ("feb ", "Install"),
    ("arch", "Install"),
    ("plywood", "Install"),
    ("dovetail", "Install"),
    ("embed", "Install"),
    ("pocket", "Install"),
    ("corner", "Install"),
    ("safe room", "Install"),
    ("wall production", "Install"),
]

_COURSE_PREFIX_RE = re.compile(r"^\s*(1st|2nd|3rd|4th|5th)\b\s*[-–—:.]?\s*", re.IGNORECASE)

_HOURS_HEADER_HINTS = ("hrs", "hours", "labor", "man-hr", "manhr")
_QTY_HEADER_HINTS = ("qty", "quantity", "count", "each", "ea ", "lf", "sf")
_UNIT_HEADER_HINTS = {"lf": "LF", "sf": "SF", "ea": "EA", "hrs": "HRS", "hours": "HRS", "%": "%"}


def _clean(s: Any) -> str:
    if s is None:
        return ""
    return str(s).strip()


def _is_junk_text(s: str) -> bool:
    if not s:
        return True
    if s in _JUNK_VALUES:
        return True
    low = s.lower().strip()
    if low in _JUNK_TASK_TOKENS:
        return True
    # "X Totals" / "Foreman Total" / "Job Totals" patterns
    if low.endswith(" total") or low.endswith(" totals"):
        return True
    # Full names heuristic: 2 capitalized words, no digits, no ICF keywords
    if re.match(r"^[A-Z][a-z]+ [A-Z][a-z]+$", s.strip()):
        icf_words = {"buck", "wall", "layout", "pour", "strip", "clean", "post", "pre",
                     "load", "rebar", "brace", "form", "wall", "install", "top", "plate"}
        if not any(w in low for w in icf_words):
            return True
    return False


def _looks_like_task_name(v: Any) -> bool:
    """True if the cell has 4+ chars, at least one letter, and isn't junk."""
    if not isinstance(v, str):
        return False
    s = v.strip()
    if len(s) < 4 or _is_junk_text(s):
        return False
    if not any(c.isalpha() for c in s):
        return False
    return True


def _infer_category(name: str) -> str:
    low = name.lower()
    for kw, cat in _CATEGORY_KEYWORDS:
        if kw in low:
            return cat
    return "Other"


def _infer_course_and_clean_name(raw_name: str) -> Tuple[str, str]:
    """Strip 1st/2nd/3rd/4th/5th prefix and return (course, cleaned_name)."""
    m = _COURSE_PREFIX_RE.match(raw_name)
    if m:
        course = m.group(1).lower()
        cleaned = _COURSE_PREFIX_RE.sub("", raw_name).strip(" -–—:.")
        return course, cleaned
    return "all", raw_name.strip()


def _numeric(v: Any) -> Optional[float]:
    """Return a float if v is numeric-ish, else None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        # openpyxl sometimes returns bool for 0/1
        if isinstance(v, bool):
            return None
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(",", "").replace("$", "").replace("%", "")
        if not s or s in _JUNK_VALUES:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    return None


def _detect_task_column(headers: List[str], rows: List[List[Any]]) -> int:
    """Find the column that contains the most task-name-looking values.

    Falls back to column 0.
    """
    best_col, best_score = 0, -1
    for i in range(len(headers)):
        score = 0
        for row in rows[:400]:
            if i < len(row) and _looks_like_task_name(row[i]):
                score += 1
        if score > best_score:
            best_col, best_score = i, score
    return best_col


def _detect_hours_column(headers: List[str], rows: List[List[Any]], task_col: int) -> Optional[int]:
    """Find the column most likely holding estimated hours.

    Prefer columns whose header contains 'hrs'/'hours'/'labor'. Otherwise pick the
    numeric column with the smallest average (hours are usually smaller than qty).
    """
    # header hint pass
    for i, h in enumerate(headers):
        if i == task_col:
            continue
        low = _clean(h).lower()
        if any(hint in low for hint in _HOURS_HEADER_HINTS):
            return i
    return None


def _detect_qty_column(headers: List[str], rows: List[List[Any]], task_col: int, hours_col: Optional[int]) -> Optional[int]:
    for i, h in enumerate(headers):
        if i == task_col or i == hours_col:
            continue
        low = _clean(h).lower()
        if any(hint in low for hint in _QTY_HEADER_HINTS):
            return i
    return None


def _infer_unit_from_row(headers: List[str], row: List[Any], task_col: int) -> Optional[str]:
    """Look at header labels or row cells for LF/SF/EA/HRS/% markers."""
    # Check headers first
    for i, h in enumerate(headers):
        if i == task_col:
            continue
        low = _clean(h).lower()
        for k, unit in _UNIT_HEADER_HINTS.items():
            if k in low:
                return unit
    # Check cell values
    for cell in row:
        s = _clean(cell).upper()
        if s in ("LF", "SF", "EA", "HRS", "HOURS", "%"):
            return "HRS" if s == "HOURS" else s
    return None


# ── PUBLIC API ─────────────────────────────────────────────────────
def _sheet_rows_from_xlsx(file_bytes: bytes) -> List[Tuple[str, List[str], List[List[Any]]]]:
    """Yield (sheet_name, headers, rows) tuples from an xlsx.

    Auto-detect header row = first row with >=3 non-empty cells.
    """
    wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
    out = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        all_rows = list(ws.iter_rows(values_only=True))
        if not all_rows:
            continue
        header_idx = 0
        for idx, row in enumerate(all_rows[:20]):
            non_empty = sum(1 for c in row if c not in (None, ""))
            if non_empty >= 3:
                header_idx = idx
                break
        headers = [
            _clean(c) if c not in (None, "") else f"col_{i}"
            for i, c in enumerate(all_rows[header_idx])
        ]
        data_rows = [list(r) for r in all_rows[header_idx + 1:]]
        out.append((sheet_name, headers, data_rows))
    return out


def _sheet_rows_from_csv(file_bytes: bytes) -> List[Tuple[str, List[str], List[List[Any]]]]:
    text = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    all_rows = [r for r in reader if any(c.strip() for c in r)]
    if not all_rows:
        return []
    headers = [_clean(h) or f"col_{i}" for i, h in enumerate(all_rows[0])]
    data_rows = [list(r) for r in all_rows[1:]]
    return [("csv", headers, data_rows)]


def parse_and_map_tasks(
    file_bytes: bytes,
    filename: str,
    max_tasks: int = 500,
    task_col_override: Optional[str] = None,
    hours_col_override: Optional[str] = None,
    qty_col_override: Optional[str] = None,
) -> Dict[str, Any]:
    """Deterministically parse a CSV or XLSX and return {tasks, stats, columns, sheets}.

    If any *_override is provided, that column header is used instead of auto-detect.
    """
    filename = (filename or "").lower()
    if filename.endswith(".csv"):
        sheets = _sheet_rows_from_csv(file_bytes)
    else:
        sheets = _sheet_rows_from_xlsx(file_bytes)

    all_tasks: List[Dict[str, Any]] = []
    detected: Dict[str, Any] = {}
    all_columns: Dict[str, List[Dict[str, Any]]] = {}
    total_rows_scanned = 0

    for sheet_name, headers, rows in sheets:
        if not rows:
            continue
        # Build per-column sample values for the UI picker (first 3 non-empty)
        col_samples = []
        for i, h in enumerate(headers):
            samples = []
            for row in rows[:60]:
                if i < len(row):
                    v = _clean(row[i])
                    if v and v not in _JUNK_VALUES and v not in samples:
                        samples.append(v[:40])
                if len(samples) >= 3:
                    break
            col_samples.append({"index": i, "header": h, "samples": samples})
        all_columns[sheet_name] = col_samples

        # Resolve columns: override wins, else auto-detect
        def _find_col(name: Optional[str]) -> Optional[int]:
            if not name:
                return None
            for i, h in enumerate(headers):
                if h == name:
                    return i
            return None

        task_col = _find_col(task_col_override)
        if task_col is None:
            task_col = _detect_task_column(headers, rows)

        hours_col = _find_col(hours_col_override)
        if hours_col is None and hours_col_override is None:
            hours_col = _detect_hours_column(headers, rows, task_col)

        qty_col = _find_col(qty_col_override)
        if qty_col is None and qty_col_override is None:
            qty_col = _detect_qty_column(headers, rows, task_col, hours_col)

        detected[sheet_name] = {
            "task_column": headers[task_col] if 0 <= task_col < len(headers) else f"col_{task_col}",
            "hours_column": headers[hours_col] if (hours_col is not None and hours_col < len(headers)) else None,
            "qty_column": headers[qty_col] if (qty_col is not None and qty_col < len(headers)) else None,
        }

        for row in rows:
            total_rows_scanned += 1
            if len(all_tasks) >= max_tasks:
                break
            if task_col >= len(row):
                continue
            raw_name = _clean(row[task_col])
            if not _looks_like_task_name(raw_name):
                continue

            course, name = _infer_course_and_clean_name(raw_name)
            category = _infer_category(name)
            est_hours = _numeric(row[hours_col]) if (hours_col is not None and hours_col < len(row)) else None
            est_qty = _numeric(row[qty_col]) if (qty_col is not None and qty_col < len(row)) else None

            # Fallback: if no explicit columns, scan the whole row for numeric values.
            # Large values (>=20) → qty, small values (<20) → hours.
            if est_hours is None and est_qty is None:
                nums = []
                for i, cell in enumerate(row):
                    if i == task_col:
                        continue
                    n = _numeric(cell)
                    if n is not None and n > 0:
                        nums.append(n)
                if nums:
                    biggest = max(nums)
                    smallest = min(nums)
                    if biggest >= 20:
                        est_qty = biggest
                    if smallest < 20 and smallest != biggest:
                        est_hours = smallest

            # Zero values are useless — treat as None so tile shows "—"
            if est_hours == 0:
                est_hours = None
            if est_qty == 0:
                est_qty = None
            unit = _infer_unit_from_row(headers, row, task_col)

            all_tasks.append({
                "name": name[:200],
                "category": category,
                "course": course,
                "unit": unit,
                "estimated_hours": est_hours,
                "estimated_qty": est_qty,
                "source_row": None,
            })
        if len(all_tasks) >= max_tasks:
            break

    # Deduplicate by (normalized_name, course, category)
    seen: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for t in all_tasks:
        key = (t["name"].strip().lower(), t["course"], t["category"])
        if key not in seen:
            seen[key] = t
        else:
            # Merge: prefer non-null hours/qty from either occurrence
            existing = seen[key]
            if existing["estimated_hours"] is None and t["estimated_hours"] is not None:
                existing["estimated_hours"] = t["estimated_hours"]
            if existing["estimated_qty"] is None and t["estimated_qty"] is not None:
                existing["estimated_qty"] = t["estimated_qty"]
            if existing["unit"] is None and t["unit"] is not None:
                existing["unit"] = t["unit"]
    deduped = list(seen.values())

    # Sort by a stable category order then course then name
    cat_order = {c: i for i, c in enumerate(
        ["Precon", "Startup", "Layout", "Install", "Rebar", "Pour", "Strip", "Cleanup", "Other"]
    )}
    course_order = {"all": 0, "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5}
    deduped.sort(key=lambda t: (cat_order.get(t["category"], 99),
                                 course_order.get(t["course"], 9),
                                 t["name"].lower()))

    # Category counts (from deduped)
    counts: Dict[str, int] = {}
    for t in deduped:
        counts[t["category"]] = counts.get(t["category"], 0) + 1

    return {
        "tasks": deduped,
        "stats": {
            "rows_scanned": total_rows_scanned,
            "tasks_found": len(deduped),
            "raw_before_dedupe": len(all_tasks),
            "by_category": counts,
        },
        "detected_columns": detected,
        "sheets": all_columns,
    }
