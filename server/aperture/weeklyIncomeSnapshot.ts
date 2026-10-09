/**
 * Frozen option-structure snapshot for a Weekly Income slate item (#86).
 * Captured once from a screen candidate; deep-frozen so later code cannot
 * edit it. Persistence onto slate items is a follow-up (needs #9 storage).
 */
import type { SpreadCandidate } from "./weeklyIncomeScreen";

export type WiStructureSnapshot = Readonly<{
  schema: "weekly_income.structure.v1";
  structure: "P1";
  underlying: string;
  expiration: string;
  dte: number;
  legs: ReadonlyArray<Readonly<{ occSymbol: string; side: "sell" | "buy"; positionIntent: "sell_to_open" | "buy_to_open"; strikeCents: number; delta: number | null; openInterest: number | null; bidAskPct: number | null; bidCents: number | null; askCents: number | null; impliedVolatility: number | null; feed: "opra" | "indicative" | null; quoteAt: number | null }>>;
  creditCents: number;
  widthCents: number;
  contracts: number | null;
  maxLossPerContractCents: number;
  maxLossTotalCents: number | null;
  /** A defined-risk spread cannot lose more than its width, so gap-stress loss equals max loss. */
  gapStressLossCents: number | null;
  lossAtStopCents: number | null;
  eventStatus: Readonly<{ earnings: string; exDividend: string }>;
  bindingCap: string;
  parameterSetId: string;
  parameterHash: string;
  capturedAt: number;
  snapshotBasis: "live_capture";
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) deepFreeze((value as any)[key]);
    Object.freeze(value);
  }
  return value;
}

export function freezeSpreadSnapshot(candidate: SpreadCandidate, meta: { parameterSetId: string; parameterHash: string; capturedAt: number; earnings: string; bindingCap: string; lossAtStopCents?: number | null }): WiStructureSnapshot {
  const leg = (l: SpreadCandidate["short"], side: "sell" | "buy") => ({
    occSymbol: l.symbol, side, positionIntent: side === "sell" ? "sell_to_open" as const : "buy_to_open" as const, strikeCents: l.strikeCents,
    delta: l.delta, openInterest: l.openInterest, bidAskPct: l.spreadPct, bidCents: l.bidCents, askCents: l.askCents,
    impliedVolatility: l.impliedVolatility, feed: l.feed, quoteAt: l.quoteAt,
  });
  return deepFreeze({
    schema: "weekly_income.structure.v1",
    structure: "P1",
    underlying: candidate.underlying,
    expiration: candidate.expiration,
    dte: candidate.dte,
    legs: [leg(candidate.short, "sell"), leg(candidate.long, "buy")],
    creditCents: candidate.creditCents,
    widthCents: candidate.widthCents,
    contracts: candidate.contracts,
    maxLossPerContractCents: candidate.maxLossPerContractCents,
    maxLossTotalCents: candidate.maxLossTotalCents,
    gapStressLossCents: candidate.maxLossTotalCents,
    lossAtStopCents: meta.lossAtStopCents ?? null,
    eventStatus: { earnings: meta.earnings, exDividend: "not applicable to P1" },
    bindingCap: meta.bindingCap,
    parameterSetId: meta.parameterSetId,
    parameterHash: meta.parameterHash,
    capturedAt: meta.capturedAt,
    snapshotBasis: "live_capture",
  } as const);
}
