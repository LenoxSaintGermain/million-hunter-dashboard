/**
 * A missing source-derived level is a research gap, never a zero-valued level.
 * Keep this message shared so preflight and final proposal creation explain the
 * same boundary in operator language.
 */
export function missingIntradayRecipeMessage(input: {
  holdingPeriod?: string | null;
  entryPriceCents?: number | null;
  stopPriceCents?: number | null;
  slippageCents?: number | null;
  timeStopAt?: number | null;
  noTradeConditions?: string[] | null;
}): string | null {
  if (input.holdingPeriod !== "intraday") return null;
  const missing: string[] = [];
  if (!(typeof input.entryPriceCents === "number" && input.entryPriceCents > 0)) missing.push("entry");
  if (!(typeof input.stopPriceCents === "number" && input.stopPriceCents > 0)) missing.push("stop");
  if (!(typeof input.slippageCents === "number" && input.slippageCents >= 0)) missing.push("slippage");
  if (!(typeof input.timeStopAt === "number" && Number.isFinite(input.timeStopAt))) missing.push("time stop");
  if (!input.noTradeConditions?.length) missing.push("no-trade conditions");
  if (!missing.length) return null;
  return `No paper proposal yet — current session tape has not produced a measurable ${missing.join(", ")}. Return to evidence and wait for a source-backed intraday recipe.`;
}
