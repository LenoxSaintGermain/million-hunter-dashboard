import { buildOccOptionSymbol } from "./paperInstrument";

/**
 * One payload for the Play Desk "Draft Paper Ticket" dialog, used for both the
 * server preflight (guardrail checklist, Refs #118) and order.create, so the
 * checklist always evaluates exactly the ticket that would be staged.
 */
export type ManualTicketFields = {
  accountId: number | null | undefined;
  symbol: string;
  expression: string;
  direction: "long" | "short";
  shareCount: number;
  contracts: number;
  limitPrice: string;
  strikePrice: string;
  spreadUpperStrike: string;
  expirationDate: string;
  reason: string;
  invalidationCondition: string;
  holdingPeriod: "intraday" | "swing" | "catalyst_window" | "position";
  catalystDays: number;
  notionalCents: number;
  runId?: number;
  candidateId?: number;
  now: number;
};

export function buildManualTicketPayload(f: ManualTicketFields) {
  if (!f.accountId) return { ok: false as const, error: "Choose a paper account." };
  const cleanSymbol = f.symbol.trim().toUpperCase();
  if (!cleanSymbol) return { ok: false as const, error: "Enter a ticker symbol." };
  const isOption = f.expression !== "shares";
  const numLimitPrice = parseFloat(f.limitPrice) || 0;
  const numStrike = parseFloat(f.strikePrice) || 0;
  const numUpperStrike = parseFloat(f.spreadUpperStrike) || 0;
  let contractSymbol = cleanSymbol;
  let instrumentType: "shares" | "long_call" | "long_put" = "shares";
  if (isOption) {
    const optionType = f.expression === "long_put" || f.expression === "bear_put_spread" ? "put" : "call";
    instrumentType = optionType === "put" ? "long_put" : "long_call";
    const occ = buildOccOptionSymbol({ underlyingSymbol: cleanSymbol, expirationDate: f.expirationDate, optionType, strikePriceCents: Math.round(numStrike * 100) });
    if (!occ) return { ok: false as const, error: "Could not construct standard OCC option symbol. Check strike and expiration format." };
    contractSymbol = occ;
  }
  const structuredReason = `[${f.expression.toUpperCase()} EXPR] ${f.reason} · Target: $${numUpperStrike || numStrike} · Structure: ${f.expression.replaceAll("_", " ")}`;
  return {
    ok: true as const,
    payload: {
      accountId: f.accountId,
      symbol: contractSymbol,
      underlyingSymbol: isOption ? cleanSymbol : undefined,
      instrumentType,
      optionExpirationDate: isOption ? f.expirationDate : undefined,
      optionStrikePriceCents: isOption ? Math.round(numStrike * 100) : undefined,
      contractMultiplier: isOption ? 100 : undefined,
      side: (isOption ? "buy" : f.direction === "long" ? "buy" : "sell") as "buy" | "sell",
      intent: "open" as const,
      qty: isOption ? f.contracts : f.shareCount,
      notionalCents: !isOption ? f.notionalCents : undefined,
      orderType: "limit" as const,
      limitPriceCents: Math.round(numLimitPrice * 100),
      timeInForce: "day" as const,
      reason: structuredReason,
      invalidationCondition: f.invalidationCondition || "Break of structural support or catalyst expiry",
      holdingPeriod: f.holdingPeriod,
      catalystDeadlineAt: f.now + f.catalystDays * 86_400_000,
      paperAcknowledgement: "PAPER" as const,
      runId: f.runId,
      candidateId: f.candidateId,
    },
  };
}
