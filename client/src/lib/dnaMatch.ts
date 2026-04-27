/**
 * DNA Match Score Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes a 0–100 compatibility score between a deal and an investor's DNA
 * strand profile. Four weighted dimensions:
 *
 *   Sector Affinity   30 pts  — does the deal's industry align with the investor's sectors?
 *   Deal Size Fit     25 pts  — does the asking price fall within the investor's range?
 *   Risk Alignment    25 pts  — does the deal's AI score match the investor's risk appetite?
 *   IRR Proxy         20 pts  — does the cash-on-cash yield meet the investor's return target?
 *
 * Each dimension returns 0–max_pts; total is clamped to [0, 100].
 */

export interface DnaProfile {
  riskTolerance: number | null | undefined;   // 0–1
  timeHorizon: number | null | undefined;     // 0–1
  liquidityNeed: number | null | undefined;   // 0–1
  esgConviction: number | null | undefined;   // 0–1
  sectorAffinity: string[] | null | undefined;
}

export interface DealForMatch {
  industry?: string | null;
  askingPrice?: number | null;
  cashFlow?: number | null;
  score?: number | null;          // aiScore 0–1
}

export interface DnaMatchResult {
  total: number;            // 0–100 integer
  sectorPts: number;        // 0–30
  sizePts: number;          // 0–25
  riskPts: number;          // 0–25
  irrPts: number;           // 0–20
  label: "Strong Match" | "Good Match" | "Partial Match";
  tier: "strong" | "good" | "partial";
}

// ─── Sector matching ──────────────────────────────────────────────────────────
// Normalise strings for fuzzy comparison (lowercase, strip punctuation)
function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function sectorScore(industry: string | null | undefined, sectors: string[] | null | undefined): number {
  if (!industry || !sectors || sectors.length === 0) return 0;
  const dealNorm = norm(industry);
  for (const s of sectors) {
    const sNorm = norm(s);
    // Full match
    if (dealNorm === sNorm) return 30;
    // One contains the other
    if (dealNorm.includes(sNorm) || sNorm.includes(dealNorm)) return 28;
    // Share a meaningful keyword (≥5 chars)
    const dealWords = dealNorm.split(" ").filter((w) => w.length >= 5);
    const sWords = sNorm.split(" ").filter((w) => w.length >= 5);
    if (dealWords.some((w) => sWords.includes(w))) return 18;
  }
  return 0;
}

// ─── Deal size fit ────────────────────────────────────────────────────────────
// Default target range: $500K – $5M (SBA acquisition sweet-spot).
// Investors with high risk tolerance stretch to $10M; low risk pulls to $2M.
function sizeScore(askingPrice: number | null | undefined, riskTol: number | null | undefined): number {
  if (!askingPrice || askingPrice <= 0) return 12; // unknown → neutral
  const risk = riskTol ?? 0.5;
  const minTarget = 300_000;
  const maxTarget = 2_000_000 + risk * 8_000_000; // $2M–$10M sliding with risk

  if (askingPrice >= minTarget && askingPrice <= maxTarget) return 25;

  // Partial credit for being close
  const midpoint = (minTarget + maxTarget) / 2;
  const spread = (maxTarget - minTarget) / 2;
  const distance = Math.abs(askingPrice - midpoint);
  const ratio = Math.max(0, 1 - distance / (spread * 2));
  return Math.round(ratio * 25);
}

// ─── Risk alignment ───────────────────────────────────────────────────────────
// High AI score → lower-risk deal. High risk tolerance investor wants higher-risk
// (lower-scored) deals. We reward alignment between the two.
function riskScore(aiScore: number | null | undefined, riskTol: number | null | undefined): number {
  if (aiScore == null) return 12; // unknown → neutral
  const risk = riskTol ?? 0.5;
  // Invert aiScore: a deal with score 0.9 is "safe" (low risk), score 0.5 is "riskier"
  const dealRisk = 1 - aiScore;
  // Alignment = 1 - |investorRisk - dealRisk|
  const alignment = 1 - Math.abs(risk - dealRisk);
  return Math.round(alignment * 25);
}

// ─── IRR proxy ────────────────────────────────────────────────────────────────
// Cash-on-cash = cashFlow / askingPrice. Target: 20% (0.20).
// High time-horizon investors accept lower current yield (patient capital).
function irrScore(cashFlow: number | null | undefined, askingPrice: number | null | undefined, timeHorizon: number | null | undefined): number {
  if (!cashFlow || !askingPrice || askingPrice <= 0) return 10; // unknown → neutral
  const coc = cashFlow / askingPrice;
  const horizon = timeHorizon ?? 0.5;
  // Adjust target yield downward for patient capital (long horizon → accepts 12%)
  const targetYield = 0.20 - horizon * 0.08; // 0.12–0.20
  // Score: full 20 pts at or above target, scales down linearly to 0 at half target
  if (coc >= targetYield) return 20;
  if (coc <= 0) return 0;
  const ratio = coc / targetYield;
  return Math.round(ratio * 20);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function computeDnaMatchScore(deal: DealForMatch, dna: DnaProfile): DnaMatchResult {
  const sectorPts = sectorScore(deal.industry, dna.sectorAffinity);
  const sizePts = sizeScore(deal.askingPrice, dna.riskTolerance);
  const riskPts = riskScore(deal.score, dna.riskTolerance);
  const irrPts = irrScore(deal.cashFlow, deal.askingPrice, dna.timeHorizon);

  const total = Math.min(100, Math.max(0, sectorPts + sizePts + riskPts + irrPts));

  const tier: DnaMatchResult["tier"] =
    total >= 80 ? "strong" : total >= 60 ? "good" : "partial";
  const label: DnaMatchResult["label"] =
    tier === "strong" ? "Strong Match" : tier === "good" ? "Good Match" : "Partial Match";

  return { total, sectorPts, sizePts, riskPts, irrPts, label, tier };
}
