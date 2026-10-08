import type { ReactNode } from "react";
import { SixPercentNote, WeeklyIncomeGlossary, WeeklyIncomeIntro, WeeklyIncomeSpreadExplainer } from "../../../client/src/components/aperture/weeklyIncome/WeeklyIncomeGuide";
import { WI_EXAMPLE_SPREAD, buildGuidedSpreadExplainer } from "../../../shared/weeklyIncome/guided";
import { WeeklyIncomeTemplatePanel, WeeklyIncomeTemplatePicker } from "../../../client/src/components/aperture/weeklyIncome/WeeklyIncomeTemplatePanel";
import { weeklyIncomeDefaults } from "../../../shared/strategyTemplates/weeklyIncome";
import { WeeklyIncomeSkipped } from "../../../client/src/components/aperture/weeklyIncome/WeeklyIncomeSkipped";
import { WeeklyIncomeScreenResults, type WiScreenResult } from "../../../client/src/components/aperture/weeklyIncome/WeeklyIncomeCandidates";
import { rankCandidates, screenUnderlying, type ChainRow } from "../../../server/aperture/weeklyIncomeScreen";
import { WeeklyIncomeScorecardView } from "../../../client/src/components/aperture/weeklyIncome/WeeklyIncomeScorecardView";
import { buildWeeklyIncomeScorecard, weeklyIncomeHistory, type WiPositionRecord, type WiWeekInput } from "../../../shared/weeklyIncomeScorecard";

// Example data: hypothetical tickers and dates for the blackout states.
const SKIPPED = [
  { symbol: "XYZ", plain: "XYZ reports results on Mon, Oct 19, before this trade would end. Prices can jump on results day, so we skip it.", detail: "Earnings 2026-10-19 falls inside 2026-10-12..2026-10-19 (expiration + 1 session).", source: { name: "Operator-entered", url: "https://example.invalid/ir", recordedBy: "fixture" } },
  { symbol: "ABC", plain: "We don't know when ABC next reports results, so we skip it. Surprise moves around a report can be large.", detail: "No upcoming earnings date on record.", source: null },
];

const FIXTURE_MANDATE = { version: "v2", maxPlannedRiskPctPerPlay: 0.75, maxAggregateOpenRiskPct: 3, maxDailyPlannedRiskPct: 2, maxCorrelatedPlannedRiskPct: 1.25, maxWeeklyPlannedRiskPct: 4, minAdvUsd30d: 20_000_000 };

const example = buildGuidedSpreadExplainer(WI_EXAMPLE_SPREAD);

// Example data: hypothetical XYZ/ABC chains run through the real screen code. Not market data.
const FIX_NOW = Date.parse("2026-10-12T15:00:00Z");
function fixturePut(underlying: string, strike: number, bid: number, ask: number, delta: number | null, oi = 1200): ChainRow {
  const symbol = `${underlying}261016P${String(Math.round(strike * 1000)).padStart(8, "0")}`;
  return {
    contract: { symbol, underlyingSymbol: underlying, expirationDate: "2026-10-16", type: "put", strikePriceCents: Math.round(strike * 100), multiplier: 100, tradable: true, status: "active", openInterest: oi, openInterestAsOf: "2026-10-09", asOf: FIX_NOW },
    market: { symbol, bidPriceCents: Math.round(bid * 100), askPriceCents: Math.round(ask * 100), bidSize: 10, askSize: 10, quoteAt: FIX_NOW - 5000, lastTradePriceCents: null, lastTradeSize: null, lastTradeAt: null, dailyVolume: 300, impliedVolatility: 0.31, delta, gamma: null, theta: null, vega: null, feed: "opra", asOf: FIX_NOW },
  };
}
const fixEvents = { eligible: true, earningsWindow: { from: "2026-10-12", to: "2026-10-19" }, nextEarnings: null, exclusions: [] };
function fixtureScreen(regularSession: boolean): WiScreenResult {
  const ctx = { params: weeklyIncomeDefaults(), now: FIX_NOW, regularSession, equityCents: 10_000_000 /* $100,000 example balance */, expirationLabel: () => "Fri Oct 16", timeExitLabel: () => "Thu Oct 15 15:30 ET" };
  const xyz = screenUnderlying({ symbol: "XYZ", priceCents: 10_000, advUsd: 400_000_000 }, [{ date: "2026-10-16", dte: 4, events: fixEvents, rows: [fixturePut("XYZ", 95, 0.95, 1.05, -0.2), fixturePut("XYZ", 92.5, 0.57, 0.63, -0.12)] }], ctx);
  const abc = screenUnderlying({ symbol: "ABC", priceCents: 4_200, advUsd: 180_000_000 }, [{ date: "2026-10-16", dte: 4, events: fixEvents, rows: [fixturePut("ABC", 40, 0.48, 0.52, -0.24), fixturePut("ABC", 39, 0.29, 0.31, -0.15, 800), fixturePut("ABC", 41, 0.80, 0.84, -0.33)] }], ctx);
  const low = screenUnderlying({ symbol: "LMN", priceCents: 6_000, advUsd: 30_000_000 }, [], ctx);
  return { asOf: FIX_NOW, session: regularSession ? "regular" : "closed", refusal: null, candidates: rankCandidates([...xyz.candidates, ...abc.candidates], 10), skipped: [...xyz.skipped, ...abc.skipped, ...low.skipped, { symbol: "DEF", plain: "We don't know when DEF next reports results, so we skip it. Surprise moves around a report can be large.", detail: "Earnings source unavailable; next report date unknown.", source: null }] };
}
// Example data: hypothetical fixture week (3 take-profits, 1 stop, 1 time exit). Not real fills.
const WK = Date.parse("2026-10-12T04:00:00Z");
const HR = 3_600_000;
const wpos = (id: string, credit: number, contracts: number, debit: number, maxLoss: number, open: number, close: number, exitReason: WiPositionRecord["exitReason"], basis: WiPositionRecord["basis"] = "paper_fill"): WiPositionRecord => ({ id, underlying: id, basis, openedAt: WK + open * HR, closedAt: WK + close * HR, contracts, openingCreditCents: credit, closingDebitCents: debit, markDebitCents: null, markAsOf: null, maxLossCents: maxLoss * 100, feesCents: 0, exitReason });
const fixtureWeek = (basis: WiPositionRecord["basis"], over: Partial<WiWeekInput> = {}): WiWeekInput => ({
  weekOf: "2026-10-12", weekStartMs: WK, weekEndMs: WK + 100 * HR, mondayEquityCents: 5_000_000, mondayEquityAsOf: WK, asOf: WK + 100 * HR, skippedReasons: ["earnings", "earnings", "liquidity", "delta"],
  positions: [wpos("XYZ", 40, 2, 20, 440, 0, 50, "take_profit", basis), wpos("ABC", 50, 1, 25, 210, 0, 100, "take_profit", basis), wpos("DEF", 30, 3, 15, 240, 0, 25, "take_profit", basis), wpos("GHI", 40, 2, 80, 440, 50, 100, "stop", basis), wpos("JKL", 45, 1, 30, 215, 0, 100, "time_exit", basis)],
  ...over,
});
const fixtureHistory = weeklyIncomeHistory([{ weekOf: "2026-10-05", returnOnAccount: 0.0009 }, { weekOf: "2026-10-12", returnOnAccount: -0.003 }, { weekOf: "2026-10-19", returnOnAccount: 0.002 }]).display;
const refused = (code: "opra_not_entitled" | "options_level", plain: string, detail: string): WiScreenResult => ({ asOf: FIX_NOW, session: "regular", refusal: { code, plain, detail }, candidates: [], skipped: [] });

/** Each scenario is one Guided-mode state. Later PRs append their states here. */
export const SCENARIOS: Record<string, { title: string; render: () => ReactNode }> = {
  "intro": { title: "What Weekly Income is (Guided intro)", render: () => <WeeklyIncomeIntro /> },
  "worked-example": { title: "Worked example: put credit spread (Example data)", render: () => ("error" in example ? <p>{example.error}</p> : <WeeklyIncomeSpreadExplainer explainer={example} />) },
  "glossary": { title: "Words used here, in plain English", render: () => <section className="border p-5" style={{ borderColor: "var(--rule)", background: "var(--paper)" }}><WeeklyIncomeGlossary open /></section> },
  "six-percent": { title: "Weekly target note (mission setup)", render: () => <section className="border p-4 text-sm" style={{ borderColor: "var(--rule)", background: "var(--paper)" }}><p className="font-semibold">6% per week required · aggressive</p><p className="mt-1" style={{ color: "var(--sh-fg-muted)" }}>$600 target ÷ $10,000 declared mission capital (Example data). An aspiration, not a forecast; it never increases allowed risk.</p><SixPercentNote /></section> },
  "template-picker": { title: "New Capital thesis: template choice", render: () => <WeeklyIncomeTemplatePicker onUse={() => undefined} /> },
  "template-guided": { title: "Weekly Income template chosen (Guided)", render: () => <WeeklyIncomeTemplatePanel parameters={weeklyIncomeDefaults()} isGuided onRemove={() => undefined} showExample={false} /> },
  "template-pro": { title: "Weekly Income template chosen (Pro parameter table)", render: () => <WeeklyIncomeTemplatePanel parameters={weeklyIncomeDefaults()} mandate={FIXTURE_MANDATE} parameterHash="sha256:fixture-not-a-real-hash" isGuided={false} /> },
  "skipped-guided": { title: "Skipped by a blackout (Guided, Example data)", render: () => <WeeklyIncomeSkipped items={SKIPPED} isGuided /> },
  "skipped-pro": { title: "Skipped by a blackout (Pro, Example data)", render: () => <WeeklyIncomeSkipped items={SKIPPED} isGuided={false} /> },
  "week-empty": { title: "No idea met every rule (Guided)", render: () => <WeeklyIncomeSkipped items={[]} isGuided /> },
  "screen-guided": { title: "This week's research ideas (Guided, Example data)", render: () => <WeeklyIncomeScreenResults result={fixtureScreen(true)} isGuided isExample /> },
  "screen-pro": { title: "Research screen (Pro, Example data)", render: () => <WeeklyIncomeScreenResults result={fixtureScreen(true)} isGuided={false} isExample /> },
  "screen-closed": { title: "Market closed preview (Guided, Example data)", render: () => <WeeklyIncomeScreenResults result={{ ...fixtureScreen(false), candidates: fixtureScreen(false).candidates.slice(0, 1) }} isGuided isExample /> },
  "screen-refused-opra": { title: "Refused: delayed prices only (Guided)", render: () => <WeeklyIncomeScreenResults result={refused("opra_not_entitled", "This account only sees delayed, indicative option prices. Weekly Income needs live OPRA prices, so nothing is shown.", "Option quotes are indicative; OPRA not entitled")} isGuided /> },
  "scorecard-guided": { title: "Weekly scorecard (Guided, Example data)", render: () => <WeeklyIncomeScorecardView scorecard={buildWeeklyIncomeScorecard(fixtureWeek("paper_fill"), "paper_fill")} isGuided isExample /> },
  "scorecard-pro": { title: "Weekly scorecard (Pro, Example data)", render: () => <WeeklyIncomeScorecardView scorecard={buildWeeklyIncomeScorecard(fixtureWeek("paper_fill"), "paper_fill")} isGuided={false} isExample history={fixtureHistory} /> },
  "scorecard-counterfactual": { title: "Counterfactual scorecard (Guided, Example data)", render: () => <WeeklyIncomeScorecardView scorecard={buildWeeklyIncomeScorecard(fixtureWeek("counterfactual"), "counterfactual")} isGuided isExample /> },
  "scorecard-not-measured": { title: "Scorecard without measured account value (Guided, Example data)", render: () => <WeeklyIncomeScorecardView scorecard={buildWeeklyIncomeScorecard(fixtureWeek("paper_fill", { mondayEquityCents: null }), "paper_fill")} isGuided isExample /> },
  "screen-refused-level": { title: "Refused: options level (Pro)", render: () => <WeeklyIncomeScreenResults result={refused("options_level", "This account isn't approved for floor-protected option trades (spreads) yet.", "Options level 2 < 3")} isGuided={false} /> },
};
