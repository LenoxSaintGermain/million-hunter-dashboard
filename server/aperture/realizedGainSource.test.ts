import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { BrokerOrder, PortfolioAccount } from "../../drizzle/schema";
import { STALE_ACCOUNT_MS } from "../../shared/cockpitRailSummary";
import { readRealizedGainSource } from "./realizedGainSource";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
const NOW = Date.UTC(2026, 8, 9, 18);
const target = { accountId: 11, runId: 21, candidateId: 31, orderId: 41 };
const account = (): PortfolioAccount => ({ id: 11, userId: 7, label: "Illustrative paper account", brokerId: "alpaca_paper", externalAccountId: "fixture-paper", isPaper: true, cashCents: 1_180_000, buyingPowerCents: 5_000_000, equityValueCents: 9_000_000, lastSyncedAt: NOW - 100, syncSource: "alpaca_paper", syncError: null, createdAt: NOW - 2000, updatedAt: NOW - 100 } as PortfolioAccount);
const order = (): BrokerOrder => ({ id: 41, userId: 7, accountId: 11, runId: 21, candidateId: 31, portfolioContextAccountId: 12, decisionRunId: 51, decisionRevisionId: 61, symbol: "PWR", instrumentType: "shares", side: "sell", intent: "close", qty: 100, filledQty: 100, filledAvgPriceCents: 11_825, brokerOrderId: "broker-close", clientOrderId: "request-close", status: "filled", dispatchError: null, filledAt: NOW - 500, createdAt: NOW - 1000, updatedAt: NOW - 500 } as BrokerOrder);
const joined = () => ({ account: account(), order: order(), run: { id: 21, userId: 7, thesisId: 71, createdAt: NOW - 2000 }, candidate: { id: 31, runId: 21 } });
const snapshot = () => ({ id: 81, accountId: 11, runId: 21, symbol: "PWR", avgCostCents: 10_000, unrealizedPnlCents: 180_000, priceBasis: "verified", snapshotAt: NOW - 100, createdAt: NOW - 100 });

function database(row: ReturnType<typeof joined> | null = joined(), mark: ReturnType<typeof snapshot> | null = snapshot()) {
  const reads: Array<{ table: string; joins: string[]; sorted: boolean; sql?: { sql: string; params: unknown[] } }> = [];
  const forbidden = vi.fn(() => { throw new Error("No mutation permitted"); });
  const db = { insert: forbidden, update: forbidden, delete: forbidden, transaction: forbidden, execute: forbidden, select: vi.fn(() => {
    const read = { table: "", joins: [], sorted: false } as typeof reads[number];
    reads.push(read);
    const query = { from: vi.fn(table => { read.table = getTableName(table); return query; }), innerJoin: vi.fn(table => { read.joins.push(getTableName(table)); return query; }), where: vi.fn(predicate => { read.sql = new MySqlDialect().sqlToQuery(predicate); return query; }), orderBy: vi.fn(() => { read.sorted = true; return query; }), limit: vi.fn(async () => read.table === "broker_orders" ? row ? [row] : [] : mark ? [mark] : []) };
    return query;
  }) };
  mocks.getDb.mockResolvedValue(db);
  return { db, reads, forbidden };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); mocks.getDb.mockReset(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No provider call permitted"); })); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("read-only realized-gains source from actual persisted records", () => {
  it("refuses to turn the $1,200 narrative fixture into verified gains from aggregate order/mark/account rows", async () => {
    const row = joined(), mark = snapshot(), before = structuredClone({ row, mark });
    const { forbidden } = database(row, mark);
    const result = await readRealizedGainSource(7, target);
    expect(result).toMatchObject({ status: "missing_evidence", source: null, verifiedDeployableCents: null, realizedProfitLossCents: null, netSaleProceedsCents: null, recordedCostBasisCents: null, feesCents: null, reserveCents: null, alreadyAllocatedCents: null, mayIncreaseRiskBudget: false });
    expect(result.observations?.modeledGrossSaleProceedsCents).toBe(1_182_500);
    expect(result.observations?.positionMark).toBeNull();
    expect(result.missingEvidence.map(g => g.code)).toEqual(expect.arrayContaining(["closing_fill_ledger_missing", "attributed_cost_basis_missing", "fees_missing", "reconciliation_missing", "availability_missing", "reserve_policy_missing", "allocation_ledger_missing"]));
    expect({ row, mark }).toEqual(before);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("reads only the exact owned order lifecycle, without a position-mark lookup or inferred secondary lineage", async () => {
    const { db, reads } = database();
    const result = await readRealizedGainSource(7, target);
    expect(reads.map(r => r.table)).toEqual(["broker_orders"]);
    expect(reads[0].joins).toEqual(["portfolio_accounts", "aperture_runs", "aperture_candidates"]);
    expect(reads[0].sorted).toBe(false);
    expect(db.select).toHaveBeenCalledTimes(1);
    for (const column of ["user_id", "account_id", "run_id", "candidate_id", "id"]) expect(reads[0].sql?.sql).toContain(column);
    expect(reads[0].sql?.params).toEqual(expect.arrayContaining([7, 11, 21, 31, 41]));
    expect(result.lineage).toMatchObject({ ...target, userId: 7, decisionRunId: null, decisionRevisionId: null, capitalThesisId: null, portfolioContextAccountId: null, brokerOrderId: "broker-close", closingFillIds: null, capitalEventId: null });
    expect(result.missingEvidence).toContainEqual(expect.objectContaining({ code: "secondary_lineage_unverified" }));
  });

  it("does not promote free-form persisted JSON or a filled-order entry snapshot into closing-lot proof", async () => {
    const row = joined();
    row.order.gateSnapshot = { kind: "realized_gains", recordedCostBasisCents: 1_000_000, netSaleProceedsCents: 1_180_000, feesCents: 2500, profitReserveCents: 60_000, closingFillIds: ["asserted-fill"], reconciliationState: "reconciled", availabilityState: "verified_available" };
    const mark = snapshot(); mark.avgCostCents = row.order.filledAvgPriceCents!; mark.unrealizedPnlCents = 0;
    database(row, mark);
    expect(await readRealizedGainSource(7, target)).toMatchObject({ source: null, recordedCostBasisCents: null, realizedProfitLossCents: null, feesCents: null, reserveCents: null, verifiedDeployableCents: null });
  });

  it.each(["open", "close"] as const)("does not expose orderFlow's synthetic zero P&L as a verified mark after an %s fill", async intent => {
    const row = joined();
    row.order.intent = intent;
    row.order.side = intent === "close" ? "sell" : "buy";
    // The actual post-fill writer uses filled average price for both cost/mark,
    // writes zero P&L, and labels priceBasis verified even for a closing fill.
    const mark = { ...snapshot(), avgCostCents: row.order.filledAvgPriceCents!, unrealizedPnlCents: 0 };
    const { reads, forbidden } = database(row, mark);
    const result = await readRealizedGainSource(7, target);
    expect(result.observations?.positionMark).toBeNull();
    expect(result.realizedProfitLossCents).toBeNull();
    expect(reads.map(read => read.table)).toEqual(["broker_orders"]);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each([
    "unowned_thesis", "unowned_portfolio_context", "unowned_decision_run",
    "revision_from_other_decision", "decision_without_revision", "revision_without_decision",
  ])("omits %s rather than treating copied foreign keys as authoritative lineage", async condition => {
    const row = joined();
    if (condition === "unowned_thesis") row.run.thesisId = 987_001;
    if (condition === "unowned_portfolio_context") row.order.portfolioContextAccountId = 987_002;
    if (condition === "unowned_decision_run") row.order.decisionRunId = 987_003;
    if (condition === "revision_from_other_decision") row.order.decisionRevisionId = 987_004;
    if (condition === "decision_without_revision") row.order.decisionRevisionId = null;
    if (condition === "revision_without_decision") row.order.decisionRunId = null;
    const before = structuredClone(row);
    const { reads, forbidden } = database(row);
    const result = await readRealizedGainSource(7, target);
    expect(result.lineage).toMatchObject({ ...target, userId: 7,
      capitalThesisId: null, portfolioContextAccountId: null, decisionRunId: null, decisionRevisionId: null });
    expect(result.missingEvidence).toContainEqual(expect.objectContaining({ code: "secondary_lineage_unverified" }));
    expect(JSON.stringify(result)).not.toMatch(/98700[1-4]/);
    expect(result.observations?.modeledGrossSaleProceedsCents).toBe(1_182_500);
    expect(reads).toHaveLength(1);
    expect(row).toEqual(before);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each(["account", "symbol", "run", "future", "future_ingestion"])("ignores a %s-mismatched position mark rather than attributing it to this order", async mismatch => {
    const mark = snapshot();
    if (mismatch === "account") mark.accountId = 12;
    if (mismatch === "symbol") mark.symbol = "NVDA";
    if (mismatch === "run") mark.runId = 22;
    if (mismatch === "future") mark.snapshotAt = NOW + 1;
    if (mismatch === "future_ingestion") mark.createdAt = NOW + 1;
    database(joined(), mark);
    expect((await readRealizedGainSource(7, target)).observations?.positionMark).toBeNull();
  });

  it.each(["verifiedGainCents", "recordedCostBasisCents", "feesCents", "closingFillIds", "availabilityState", "source", "userId", "profitReserveCents"])("rejects browser-supplied %s before reading records", async key => {
    database();
    const result = await readRealizedGainSource(7, { ...target, [key]: 120_000 });
    expect(result.status).toBe("invalid_request");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("rejects invalid authenticated identity %s", async userId => {
    database();
    expect((await readRealizedGainSource(userId, target)).status).toBe("invalid_request");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it.each(["order_owner", "account_owner", "run_owner", "account", "run", "candidate", "candidate_run", "order"])("rejects mismatched %s without leaking another record", async mismatch => {
    const row = joined();
    if (mismatch === "order_owner") row.order.userId = 8;
    if (mismatch === "account_owner") row.account.userId = 8;
    if (mismatch === "run_owner") row.run.userId = 8;
    if (mismatch === "account") row.order.accountId = 12;
    if (mismatch === "run") row.order.runId = 22;
    if (mismatch === "candidate") row.order.candidateId = 32;
    if (mismatch === "candidate_run") row.candidate.runId = 22;
    if (mismatch === "order") row.order.id = 42;
    const { reads } = database(row);
    const result = await readRealizedGainSource(7, target);
    expect(result).toMatchObject({ status: "not_found", source: null, observations: null, lineage: null });
    expect(reads).toHaveLength(1);
  });

  it("does not substitute a different play when the exact order is absent", async () => {
    database(null);
    expect(await readRealizedGainSource(7, target)).toMatchObject({ status: "not_found", observations: null, source: null });
  });

  it.each(["open", "null_intent", "pending", "partial", "dispatch", "no_receipt", "cancelled_partial"])("keeps %s hypothetical or unresolved, never realized", async condition => {
    const row = joined();
    if (condition === "open") { row.order.intent = "open"; row.order.side = "buy"; }
    if (condition === "null_intent") row.order.intent = null;
    if (condition === "pending") { row.order.status = "submitted"; row.order.filledQty = null; }
    if (condition === "partial") row.order.filledQty = 50;
    if (condition === "dispatch") row.order.dispatchError = "transport interrupted";
    if (condition === "no_receipt") row.order.brokerOrderId = null;
    if (condition === "cancelled_partial") { row.order.status = "cancelled"; row.order.filledQty = 50; }
    database(row);
    const result = await readRealizedGainSource(7, target);
    expect(result).toMatchObject({ status: "hypothetical_only", source: null, realizedProfitLossCents: null, verifiedDeployableCents: null });
  });

  it.each(["manual", "robinhood_mcp", "live"])("does not mix %s account context into verified paper capital", async mode => {
    const row = joined();
    if (mode === "live") row.account.isPaper = false;
    else row.account.brokerId = mode;
    database(row);
    expect(await readRealizedGainSource(7, target)).toMatchObject({ status: "hypothetical_only", source: null, verifiedDeployableCents: null });
  });

  it.each([null, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])("does not manufacture gross sale proceeds from invalid/unsafe fill price %s", async price => {
    const row = joined(); row.order.filledAvgPriceCents = price;
    database(row);
    expect((await readRealizedGainSource(7, target)).observations?.modeledGrossSaleProceedsCents).toBeNull();
  });

  it("uses explicit option multiplier without treating premium as a share price or assuming missing terms", async () => {
    const row = joined(); Object.assign(row.order, { symbol: "PWR261120P00300000", instrumentType: "long_put", underlyingSymbol: "PWR", optionExpirationDate: "2026-11-20", optionStrikePriceCents: 30_000, contractMultiplier: 100, qty: 2, filledQty: 2, filledAvgPriceCents: 400 });
    database(row, null);
    expect((await readRealizedGainSource(7, target)).observations?.modeledGrossSaleProceedsCents).toBe(80_000);
    row.order.contractMultiplier = null;
    database(row, null);
    expect((await readRealizedGainSource(7, target)).observations?.modeledGrossSaleProceedsCents).toBeNull();
  });

  it("does not round a fractional/invalid option contract or silently replace put/call identity", async () => {
    const row = joined(); Object.assign(row.order, { symbol: "PWR261120P00300000", instrumentType: "long_call", underlyingSymbol: "PWR", optionExpirationDate: "2026-11-20", optionStrikePriceCents: 30_000, contractMultiplier: 100, qty: 2, filledQty: 2, filledAvgPriceCents: 400 });
    database(row, null);
    expect((await readRealizedGainSource(7, target)).observations?.modeledGrossSaleProceedsCents).toBeNull();
    row.order.instrumentType = "long_put"; row.order.filledQty = 1.5;
    database(row, null);
    expect((await readRealizedGainSource(7, target)).observations?.modeledGrossSaleProceedsCents).toBeNull();
  });

  it("keeps sync freshness distinct from reconciliation and rejects future/historical leakage", async () => {
    const row = joined(); row.account.lastSyncedAt = NOW - STALE_ACCOUNT_MS - 1;
    database(row);
    expect((await readRealizedGainSource(7, target)).observations?.accountFreshness).toBe("stale");
    row.order.updatedAt = NOW + 1;
    database(row);
    expect(await readRealizedGainSource(7, target)).toMatchObject({ status: "missing_evidence", observations: null, source: null });
  });

  it("does not depend on a position-mark read or its unindexed latest-snapshot sort", async () => {
    const { db } = database();
    const select = db.select.getMockImplementation()!;
    db.select.mockImplementationOnce(select).mockImplementationOnce(() => { throw new Error("sensitive connection string must not surface"); });
    const result = await readRealizedGainSource(7, target);
    expect(result).toMatchObject({ status: "missing_evidence", observations: { modeledGrossSaleProceedsCents: 1_182_500, positionMark: null }, source: null, verifiedDeployableCents: null });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("returns unavailable for storage failure, not an empty or verified capital envelope", async () => {
    mocks.getDb.mockResolvedValue(null);
    expect(await readRealizedGainSource(7, target)).toMatchObject({ status: "unavailable", source: null, verifiedDeployableCents: null });
    mocks.getDb.mockRejectedValue(new Error("sensitive database detail"));
    expect(JSON.stringify(await readRealizedGainSource(7, target))).not.toContain("sensitive");
  });

  it("repeated/concurrent reads do not create a capital event, reserve funds, or change lifecycle rows", async () => {
    const row = joined(), before = structuredClone(row);
    const { forbidden } = database(row);
    const results = await Promise.all(Array.from({ length: 3 }, () => readRealizedGainSource(7, target)));
    for (const result of results) expect(result).toEqual(results[0]);
    expect(row).toEqual(before);
    expect(forbidden).not.toHaveBeenCalled();
    expect(results[0].sideEffects).toEqual({ capitalReserved: false, proposalCreated: false, orderCreated: false, brokerInvoked: false });
  });
});
