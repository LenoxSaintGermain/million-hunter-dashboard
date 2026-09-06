export type MarketAvailabilityContext = {
  session?: "regular" | "pre_market" | "after_hours" | "closed" | "unknown" | null;
  nextRegularSessionOpenAt?: number | null;
  referencePriceCents?: number | null;
  referenceAsOf?: number | null;
};

function price(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function referenceLabel(context: MarketAvailabilityContext) {
  if (context.referencePriceCents == null || context.referencePriceCents <= 0) {
    return "No verified price reference is available.";
  }
  const asOf = context.referenceAsOf == null
    ? ""
    : ` from ${new Date(context.referenceAsOf).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}`;
  return `Last verified price reference: ${price(context.referencePriceCents)}${asOf}. Reference only—not a live entry quote.`;
}

export function marketAvailabilityCopy(rawReason: string | null | undefined, context: MarketAvailabilityContext = {}) {
  const reason = rawReason?.trim() || "Required market inputs are not measurable.";
  const minuteTapeMissing = /no\s+(?:sip|iex)?\s*minute bars returned|no minute bars/i.test(reason);
  const outsideRegularSession = context.session != null && context.session !== "regular" && context.session !== "unknown";
  const nextOpen = context.nextRegularSessionOpenAt == null
    ? ""
    : ` Retry after ${new Date(context.nextRegularSessionOpenAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}.`;

  if (minuteTapeMissing && outsideRegularSession) {
    return {
      title: "Market closed · live entry locked",
      summary: `${referenceLabel(context)} Live SIP minute bars and selectable option quotes remain locked until the regular session.${nextOpen}`,
      providerDetail: reason,
    };
  }
  if (minuteTapeMissing) {
    return {
      title: "Live market data unavailable",
      summary: `${referenceLabel(context)} Retry the feed before selecting an entry or contract.`,
      providerDetail: reason,
    };
  }
  return {
    title: "This play cannot move yet",
    summary: reason,
    providerDetail: null,
  };
}
