import type { TacticalMarketThesis, TradePlayBlueprint } from "./playUnderwriting";

/**
 * Prefill for the existing paper-ticket builder (ManualOrderTicketModal) from a
 * Mission-result play. Presentation only: opening the builder creates nothing.
 * Staging still needs the operator's PAPER acknowledgement, and the server's
 * order gates stay authoritative for staging, approval and sending.
 */
export type PaperTicketPrefill = {
  symbol: string;
  direction: "long" | "short";
  expression: "shares" | "long_call" | "long_put";
  runId: number;
  holdingPeriod: "intraday" | "swing" | "catalyst_window" | "position";
  /** Blank when not measured, so no placeholder price is staged by accident. */
  limitPrice: string;
  strikePrice?: string;
  expirationDate?: string;
  quantity?: number;
  invalidationCondition: string;
  reason: string;
};

export type PaperTicketReadiness =
  | { state: "ready"; prefill: PaperTicketPrefill }
  | { state: "unavailable"; reason: string };

const HOLDING: Record<TradePlayBlueprint["horizon"], PaperTicketPrefill["holdingPeriod"]> = {
  intraday: "intraday", overnight: "swing", swing: "swing", catalyst_window: "catalyst_window", position: "position",
};

export function paperTicketReadiness(input: {
  play: TradePlayBlueprint;
  thesis: TacticalMarketThesis | null;
  selectedPlayId: string | null;
  researchRunId: number | null;
  now?: number;
}): PaperTicketReadiness {
  const { play, thesis, selectedPlayId, researchRunId } = input;
  const now = input.now ?? Date.now();
  if (selectedPlayId !== play.id || researchRunId == null) {
    return { state: "unavailable", reason: selectedPlayId != null && selectedPlayId !== play.id
      ? "Only the play selected for research can be prepared as a paper ticket."
      : "Check this idea first. A paper ticket is prepared from the play's research run." };
  }
  if (play.status === "invalidated" || play.status === "expired" || (play.killAt != null && play.killAt <= now)) {
    return { state: "unavailable", reason: "This play is no longer valid. Revise the Mission before preparing a ticket." };
  }
  if (play.instrument.kind === "debit_spread") {
    return { state: "unavailable", reason: "Spreads can't be prepared as a single paper ticket here. No single leg will be substituted." };
  }
  const expression = play.instrument.kind;
  const bearish = expression === "long_put" || thesis?.direction === "bearish";
  const entry = play.entry?.high ?? play.entry?.low ?? null;
  const shares = expression === "shares";
  // Underlying entry is not an option premium; options keep price blank.
  const limitPrice = shares && entry != null && entry > 0 ? entry.toFixed(2) : "";
  const quantity = shares && entry != null && entry > 0 && play.sizing.proposedNotionalCents > 0
    ? Math.floor(play.sizing.proposedNotionalCents / Math.round(entry * 100)) : undefined;
  const option = play.instrument.kind === "long_call" || play.instrument.kind === "long_put" ? play.instrument : null;
  const stop = play.invalidation.price != null ? ` Modeled stop $${play.invalidation.price.toFixed(2)}.` : "";
  return { state: "ready", prefill: {
    symbol: play.underlyingSymbol || play.symbol,
    direction: bearish ? "short" : "long",
    expression,
    runId: researchRunId,
    holdingPeriod: HOLDING[play.horizon] ?? "swing",
    limitPrice,
    strikePrice: option ? option.strike != null ? option.strike.toFixed(2) : "" : undefined,
    expirationDate: option?.expiration ?? undefined,
    quantity: quantity != null && quantity > 0 ? quantity : undefined,
    invalidationCondition: `${play.invalidation.description}${stop}`,
    reason: `Prepared from Mission result: ${play.title}. Prices and size are modeled references from the saved analysis; confirm them before staging.`,
  } };
}
