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
  };
}

// ── Alpaca paper ─────────────────────────────────────────────────────────────
const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets/v2";

function alpacaHeaders(): Record<string, string> {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_API_KEY_ID ?? "",
    "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET_KEY ?? "",
    "Content-Type": "application/json",
  };
}

export const alpacaPaperBroker: BrokerAdapter = {
  id: "alpaca_paper",
  label: "Alpaca (paper)",
  requiredEnv: ["ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY"],
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
    return this.requiredEnv.every((k) => Boolean(process.env[k]));
  },
  unavailableReason() {
    const missing = this.requiredEnv.filter((k) => !process.env[k]);
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
    const filledAvg = num(data?.filled_avg_price);
    return {
      brokerOrderId: String(data?.id ?? ""),
      status: data?.status === "filled" ? "filled" : "accepted",
      filledQty: num(data?.filled_qty),
      filledAvgPriceCents: filledAvg == null ? null : dollarsToCents(filledAvg),
      submittedAt: Date.now(),
      raw: data,
    };
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
