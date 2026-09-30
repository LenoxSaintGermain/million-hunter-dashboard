import type { AlignmentMeasure } from "./alignmentPortrait";

// Public presentation fixtures only; never imported by production scoring or orders.
// Acquisition numbers from sanctioned ground-truth-deals.json / GT-001.
export const HUNTER_EXAMPLE = { name: "Apex Commercial Cleaning", asking: 2_100_000, cash: 720_000, addBacks: 223_000 } as const;
export type HunterJourney = "asset" | "capital";
export function walkthroughModel(path: HunterJourney, change: number) {
  const bounded = Math.max(-80, Math.min(30, Number.isFinite(change) ? change : 0));
  const principal = HUNTER_EXAMPLE.asking * .7;
  const monthly = .1 / 12;
  const debt = principal * monthly / (1 - Math.pow(1 + monthly, -120)) * 12;
  const cash = HUNTER_EXAMPLE.cash * (1 + bounded / 100);
  return { change: bounded, debt, cash, coverage: cash / debt, remainder: cash - debt,
    cost: 1000, value: 1000 * (1 + bounded / 100), pnl: 1000 * bounded / 100, path };
}
export function walkthroughMeasures(path: HunterJourney, change: number): AlignmentMeasure[] {
  const model = walkthroughModel(path, change);
  if (path === "capital") return [
    { id: "allocation", label: "Sample allocation", value: 1000, min: 0, max: 1000, unit: "usd", basis: "modeled", wanted: "Bounded allocation", explanation: "Ten hypothetical shares at $100. No real security, market quote or linked account. $1,000 is a sample ceiling, not a personal recommendation." },
    { id: "value", label: "Scenario value", value: model.value, min: 0, max: 1000, unit: "usd", basis: "modeled", wanted: "Test the downside", explanation: `10 × $100 × (1 + ${model.change} / 100). Excludes fees, dividends and taxes. Band shows the original allocation, not a success target.` },
    { id: "catalyst", label: "Thesis condition", value: null, unit: "number", basis: "unknown", wanted: "Evidence of demand", explanation: "A plausible demand story is not evidence of earnings durability. This example includes no market research." },
    { id: "risk", label: "Execution condition", value: null, unit: "number", basis: "unknown", wanted: "Approved risk boundary", explanation: "Account identity, freshness, exposure limits and explicit human approval remain separate gates. Nothing here submits an order." },
  ];
  return [
    { id: "asking", label: "Asking price", value: HUNTER_EXAMPLE.asking, min: 1_000_000, max: 5_000_000, unit: "usd", basis: "reported", wanted: "Price in range", explanation: "GT-001 composite asking price. $1M–$5M is an illustrative search band, not your saved thesis." },
    { id: "cash", label: "Scenario cash flow", value: model.cash, min: 300_000, max: 1_000_000, unit: "usd", basis: "modeled", wanted: "Durable cash flow", explanation: `$720,000 stated SDE × (1 + ${model.change} / 100). SDE is not independently verified free cash flow. The $300k–$1M band is illustrative.` },
    { id: "contracts", label: "Revenue condition", value: null, unit: "number", basis: "unknown", wanted: "Transferable contracts", explanation: "GT-001 describes top-two customer concentration of 54%. Contract durability needs review; fitting the financial band does not resolve it." },
    { id: "handover", label: "People condition", value: null, unit: "number", basis: "unknown", wanted: "Management continuity", explanation: "GT-001 describes an owner working 55–60 hours a week without an operations manager. Cost the replacement role before relying on reported earnings." },
  ];
}
