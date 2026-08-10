/**
 * Broker abstraction.
 *
 * Jim does not have "a Robinhood portfolio" — he has capital, held somewhere.
 * Every surface above this layer sees positions and buying power, never a
 * vendor. That was worth building on day one regardless of which rail ships
 * first.
 *
 * ⚠️ NO ADAPTER IN THIS BUILD TRADES REAL MONEY. `capabilities.liveTrading` is
 * false everywhere, and `submitOrder` refuses when `isPaper` is false. Enabling
 * live deployment is a separate, explicit decision — not a config flag someone
 * flips by accident.
 */
export interface BrokerCapabilities {
  /** Can our SERVER call this broker with a key? Robinhood cannot: it is an MCP
   *  server the user's own agent client connects to, not a REST API. */
  serverSideExecution: boolean;
  /** Paper fills. */
  paperTrading: boolean;
  /** Deliberately false across every adapter here. */
  liveTrading: boolean;
  /** Can we read positions and balances programmatically? */
  readPositions: boolean;
  /** Anything the operator must know before choosing this rail. */
  constraints: string[];
}

export interface BrokerAccount {
  externalAccountId: string | null;
  cashCents: number | null;
  buyingPowerCents: number | null;
  equityValueCents: number | null;
  isPaper: boolean;
  /** When the broker says this was true. */
  asOf: number;
}

export interface BrokerPosition {
  symbol: string;
  qty: number;
  avgCostCents: number | null;
  lastPriceCents: number | null;
  marketValueCents: number | null;
  assetType: "equity" | "etf" | "option" | "crypto" | "cash";
}

export interface OrderRequest {
  symbol: string;
  side: "buy" | "sell";
  /** Whole or fractional shares. Exactly one of qty / notionalCents. */
  qty?: number;
  notionalCents?: number;
  type: "market" | "limit";
  limitPriceCents?: number;
  timeInForce: "day" | "gtc";
}

export interface OrderResult {
  brokerOrderId: string;
  status: "accepted" | "filled" | "rejected" | "pending";
  filledQty: number | null;
  filledAvgPriceCents: number | null;
  submittedAt: number;
  raw?: unknown;
}

export class BrokerUnavailableError extends Error {}
export class LiveTradingRefusedError extends Error {}

export interface BrokerAdapter {
  id: string;
  label: string;
  capabilities: BrokerCapabilities;
  /** Env vars required for server-side calls. Empty for manual entry. */
  requiredEnv: string[];
  available(): boolean;
  /** Why it cannot run, for the UI. Null when it can. */
  unavailableReason(): string | null;
  getAccount(): Promise<BrokerAccount>;
  getPositions(): Promise<BrokerPosition[]>;
  submitOrder(order: OrderRequest, opts: { isPaper: boolean }): Promise<OrderResult>;
}

/** The single gate every adapter routes order submission through. */
export function assertPaperOnly(brokerLabel: string, isPaper: boolean): void {
  if (!isPaper) {
    throw new LiveTradingRefusedError(
      `${brokerLabel}: live trading is not enabled in this build. ` +
        `Capital Aperture operates in recommendation and paper modes only; ` +
        `enabling real capital deployment is a separate decision, not a config change.`,
    );
  }
}

export const dollarsToCents = (d: number): number => Math.round(d * 100);
export const centsToDollars = (c: number): number => c / 100;
