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
import { parseOccOptionSymbol } from "../../../shared/paperInstrument";
import {
  assertPaperOnly, BrokerUnavailableError, dollarsToCents,
  type BrokerAccount, type BrokerAdapter, type BrokerPosition, type OptionChainItem, type OptionChainQuery, type OptionContractResult, type OptionMarketSnapshotResult, type OrderRequest, type OrderResult,
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
      longOptions: false,
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
        optionsApprovedLevel: a.optionsApprovedLevel,
        optionsTradingLevel: a.optionsTradingLevel,
        optionsBuyingPowerCents: a.optionsBuyingPowerCents,
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
    async getOrderByClientOrderId(): Promise<OrderResult | null> {
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

/** Alpaca exact-option snapshot JSON → typed evidence stored with a proposal. */
export function toOptionMarketSnapshot(symbol: string, data: any, feed: "opra" | "indicative" = "opra"): OptionMarketSnapshotResult | null {
  const quote = data?.latestQuote;
  const trade = data?.latestTrade;
  const bid = num(quote?.bp);
  const ask = num(quote?.ap);
  const quoteAt = quote?.t ? Date.parse(String(quote.t)) : Number.NaN;
  const dailyVolume = num(data?.dailyBar?.v);
  const impliedVolatility = num(data?.impliedVolatility);
  if (!symbol || bid == null || ask == null || bid <= 0 || ask < bid || !Number.isFinite(quoteAt) || dailyVolume == null || dailyVolume < 0 || impliedVolatility == null || impliedVolatility <= 0) return null;
  const lastTradeAt = trade?.t ? Date.parse(String(trade.t)) : Number.NaN;
  const lastTradePrice = num(trade?.p);
  return {
    symbol: symbol.toUpperCase(),
    bidPriceCents: dollarsToCents(bid),
    askPriceCents: dollarsToCents(ask),
    bidSize: num(quote?.bs),
    askSize: num(quote?.as),
    quoteAt,
    lastTradePriceCents: lastTradePrice == null ? null : dollarsToCents(lastTradePrice),
    lastTradeSize: num(trade?.s),
    lastTradeAt: Number.isFinite(lastTradeAt) ? lastTradeAt : null,
    dailyVolume,
    impliedVolatility,
    feed,
    asOf: Date.now(),
  };
}

export function toOptionContractResult(data: any): OptionContractResult | null {
  const strike = num(data?.strike_price);
  const multiplier = num(data?.size);
  if (!data?.symbol || !data?.underlying_symbol || !data?.expiration_date || !strike || !multiplier) return null;
  return {
    symbol: String(data.symbol).toUpperCase(),
    underlyingSymbol: String(data.underlying_symbol).toUpperCase(),
    expirationDate: String(data.expiration_date),
    type: data.type === "put" ? "put" : "call",
    strikePriceCents: dollarsToCents(strike),
    multiplier,
    tradable: Boolean(data.tradable),
    status: String(data.status ?? "unknown"),
    openInterest: num(data.open_interest),
    openInterestAsOf: data.open_interest_date ? String(data.open_interest_date) : null,
    asOf: Date.now(),
  };
}

async function alpacaOptionSnapshots(symbols: string[]): Promise<Map<string, OptionMarketSnapshotResult>> {
  const normalized = symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean).slice(0, 100);
  const snapshots = new Map<string, OptionMarketSnapshotResult>();
  if (!normalized.length) return snapshots;
  for (const feed of ["opra", "indicative"] as const) {
    const url = new URL(`${ALPACA_OPTION_DATA_BASE}/snapshots`);
    url.searchParams.set("symbols", normalized.join(","));
    url.searchParams.set("feed", feed);
    const res = await fetch(url, { headers: alpacaHeaders() });
    if (res.status === 403 && feed === "opra") continue;
    if (!res.ok) throw new BrokerUnavailableError(`Alpaca option snapshot returned HTTP ${res.status}.`);
    const body: any = await res.json();
    for (const symbol of normalized) {
      if (snapshots.has(symbol)) continue;
      const market = toOptionMarketSnapshot(symbol, body?.snapshots?.[symbol], feed);
      if (market) snapshots.set(symbol, market);
    }
    if (snapshots.size === normalized.length || feed === "indicative") break;
  }
  return snapshots;
}

// ── Alpaca paper ─────────────────────────────────────────────────────────────
const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets/v2";
const ALPACA_OPTION_DATA_BASE = "https://data.alpaca.markets/v1beta1/options";

const ALPACA_KEY_ID_ENV = ["ALPACA_PAPER_KEY", "ALPACA_API_KEY_ID"] as const;
const ALPACA_SECRET_ENV = ["ALPACA_PAPER_SECRET", "ALPACA_API_SECRET_KEY"] as const;
const ALPACA_READ_ATTEMPTS = 3;

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

/**
 * Account and position reads can fail transiently at the TLS/network edge. The
 * sync must never turn that into a blank or stale-looking "successful" result:
 * retry a bounded number of read-only times, then report a usable reason.
 */
async function alpacaReadJson<T>(path: "/account" | "/positions"): Promise<T> {
  let lastFailure = "network connection failure";
  for (let attempt = 1; attempt <= ALPACA_READ_ATTEMPTS; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(`${ALPACA_PAPER_BASE}${path}`, {
        signal: ctrl.signal,
        headers: {
          ...alpacaHeaders(),
          Accept: "application/json",
          "User-Agent": "SignalHunterOS/1.0 (paper account sync)",
        },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 401 || res.status === 403) {
        throw new BrokerUnavailableError(`Alpaca Paper credentials were not accepted (HTTP ${res.status}). Update the configured paper key and secret, then retry.`);
      }
      lastFailure = `Alpaca Paper returned HTTP ${res.status}`;
    } catch (error) {
      if (error instanceof BrokerUnavailableError) throw error;
      lastFailure = error instanceof DOMException && error.name === "AbortError"
        ? "Alpaca Paper timed out"
        : "Alpaca Paper network/TLS connection failed";
    } finally {
      clearTimeout(timer);
    }
    if (attempt < ALPACA_READ_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 120));
  }
  throw new BrokerUnavailableError(`${lastFailure} after ${ALPACA_READ_ATTEMPTS} read-only attempts. No account snapshot was changed; try Sync again.`);
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
    longOptions: true,
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
    const data = await alpacaReadJson<any>("/account");
    const d = (v: unknown) => {
      const n = num(v);
      return n == null ? null : dollarsToCents(n);
    };
    return {
      externalAccountId: data.account_number ?? data.id ?? null,
      cashCents: d(data.cash),
      buyingPowerCents: d(data.buying_power),
      equityValueCents: d(data.equity),
      optionsApprovedLevel: num(data.options_approved_level),
      optionsTradingLevel: num(data.options_trading_level),
      optionsBuyingPowerCents: d(data.options_buying_power),
      isPaper: true,
      asOf: Date.now(),
    };
  },

  async getPositions(): Promise<BrokerPosition[]> {
    const data = await alpacaReadJson<any[]>("/positions");
    if (!Array.isArray(data)) throw new BrokerUnavailableError("Alpaca Paper positions response was not an array. No account snapshot was changed; try Sync again.");
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
        assetType: p.asset_class === "crypto" ? "crypto" : p.asset_class === "us_option" ? "option" : "equity",
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
    if (order.clientOrderId) body.client_order_id = order.clientOrderId;
    if (order.instrumentType === "long_call" || order.instrumentType === "long_put") {
      body.position_intent = "buy_to_open";
    }
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

  async getOrderByClientOrderId(clientOrderId: string): Promise<OrderResult | null> {
    if (!clientOrderId) return null;
    const res = await fetch(`${ALPACA_PAPER_BASE}/orders:by_client_order_id?client_order_id=${encodeURIComponent(clientOrderId)}`, {
      headers: alpacaHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new BrokerUnavailableError(`Alpaca Paper order reconciliation returned HTTP ${res.status}.`);
    return toOrderResult(await res.json());
  },

  async getOptionContract(symbol: string): Promise<OptionContractResult | null> {
    const res = await fetch(`${ALPACA_PAPER_BASE}/options/contracts/${encodeURIComponent(symbol)}`, {
      headers: alpacaHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new BrokerUnavailableError(`Alpaca Paper option-contract verification returned HTTP ${res.status}.`);
    const data: any = await res.json();
    const contract = toOptionContractResult(data);
    if (!contract) {
      throw new BrokerUnavailableError("Alpaca Paper returned an incomplete option-contract record.");
    }
    return contract;
  },

  async getOptionMarketSnapshot(symbol: string): Promise<OptionMarketSnapshotResult | null> {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return null;
    for (const feed of ["opra", "indicative"] as const) {
      const url = new URL(`${ALPACA_OPTION_DATA_BASE}/snapshots`);
      url.searchParams.set("symbols", normalized);
      url.searchParams.set("feed", feed);
      const res = await fetch(url, { headers: alpacaHeaders() });
      if (res.status === 403 && feed === "opra") continue;
      if (!res.ok) throw new BrokerUnavailableError(`Alpaca option snapshot returned HTTP ${res.status}.`);
      const body: any = await res.json();
      const market = toOptionMarketSnapshot(normalized, body?.snapshots?.[normalized], feed);
      if (market) return market;
    }
    return null;
  },

  async getOptionChain(query: OptionChainQuery): Promise<OptionChainItem[]> {
    const url = new URL(`${ALPACA_PAPER_BASE}/options/contracts`);
    url.searchParams.set("underlying_symbols", query.underlyingSymbol.trim().toUpperCase());
    url.searchParams.set("expiration_date", query.expirationDate);
    url.searchParams.set("type", query.type);
    url.searchParams.set("status", "active");
    url.searchParams.set("limit", String(Math.min(100, Math.max(1, query.limit ?? 40))));
    if (query.strikePriceGteCents != null) url.searchParams.set("strike_price_gte", (query.strikePriceGteCents / 100).toFixed(2));
    if (query.strikePriceLteCents != null) url.searchParams.set("strike_price_lte", (query.strikePriceLteCents / 100).toFixed(2));
    const body = await httpJson<any>(url.toString(), { headers: alpacaHeaders() });
    const contracts: OptionContractResult[] = (Array.isArray(body?.option_contracts) ? body.option_contracts : [])
      .map(toOptionContractResult)
      .filter((contract: OptionContractResult | null): contract is OptionContractResult => Boolean(contract?.tradable));
    const snapshots = await alpacaOptionSnapshots(contracts.map((contract) => contract.symbol));
    return contracts.map((contract) => ({ contract, market: snapshots.get(contract.symbol) ?? null }));
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
    longOptions: false,
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
  async getOrderByClientOrderId(): Promise<OrderResult | null> {
    throw new BrokerUnavailableError(robinhoodMcpBroker.unavailableReason()!);
  },
};

function isExactIsolatedUatRuntime(): boolean {
  if (process.env.NODE_ENV !== "development" || process.env.ISOLATED_UAT_MODE !== "true") return false;
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return url.protocol === "mysql:" && url.hostname === "127.0.0.1" && url.port === "3307"
      && url.pathname === "/capital_aperture_uat_9c18799" && url.username === "uat_app";
  } catch {
    return false;
  }
}

/** Deterministic paper adapter available only in the exact loopback UAT lane. */
export function isolatedUatPaperBroker(accountId: number): BrokerAdapter {
  return {
    id: "uat_paper",
    label: "Isolated UAT Paper",
    requiredEnv: ["ISOLATED_UAT_MODE"],
    capabilities: {
      serverSideExecution: true,
      paperTrading: true,
      liveTrading: false,
      readPositions: true,
      longOptions: true,
      constraints: ["Exact loopback UAT database only; deterministic fills; never registered in production."],
    },
    available: isExactIsolatedUatRuntime,
    unavailableReason: () => isExactIsolatedUatRuntime() ? null : "available only in the exact isolated CH Capital development UAT runtime",
    async getAccount() {
      if (!isExactIsolatedUatRuntime()) throw new BrokerUnavailableError("isolated UAT paper adapter refused outside its exact loopback runtime");
      return manualBroker(accountId).getAccount();
    },
    async getPositions() {
      if (!isExactIsolatedUatRuntime()) throw new BrokerUnavailableError("isolated UAT paper adapter refused outside its exact loopback runtime");
      return manualBroker(accountId).getPositions();
    },
    async submitOrder(order, opts) {
      assertPaperOnly("Isolated UAT Paper", opts.isPaper);
      if (!isExactIsolatedUatRuntime()) throw new BrokerUnavailableError("isolated UAT paper adapter refused outside its exact loopback runtime");
      const fillPrice = order.limitPriceCents;
      if (fillPrice == null) throw new BrokerUnavailableError("deterministic UAT paper orders require an exact limit price");
      return {
        brokerOrderId: `uat-paper-${order.clientOrderId ?? Date.now()}`,
        status: "filled",
        filledQty: order.qty ?? null,
        filledAvgPriceCents: fillPrice,
        submittedAt: Date.now(),
        raw: { fixture: true, isolated: true, instrumentType: order.instrumentType ?? "shares" },
      };
    },
    async getOrders() { return []; },
    async getOrder() { return null; },
    async getOrderByClientOrderId() { return null; },
    async getOptionContract(symbol) {
      if (!isExactIsolatedUatRuntime()) throw new BrokerUnavailableError("isolated UAT paper adapter refused outside its exact loopback runtime");
      const parsed = parseOccOptionSymbol(symbol);
      if (!parsed) return null;
      return {
        symbol: parsed.contractSymbol,
        underlyingSymbol: parsed.underlyingSymbol,
        expirationDate: parsed.expirationDate,
        type: parsed.instrumentType === "long_call" ? "call" : "put",
        strikePriceCents: parsed.strikePriceCents,
        multiplier: parsed.contractMultiplier,
        tradable: true,
        status: "active_uat_fixture",
        openInterest: 100,
        openInterestAsOf: new Date().toISOString().slice(0, 10),
        asOf: Date.now(),
      };
    },
    async getOptionMarketSnapshot(symbol) {
      if (!isExactIsolatedUatRuntime()) throw new BrokerUnavailableError("isolated UAT paper adapter refused outside its exact loopback runtime");
      return {
        symbol: symbol.toUpperCase(), bidPriceCents: 100, askPriceCents: 110,
        bidSize: 10, askSize: 10, quoteAt: Date.now(),
        lastTradePriceCents: 105, lastTradeSize: 1, lastTradeAt: Date.now(),
        dailyVolume: 100, impliedVolatility: 0.3, feed: "opra", asOf: Date.now(),
      };
    },
  };
}

/** Every rail, including the ones that cannot run — the UI shows all of them. */
export function listBrokers(): BrokerAdapter[] {
  return [manualBroker(0), alpacaPaperBroker, robinhoodMcpBroker, ...(isExactIsolatedUatRuntime() ? [isolatedUatPaperBroker(0)] : [])];
}

export function brokerFor(brokerId: string, accountId: number): BrokerAdapter {
  switch (brokerId) {
    case "alpaca_paper": return alpacaPaperBroker;
    case "robinhood_mcp": return robinhoodMcpBroker;
    case "uat_paper": return isolatedUatPaperBroker(accountId);
    default: return manualBroker(accountId);
  }
}

export * from "./types";
