export interface StrategyAllocationRow {
  symbol: string;
  dollarsCents: number;
  pctOfDeployable: number;
  lowCents?: number;
  highCents?: number;
}

/**
 * Older saved postures can contain the same security via multiple thesis paths.
 * For display, a posture needs one row per security. Values are consolidated
 * rather than silently dropped so the historical modeled exposure is preserved.
 */
export function consolidateStrategyAllocations(rows: StrategyAllocationRow[]): StrategyAllocationRow[] {
  const bySymbol = new Map<string, StrategyAllocationRow>();
  for (const row of rows) {
    const prior = bySymbol.get(row.symbol);
    if (!prior) {
      bySymbol.set(row.symbol, { ...row });
      continue;
    }
    bySymbol.set(row.symbol, {
      ...prior,
      dollarsCents: prior.dollarsCents + row.dollarsCents,
      pctOfDeployable: prior.pctOfDeployable + row.pctOfDeployable,
      lowCents: (prior.lowCents ?? 0) + (row.lowCents ?? 0),
      highCents: (prior.highCents ?? 0) + (row.highCents ?? 0),
    });
  }
  return Array.from(bySymbol.values());
}
