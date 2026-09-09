// Deterministic tolerance check for instant field feedback (mirrors backend/tolerance.py)
function parseNumber(token) {
  if (token === null || token === undefined) return null;
  const t = String(token).trim();
  if (!t) return null;
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/); // mixed "1 1/4"
  if (m) return parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/); // fraction "1/8"
  if (m) return parseInt(m[1]) / parseInt(m[2]);
  const f = parseFloat(t);
  return isNaN(f) ? null : f;
}

function numbersWithPos(s) {
  const re = /\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|\.\d+/g;
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const v = parseNumber(m[0]);
    if (v !== null) out.push([v, m.index]);
  }
  return out;
}

function firstNumber(s) {
  const n = numbersWithPos(String(s));
  return n.length ? n[0][0] : null;
}

export function evaluateTolerance(measuredStr, toleranceStr) {
  if (!measuredStr || !toleranceStr) return { status: "unknown" };
  const measured = firstNumber(measuredStr);
  if (measured === null) return { status: "unknown" };

  let t = String(toleranceStr).toLowerCase()
    .replace(/\+\/-/g, "±").replace(/plus or minus/g, "±").replace(/plus\/minus/g, "±").replace(/\+-/g, "±");
  const nums = numbersWithPos(t);
  const eps = 1e-6;

  const idx = t.indexOf("±");
  if (idx !== -1) {
    const after = nums.filter(([, i]) => i > idx).map(([v]) => v);
    const before = nums.filter(([, i]) => i < idx).map(([v]) => v);
    if (after.length) {
      const band = after[0];
      const nominal = before.length ? before[0] : 0;
      const lo = nominal - band, hi = nominal + band;
      const status = measured >= lo - eps && measured <= hi + eps ? "in" : "out";
      return { status, nominal, band, low: lo, high: hi, measured };
    }
  }
  if (["≥", ">=", "at least", "minimum", "min ", "no less"].some((k) => t.includes(k)) && nums.length) {
    const nominal = nums[0][0];
    return { status: measured >= nominal - eps ? "in" : "out", nominal, measured, bound: "min" };
  }
  if (["≤", "<=", "no more than", "maximum", "max ", "at most", "up to"].some((k) => t.includes(k)) && nums.length) {
    const nominal = nums[0][0];
    return { status: measured <= nominal + eps ? "in" : "out", nominal, measured, bound: "max" };
  }
  return { status: "unknown", measured };
}
