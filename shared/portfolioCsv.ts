export interface PortfolioCsvRow {
  symbol: string;
  qty: number;
  avgCostCents?: number;
  marketValueCents?: number;
  error?: string;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function cells(line: string) {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

/**
 * Accepts common brokerage-export headings and the compact headerless format
 * documented in the account screen. Invalid rows remain visible to the caller;
 * they are never silently converted to zero holdings.
 */
export function parsePortfolioCsv(text: string): PortfolioCsvRow[] {
  const lines = text.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const first = cells(lines[0]);
  const normalized = first.map(normalizeHeader);
  const aliases = {
    symbol: ["symbol", "ticker", "security", "sym"],
    qty: ["qty", "quantity", "shares", "amount"],
    avgCost: ["avg_cost", "average_cost", "cost_basis_per_share", "avg_price", "price"],
    marketValue: ["market_value", "current_value", "value", "mkt_value"],
  };
  const indexOf = (names: string[]) => names.map((name) => normalized.indexOf(name)).find((index) => index >= 0) ?? -1;
  const header = indexOf(aliases.symbol) >= 0 || indexOf(aliases.qty) >= 0;
  const symbolIndex = header ? indexOf(aliases.symbol) : 0;
  const qtyIndex = header ? indexOf(aliases.qty) : 1;
  const avgCostIndex = header ? indexOf(aliases.avgCost) : 2;
  const marketValueIndex = header ? indexOf(aliases.marketValue) : 3;

  if (symbolIndex < 0 || qtyIndex < 0) {
    return [{ symbol: "", qty: 0, error: "CSV needs symbol/ticker and qty/shares columns." }];
  }

  return lines.slice(header ? 1 : 0).map((line) => {
    const row = cells(line);
    const symbol = (row[symbolIndex] ?? "").toUpperCase().replace(/\s+/g, "");
    const qty = Number(row[qtyIndex]);
    const avgCost = avgCostIndex >= 0 && row[avgCostIndex] !== "" ? Number(row[avgCostIndex]) : undefined;
    const marketValue = marketValueIndex >= 0 && row[marketValueIndex] !== "" ? Number(row[marketValueIndex]) : undefined;
    if (!symbol || !Number.isFinite(qty) || qty === 0) return { symbol, qty: 0, error: "Ticker and a non-zero quantity are required." };
    if (avgCost !== undefined && (!Number.isFinite(avgCost) || avgCost < 0)) return { symbol, qty, error: "Average cost is not a valid non-negative number." };
    if (marketValue !== undefined && !Number.isFinite(marketValue)) return { symbol, qty, error: "Market value is not a valid number." };
    return {
      symbol,
      qty,
      avgCostCents: avgCost === undefined ? undefined : Math.round(avgCost * 100),
      marketValueCents: marketValue === undefined ? undefined : Math.round(marketValue * 100),
    };
  });
}
