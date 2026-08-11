/**
 * Broker adapters: manual entry, Alpaca paper, and a declared Robinhood stub.
 *
 * The Robinhood stub is not laziness. Robinhood's Trading MCP opened to
 * third-party agents on 2026-05-27, but two facts make it unusable as a
 * server-side rail:
 *   1. it is an MCP server the USER'S OWN agent client connects to — there is no
 *      API key our backend can hold;
 *   2. agent trading is confined to a dedicated Agentic account, separate from
 *      the customer's existing accounts, so it cannot rebalance a real portfolio.
 * Encoding that in `capabilities` means the UI can explain it instead of
 * offering a connect button that cannot work.
 */
import { getDb } from "../../db";
import { portfolioAccounts, positions as positionsTable } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { httpJson, num } from "../providers/types";
import {
  assertPaperOnly, BrokerUnavailableError, dollarsToCents,
  type BrokerAccount, type BrokerAdapter, type BrokerPosition, type OrderRequest, type OrderResult,
} from "./types";

// ── Manual / CSV entry ───────────────────────────────────────────────────────
/** Reads whatever the operator entered. Always available; never executes. */
export function manualBroker(accountId: number): BrokerAdapter {
  return {
    id: "manual",
    label: "Manual entry",
    requiredEnv: [],
    capabilities: {
      serverSideExecution: false,
      paperTrading: false,
      liveTrading: false,
      readPositions: true,
      constraints: ["Positions are whatever you entered or imported — nothing is synced or verified against a broker."],
    },
    available: () => true,
    unavailableReason: () => null,

    async getAccount(): Promise<BrokerAccount> {
      const db = await getDb();
      if (!db) throw new BrokerUnavailableError("database unavailable");
      const rows = await db.select().from(portfolioAccounts).where(eq(portfolioAccounts.id, accountId)).limit(1);
      const a = rows[0];
      if (!a) throw new BrokerUnavailableError(`no portfolio account ${accountId}`);
      return {
        externalAccountId: a.externalAccountId,
        cashCents: a.cashCents,
        buyingPowerCents: a.buyingPowerCents ?? a.cashCents,
        equityValueCents: a.equityValueCents,
        isPaper: a.isPaper,
        asOf: a.lastSyncedAt ?? a.updatedAt,
      };
    },

    async getPositions(): Promise<BrokerPosition[]> {
      const db = await getDb();
      if (!db) throw new BrokerUnavailableError("database unavailable");
      const rows = await db.select().from(positionsTable).where(eq(positionsTable.accountId, accountId));
      return rows.map((p) => ({
        symbol: p.symbol,
        qty: p.qty,
        avgCostCents: p.avgCostCents,
        lastPriceCents: p.lastPriceCents,
        marketValueCents: p.marketValueCents,
        assetType: p.assetType as BrokerPosition["assetType"],
      }));
    },

    async submitOrder(): Promise<OrderResult> {
      throw new BrokerUnavailableError(
        "Manual accounts cannot execute. Connect a paper broker, or record the trade yourself.",
      );
    },

    async getOrders(): Promise<OrderResult[]> {
      return []; // a manual account has no order history to read back
    },

    async getOrder(): Promise<OrderResult | null> {
      return null;
    },
  };
}

/**
 * Alpaca's order JSON → our shape. Shared by submit and read-back.
 *
 * Alpaca has many more order states than we do, and the mapping matters: a
 * notional market order comes back `pending_new` on submit and only becomes
 * `filled` later. Anything not clearly accepted or terminal is `pending`, so a
 * caller never reads an in-flight order as done.
 */
export function toOrderResult(data: any): OrderResult {
  const filledAvg = num(data?.filled_avg_price);
  const status = String(data?.status ?? "");
  return {
    brokerOrderId: String(data?.id ?? ""),
    status:
      status === "filled" ? "filled"
        : status === "rejected" || status === "canceled" || status === "expired" ? "rejected"
        : status === "accepted" || status === "new" ? "accepted"
        : "pending",
    filledQty: num(data?.filled_qty),
    filledAvgPriceCents: filledAvg == null ? null : dollarsToCents(filledAvg),
    submittedAt: data?.submitted_at ? Date.parse(data.submitted_at) : Date.now(),
    raw: data,
  };
}

// ── Alpaca paper ─────────────────────────────────────────────────────────────
const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets/v2";

const ALPACA_KEY_ID_ENV = ["ALPACA_PAPER_KEY", "ALPACA_API_KEY_ID"] as const;
const ALPACA_SECRET_ENV = ["ALPACA_PAPER_SECRET", "ALPACA_API_SECRET_KEY"] as const;

function firstConfiguredEnv(names: readonly string[]): string | null {
  return names.map((name) => process.env[name]).find((value): value is string => Boolean(value)) ?? null;
}

function alpacaCredentials() {
  return {
    keyId: firstConfiguredEnv(ALPACA_KEY_ID_ENV),
    secret: firstConfiguredEnv(ALPACA_SECRET_ENV),
  };
}

function alpacaHeaders(): Record<string, string> {
  const credentials = alpacaCredentials();
  return {
    "APCA-API-KEY-ID": credentials.keyId ?? "",
    "APCA-API-SECRET-KEY": credentials.secret ?? "",
    "Content-Type": "application/json",
  };
}

export const alpacaPaperBroker: BrokerAdapter = {
  id: "alpaca_paper",
  label: "Alpaca (paper)",
  requiredEnv: ["ALPACA_PAPER_KEY", "ALPACA_PAPER_SECRET"],
  capabilities: {
    serverSideExecution: true,
    paperTrading: true,
    liveTrading: false,
    readPositions: true,
    constraints: [
      "Paper account only — fills are simulated and no real capital moves.",
      "Free market data is the delayed IEX feed, so paper fills are not a fair test of execution quality.",
    ],
  },
  available() {
    const credentials = alpacaCredentials();
    return Boolean(credentials.keyId && credentials.secret);
  },
  unavailableReason() {
    const credentials = alpacaCredentials();
    const missing = [
      !credentials.keyId ? "ALPACA_PAPER_KEY (or ALPACA_API_KEY_ID)" : null,
      !credentials.secret ? "ALPACA_PAPER_SECRET (or ALPACA_API_SECRET_KEY)" : null,
    ].filter(Boolean);
    return missing.length ? `not configured — missing ${missing.join(", ")}` : null;
  },

  async getAccount(): Promise<BrokerAccount> {
    const data = await httpJson<any>(`${ALPACA_PAPER_BASE}/account`, { headers: alpacaHeaders() });
    if (!data) throw new BrokerUnavailableError("Alpaca paper account request failed");
    const d = (v: unknown) => {
      const n = num(v);
      return n == null ? null : dollarsToCents(n);
    };
    return {
      externalAccountId: data.account_number ?? data.id ?? null,
      cashCents: d(data.cash),
      buyingPowerCents: d(data.buying_power),
      equityValueCents: d(data.equity),
      isPaper: true,
      asOf: Date.now(),
    };
  },

  async getPositions(): Promise<BrokerPosition[]> {
    const data = await httpJson<any[]>(`${ALPACA_PAPER_BASE}/positions`, { headers: alpacaHeaders() });
    if (!Array.isArray(data)) return [];
    return data.map((p) => {
      const cents = (v: unknown) => {
        const n = num(v);
        return n == null ? null : dollarsToCents(n);
      };
      return {
        symbol: String(p.symbol).toUpperCase(),
        qty: num(p.qty) ?? 0,
        avgCostCents: cents(p.avg_entry_price),
        lastPriceCents: cents(p.current_price),
        marketValueCents: cents(p.market_value),
        assetType: p.asset_class === "crypto" ? "crypto" : "equity",
      };
    });
  },

  async submitOrder(order: OrderRequest, opts: { isPaper: boolean }): Promise<OrderResult> {
    assertPaperOnly("Alpaca", opts.isPaper);
    if (!this.available()) throw new BrokerUnavailableError(this.unavailableReason() ?? "unavailable");

    const body: Record<string, unknown> = {
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce,
    };
    if (order.qty != null) body.qty = String(order.qty);
    else if (order.notionalCents != null) body.notional = String(order.notionalCents / 100);
    else throw new BrokerUnavailableError("an order needs either qty or notionalCents");
    if (order.type === "limit") {
      if (order.limitPriceCents == null) throw new BrokerUnavailableError("a limit order needs limitPriceCents");
      body.limit_price = String(order.limitPriceCents / 100);
    }

    const res = await fetch(`${ALPACA_PAPER_BASE}/orders`, {
      method: "POST",
      headers: alpacaHeaders(),
      body: JSON.stringify(body),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        brokerOrderId: "",
        status: "rejected",
        filledQty: null,
        filledAvgPriceCents: null,
        submittedAt: Date.now(),
        raw: data ?? { status: res.status },
      };
    }
    return toOrderResult(data);
  },

  async getOrders(opts: { limit?: number } = {}): Promise<OrderResult[]> {
    const limit = opts.limit ?? 25;
    const data = await httpJson<any[]>(
      `${ALPACA_PAPER_BASE}/orders?status=all&limit=${limit}&direction=desc`,
      { headers: alpacaHeaders() },
    );
    return Array.isArray(data) ? data.map(toOrderResult) : [];
  },

  async getOrder(brokerOrderId: string): Promise<OrderResult | null> {
    if (!brokerOrderId) return null;
    const data = await httpJson<any>(
      `${ALPACA_PAPER_BASE}/orders/${encodeURIComponent(brokerOrderId)}`,
      { headers: alpacaHeaders() },
    );
    return data ? toOrderResult(data) : null;
  },
};

// ── Robinhood (declared, not usable server-side) ─────────────────────────────
export const robinhoodMcpBroker: BrokerAdapter = {
  id: "robinhood_mcp",
  label: "Robinhood (Trading MCP)",
  requiredEnv: [],
  capabilities: {
    serverSideExecution: false,
    paperTrading: false,
    liveTrading: false,
    readPositions: false,
    constraints: [
      "Robinhood exposes an MCP server that your own agent client connects to — there is no API key this server can hold, so Signal Hunter cannot call it on your behalf.",
      "Agent trading is confined to a dedicated Agentic account, separate from your existing accounts. It cannot rebalance your main portfolio.",
      "Connect it in your own agent client and mirror the resulting positions here as a manual account.",
    ],
  },
  available: () => false,
  unavailableReason: () =>
    "Robinhood's rail is a user-connected MCP server, not a server-side API — see constraints.",
  async getAccount(): Promise<BrokerAccount> {
    throw new BrokerUnavailableError(robinhoodMcpBroker.unavailableReason()!);
  },
  async getPositions(): Promise<BrokerPosition[]> {
    throw new BrokerUnavailableError(robinhoodMcpBroker.unavailableReason()!);
  },
  async submitOrder(): Promise<OrderResult> {
    throw new BrokerUnavailableError(robinhoodMcpBroker.unavailableReason()!);
  },
  async getOrders(): Promise<OrderResult[]> {
    throw new BrokerUnavailableError(robinhoodMcpBroker.unavailableReason()!);
  },
  async getOrder(): Promise<OrderResult | null> {
    throw new BrokerUnavailableError(robinhoodMcpBroker.unavailableReason()!);
  },
};

/** Every rail, including the ones that cannot run — the UI shows all of them. */
export function listBrokers(): BrokerAdapter[] {
  return [manualBroker(0), alpacaPaperBroker, robinhoodMcpBroker];
}

export function brokerFor(brokerId: string, accountId: number): BrokerAdapter {
  switch (brokerId) {
    case "alpaca_paper": return alpacaPaperBroker;
    case "robinhood_mcp": return robinhoodMcpBroker;
    default: return manualBroker(accountId);
  }
}

export * from "./types";
