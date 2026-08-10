/**
 * Memo fact-validator — the teeth behind the honesty contract.
 *
 * A language model handed a fact ledger and told "use only these numbers" will
 * mostly comply, and will occasionally produce a confident, well-formatted,
 * completely invented figure. Prompt wording is not a control. This is:
 * every financial number in generated prose must trace back to a fact row, or
 * the memo is rejected rather than shipped.
 *
 * SCOPE — deliberately narrow, so it fails on fabrication and not on English.
 * A token is treated as a financial claim when it carries a marker:
 *   currency ($1.2B, $4,500,000)   percent (12.5%)   multiple (31x)
 *   magnitude word/suffix (4.2 billion, 900K)
 *   or a bare number >= 1000 that is not a plausible year
 * Bare small integers ("three catalysts", "2 of its 5 segments") are prose, not
 * claims, and do not fail a memo. Years are excluded because a wrong year is a
 * different and much smaller problem than an invented revenue figure — and
 * catching them here would reject almost every real memo.
 */
import type { SecurityFact } from "../../drizzle/schema";

/**
 * One reading of a numeric token, with the tolerance implied by how precisely it
 * was WRITTEN. "31x" claims two significant figures and is satisfied by a 31.2
 * fact; "31.0x" is not. Tolerance therefore comes from the token, never from the
 * fact — otherwise a vaguer memo would be held to a tighter standard.
 */
export interface ClaimReading {
  value: number;
  tolerance: number;
}

export interface NumericClaim {
  /** The token exactly as it appeared. */
  raw: string;
  /** Readings this token could plausibly mean (a percent has two). */
  candidates: ClaimReading[];
  /** Surrounding text, so a rejection message is actionable. */
  context: string;
  index: number;
}

export interface ValidationResult {
  ok: boolean;
  claims: NumericClaim[];
  offenders: NumericClaim[];
  /** Human-readable, stored in aperture_candidates.memo_reject_reason. */
  reason: string | null;
}

const MAGNITUDES: Record<string, number> = {
  k: 1e3, thousand: 1e3,
  m: 1e6, mm: 1e6, million: 1e6,
  b: 1e9, bn: 1e9, billion: 1e9,
  t: 1e12, trillion: 1e12,
};

/**
 * $1.2B · 4,500,000 · 12.5% · 31x · 4.2 billion · 900K
 * Captures: currency? number magnitude-suffix? unit-suffix?  |  number magnitude-word
 */
// The \b belongs INSIDE the optional magnitude group. Without it, the "t" of
// "7th" reads as "trillion" and a ranking becomes a 7,000,000,000,000 claim;
// with it outside, "31x" stops matching because there is no boundary between
// "1" and "x".
const CLAIM_RE = new RegExp(
  String.raw`(\$)?\s?(\d[\d,]*(?:\.\d+)?)\s*(?:(k|mm|m|bn|b|t|thousand|million|billion|trillion)\b)?\s*(%|x\b)?`,
  "gi",
);

/** Half a unit of the last digit actually written, scaled by any magnitude. */
export function toleranceFor(digits: string, magnitude: number): number {
  const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
  return 0.5 * Math.pow(10, -decimals) * magnitude;
}

const isPlausibleYear = (n: number, raw: string) =>
  Number.isInteger(n) && n >= 1900 && n <= 2100 && !/[.,$%]/.test(raw) && !/[a-z]/i.test(raw);

/** Pull every financial-looking number out of prose. */
export function extractClaims(text: string): NumericClaim[] {
  const claims: NumericClaim[] = [];
  CLAIM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = CLAIM_RE.exec(text)) !== null) {
    const [full, dollar, digits, magWord, unitSuffix] = m;
    if (!digits) continue;

    const base = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;

    const mag = magWord ? MAGNITUDES[magWord.toLowerCase()] ?? 1 : 1;
    const hasCurrency = Boolean(dollar);
    const isPct = unitSuffix === "%";
    const isMultiple = unitSuffix != null && unitSuffix.toLowerCase().startsWith("x");
    const hasMarker = hasCurrency || isPct || isMultiple || Boolean(magWord);

    // Not a financial claim: bare small number, or a year.
    if (!hasMarker && base < 1000) continue;
    if (!hasMarker && isPlausibleYear(base, digits)) continue;

    const scaled = base * mag;
    const tol = toleranceFor(digits, mag);
    // A percent may be stored either as 0..1 or 0..100. Accept either reading —
    // and scale the tolerance with it, so "44%" allows ±0.5 or ±0.005.
    const candidates: ClaimReading[] = isPct
      ? [{ value: scaled, tolerance: tol }, { value: scaled / 100, tolerance: tol / 100 }]
      : [{ value: scaled, tolerance: tol }];

    claims.push({
      raw: full.trim(),
      candidates,
      context: text.slice(Math.max(0, m.index - 40), m.index + full.length + 40).replace(/\s+/g, " ").trim(),
      index: m.index,
    });
  }
  return claims;
}

/** Every magnitude the ledger actually supports, in every unit reading. */
export function allowedValues(facts: SecurityFact[]): number[] {
  const out: number[] = [];
  for (const f of facts) {
    if (f.basis === "unknown") continue; // an unknown backs nothing
    if (f.valueNum != null && Number.isFinite(f.valueNum)) {
      const v = f.valueNum;
      out.push(v);
      // ratio 0.44 also legitimately reads as "44%", and vice versa.
      if (f.unit === "ratio") out.push(v * 100);
      if (f.unit === "pct") out.push(v / 100);
    }
    // Numbers stated inside a textual fact are sourced too.
    if (f.valueText) {
      for (const c of extractClaims(f.valueText)) out.push(...c.candidates.map((r) => r.value));
    }
  }
  return out;
}

/**
 * "$1.23B" is an honest rendering of 1,234,567,890, so an exact match would
 * reject every well-written memo. A claim is satisfied when the fact falls
 * within the precision the claim was written to.
 */
export function matchesFact(claim: number, fact: number, tolerance: number): boolean {
  return Math.abs(claim - fact) <= tolerance;
}

/**
 * Validate generated memo prose against the ledger it was built from.
 * `text` may be a string or a memo object — object values are flattened.
 */
export function validateMemoNumbers(memo: unknown, facts: SecurityFact[]): ValidationResult {
  const text = flattenText(memo);
  const claims = extractClaims(text);
  const allowed = allowedValues(facts);

  const offenders = claims.filter(
    (c) => !c.candidates.some((cand) => allowed.some((a) => matchesFact(cand.value, a, cand.tolerance))),
  );

  const reason = offenders.length
    ? `${offenders.length} figure(s) in this memo do not trace to a sourced fact: ` +
      offenders.slice(0, 5).map((o) => `"${o.raw}" (…${o.context}…)`).join("; ") +
      (offenders.length > 5 ? ` …and ${offenders.length - 5} more` : "")
    : null;

  return { ok: offenders.length === 0, claims, offenders, reason };
}

/** Collect every string in a nested memo object into one blob. */
export function flattenText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(flattenText).join("\n");
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).map(flattenText).join("\n");
  return "";
}
