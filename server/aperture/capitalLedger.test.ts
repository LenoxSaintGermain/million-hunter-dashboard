import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect, getTableConfig } from "drizzle-orm/mysql-core";
import { readFileSync } from "node:fs";
import { apertureCapitalEvents, apertureCapitalClaims, type ApertureCapitalEvent, type ApertureCapitalClaim } from "../../drizzle/apertureCapitalLedgerSchema";
import { capitalLedgerReceiptSchema, deriveCapitalEnvelope, type DeclaredCapitalSource } from "../../shared/capitalStrategy";
import { claimCapital, readCapitalLedger, recordCapitalEvent, transitionCapitalClaim, withCapitalLedgerTransaction, type CapitalLedgerTransaction } from "./capitalLedger";

const NOW = 1_800_000_000_000;
const eventInput = { accountId: 11, sourceId: "source:declaration-1", sourceKey: "declaration:1", capitalEventId: "declaration:1", sourceKind: "operator_declared_excess", amountCents: 120_000, currency: "USD" } as const;
const target = { accountId: 11, capitalEventId: eventInput.capitalEventId };
const claimInput = { ...target, allocationId: "allocation:1", amountCents: 80_000 };
const transition = (expectedState: string, nextState: string) => ({ ...target, allocationId: claimInput.allocationId, expectedState, nextState });

/** Unit adapter only; the separate integration file proves real locking/concurrency. */
function fixture() {
  const account = { id: 11, userId: 7, label: "Illustrative named paper account", isPaper: true, brokerId: "alpaca_paper", externalAccountId: "illustrative-paper" };
  const events: ApertureCapitalEvent[] = [], claims: ApertureCapitalClaim[] = [];
  const locks: string[] = [], writes: string[] = [];
  const params = (predicate: any) => new MySqlDialect().sqlToQuery(predicate).params;
  const forbidden = vi.fn(() => { throw new Error("Unexpected side effect"); });
  const tx = {
    rollback: forbidden, delete: forbidden, execute: forbidden, transaction: forbidden,
    select: vi.fn(() => {
      let table = "", filter: unknown[] = [], limit = Infinity;
      const result = () => {
        const rows = table === "portfolio_accounts" ? (filter[0] === account.id && filter[1] === account.userId ? [account] : [])
          : table === "aperture_capital_events" ? events.filter(row => filter.length === 4
            ? row.userId === filter[0] && (row.sourceKey === filter[1] || row.sourceId === filter[2] || row.capitalEventId === filter[3])
            : row.userId === filter[0] && row.accountId === filter[1] && row.capitalEventId === filter[2])
          : table === "aperture_capital_claims" ? claims.filter(row => filter.length === 1 ? row.eventId === filter[0] : row.userId === filter[0] && row.allocationId === filter[1])
          : (() => { throw new Error("Unexpected table"); })();
        return structuredClone(rows.slice(0, limit));
      };
      const query = {
        from(t: any) { table = getTableName(t); return query; }, where(p: any) { filter = params(p); return query; },
        orderBy() { return query; }, for(mode: string) { expect(mode).toBe("update"); locks.push(table); return query; },
        limit(n: number) { limit = n; return query; },
        then(resolve: any, reject: any) { return Promise.resolve().then(result).then(resolve, reject); },
      };
      return query;
    }),
    insert: vi.fn((table: any) => ({ values: async (values: any) => {
      const name = getTableName(table); writes.push(name);
      const rows = name === "aperture_capital_events" ? events : name === "aperture_capital_claims" ? claims : null;
      if (!rows) return forbidden();
      const id = rows.length + 1;
      rows.push({ ...structuredClone(values), id });
      return [{ insertId: id }];
    } })),
    update: vi.fn((table: any) => ({ set: (values: any) => ({ where: async (p: any) => {
      expect(getTableName(table)).toBe("aperture_capital_claims"); writes.push("claim_transition");
      const [id, userId, eventId, state] = params(p);
      const row = claims.find(row => row.id === id && row.userId === userId && row.eventId === eventId && row.state === state);
      if (row) Object.assign(row, values);
      return [{ affectedRows: row ? 1 : 0 }];
    } }) })),
  };
  return { tx: tx as unknown as CapitalLedgerTransaction, rawTx: tx, account, events, claims, locks, writes, forbidden };
}
beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(NOW); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); })); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("capital ledger transaction interface", () => {
  it.each(["ER_CHECKREAD", "ER_LOCK_DEADLOCK"])("restarts the whole rolled-back transaction for %s only", async code => {
    const operation = vi.fn(async () => "saved");
    const transaction = vi.fn().mockRejectedValueOnce({ cause: { code } }).mockImplementation(() => operation());
    expect(await withCapitalLedgerTransaction({ transaction } as any, operation)).toBe("saved");
    expect(transaction).toHaveBeenCalledTimes(2);
  });
  it.each(["ECONNRESET", "ETIMEDOUT", "ER_DUP_ENTRY"])("does not replay ambiguous or non-retryable %s", async code => {
    const error = { cause: { code } }, transaction = vi.fn().mockRejectedValue(error);
    await expect(withCapitalLedgerTransaction({ transaction } as any, vi.fn())).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it("bounds snapshot retries to three complete transactions", async () => {
    const error = { code: "ER_CHECKREAD" }, transaction = vi.fn().mockRejectedValue(error);
    await expect(withCapitalLedgerTransaction({ transaction } as any, vi.fn())).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(3);
  });
  it("distinguishes an absent ledger from a checked-empty event, without asserting verified funds", async () => {
    const f = fixture();
    expect(await readCapitalLedger(f.tx, 7, target)).toEqual({ status: "missing", event: null, receipt: null });
    const saved = await recordCapitalEvent(f.tx, 7, eventInput);
    expect(saved.event.proofBasis).toBe("operator_declared");
    const before = structuredClone({ events: f.events, claims: f.claims, account: f.account, writes: f.writes });
    const result = await readCapitalLedger(f.tx, 7, target);
    expect(result.receipt).toMatchObject({ status: "complete", sourceId: eventInput.sourceId, accountId: "11", capitalEventId: target.capitalEventId, allocationClaims: [], observedCapitalEventIds: [target.capitalEventId], asOf: NOW });
    expect(capitalLedgerReceiptSchema.safeParse(result.receipt).success).toBe(true);
    expect({ events: f.events, claims: f.claims, account: f.account, writes: f.writes }).toEqual(before);
    expect(f.forbidden).not.toHaveBeenCalled();
  });

  it("makes exact event retries idempotent and retains the immutable identity", async () => {
    const f = fixture();
    const first = await recordCapitalEvent(f.tx, 7, eventInput);
    vi.mocked(Date.now).mockReturnValue(NOW + 100);
    expect(await recordCapitalEvent(f.tx, 7, eventInput)).toEqual({ ...first, duplicate: true });
    expect(f.events).toHaveLength(1); expect(f.claims).toEqual([]);
  });

  it("feeds exact-source coverage into the real envelope duplicate/allocation rules", async () => {
    const f = fixture();
    const source: DeclaredCapitalSource = { id: eventInput.sourceId, kind: "operator_declared_excess", amountCents: eventInput.amountCents,
      declarationId: target.capitalEventId, account: { id: "11", name: f.account.label, mode: "paper" } };
    const envelope = async () => {
      const ledger = await readCapitalLedger(f.tx, 7, target);
      return deriveCapitalEnvelope({ source, ledgerReceipt: ledger.receipt }, NOW);
    };
    expect(await envelope()).toMatchObject({ status: "blocked", alreadyAllocatedCents: null, blockers: ["allocation_ledger_unverified"] });
    await recordCapitalEvent(f.tx, 7, eventInput);
    await recordCapitalEvent(f.tx, 7, eventInput); // Same source retry is one occurrence.
    const other = { ...eventInput, sourceKey: "declaration:2", sourceId: "source:2", capitalEventId: "declaration:2" };
    await recordCapitalEvent(f.tx, 7, other);
    await claimCapital(f.tx, 7, { ...claimInput, capitalEventId: other.capitalEventId, allocationId: "allocation:other" });
    await expect(recordCapitalEvent(f.tx, 7, { ...eventInput, sourceId: "alias:source", capitalEventId: "alias:event" })).rejects.toMatchObject({ code: "SOURCE_CONFLICT" });
    expect(await envelope()).toMatchObject({ status: "operator_declared", deployableCents: 120_000, alreadyAllocatedCents: 0, blockers: [] });
    const ledger = await readCapitalLedger(f.tx, 7, target);
    expect(ledger.receipt?.observedCapitalEventIds).toEqual([target.capitalEventId]);
    // Consumer must still reject genuinely repeated occurrence evidence and wrong identities/time.
    expect(deriveCapitalEnvelope({ source, ledgerReceipt: { ...ledger.receipt!, observedCapitalEventIds: [target.capitalEventId, target.capitalEventId] } }, NOW).blockers).toContain("duplicate_capital_event");
    expect(deriveCapitalEnvelope({ source, ledgerReceipt: ledger.receipt }, NOW + 1).blockers).toContain("allocation_ledger_mismatch");
    expect(deriveCapitalEnvelope({ source: { ...source, declarationId: other.capitalEventId }, ledgerReceipt: ledger.receipt }, NOW).blockers).toContain("allocation_ledger_mismatch");
    await claimCapital(f.tx, 7, claimInput);
    await claimCapital(f.tx, 7, claimInput);
    expect(await envelope()).toMatchObject({ status: "blocked", deployableCents: 0, alreadyAllocatedCents: 80_000, blockers: ["concurrent_allocation"] });
    await transitionCapitalClaim(f.tx, 7, transition("pending", "released"));
    expect(await envelope()).toMatchObject({ status: "operator_declared", deployableCents: 120_000, alreadyAllocatedCents: 0, blockers: [] });
  });

  it.each(["sourceId", "sourceKey", "capitalEventId", "amountCents", "sourceKind"])("rejects a source collision changing %s instead of adding capital", async field => {
    const f = fixture(); await recordCapitalEvent(f.tx, 7, eventInput);
    const changed = { ...eventInput, [field]: field === "amountCents" ? 130_000 : field === "sourceKind" ? "realized_gains" : "different:identity" };
    await expect(recordCapitalEvent(f.tx, 7, changed)).rejects.toMatchObject({ code: "SOURCE_CONFLICT" });
    expect(f.events).toHaveLength(1); expect(f.events[0].amountCents).toBe(120_000);
  });

  it.each(["realized_gains", "reconciled_available_funds", "returned_principal", "hypothetical_future_proceeds"])("keeps %s unknown even if a numerical amount is supplied", async sourceKind => {
    const f = fixture();
    expect((await recordCapitalEvent(f.tx, 7, { ...eventInput, sourceKind })).event.proofBasis).toBe("unknown");
    await expect(claimCapital(f.tx, 7, claimInput)).rejects.toMatchObject({ code: "SOURCE_PROOF_MISSING" });
    const read = await readCapitalLedger(f.tx, 7, target);
    expect(read.receipt?.allocationClaims).toEqual([]);
    expect(read.status).toBe("complete"); // Claim coverage, not verified provenance.
    expect(f.claims).toEqual([]);
  });

  it("preserves unknown amount as null", async () => {
    const f = fixture();
    expect((await recordCapitalEvent(f.tx, 7, { ...eventInput, sourceKind: "realized_gains", amountCents: null })).event.amountCents).toBeNull();
    await expect(claimCapital(f.tx, 7, claimInput)).rejects.toMatchObject({ code: "SOURCE_PROOF_MISSING" });
  });

  it.each(["proofBasis", "ledgerReceipt", "verifiedDeployableCents", "userId", "asOf"])("rejects injected %s claims before a read/write", async field => {
    const f = fixture();
    await expect(recordCapitalEvent(f.tx, 7, { ...eventInput, [field]: "verified" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(f.rawTx.select).not.toHaveBeenCalled(); expect(f.writes).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("rejects unsafe/invalid allocation %s", async amountCents => {
    const f = fixture();
    await expect(claimCapital(f.tx, 7, { ...claimInput, amountCents })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(f.writes).toEqual([]);
  });

  it("requires an actual transaction interface, owned named paper account and stable broker binding", async () => {
    const f = fixture();
    await expect(recordCapitalEvent({ ...f.rawTx, rollback: undefined } as any, 7, eventInput)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(recordCapitalEvent(f.tx, 8, eventInput)).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
    f.account.isPaper = false;
    await expect(recordCapitalEvent(f.tx, 7, eventInput)).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
    f.account.isPaper = true; f.account.label = " ";
    await expect(recordCapitalEvent(f.tx, 7, eventInput)).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
    f.account.label = "Illustrative paper account";
    await recordCapitalEvent(f.tx, 7, eventInput);
    f.account.externalAccountId = "another-destination";
    await expect(readCapitalLedger(f.tx, 7, target)).rejects.toMatchObject({ code: "ACCOUNT_BINDING_CHANGED" });
  });

  it("serializes on the event and enforces total exact claims without changing the source", async () => {
    const f = fixture(); await recordCapitalEvent(f.tx, 7, eventInput);
    const before = structuredClone(f.events);
    const saved = await claimCapital(f.tx, 7, claimInput);
    expect(await claimCapital(f.tx, 7, claimInput)).toEqual({ ...saved, duplicate: true });
    await expect(claimCapital(f.tx, 7, { ...claimInput, amountCents: 1 })).rejects.toMatchObject({ code: "CLAIM_CONFLICT" });
    await expect(claimCapital(f.tx, 7, { ...claimInput, allocationId: "allocation:2", amountCents: 40_001 })).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });
    await claimCapital(f.tx, 7, { ...claimInput, allocationId: "allocation:2", amountCents: 40_000 });
    expect(f.claims.reduce((sum, row) => sum + row.amountCents, 0)).toBe(120_000);
    expect(f.events).toEqual(before);
    expect(f.locks).toEqual(expect.arrayContaining(["portfolio_accounts", "aperture_capital_events", "aperture_capital_claims"]));
  });

  it("does not reuse an allocation identity for a different event", async () => {
    const f = fixture(); await recordCapitalEvent(f.tx, 7, eventInput); await claimCapital(f.tx, 7, claimInput);
    const other = { ...eventInput, sourceKey: "declaration:2", sourceId: "source:2", capitalEventId: "declaration:2" };
    await recordCapitalEvent(f.tx, 7, other);
    await expect(claimCapital(f.tx, 7, { ...claimInput, capitalEventId: other.capitalEventId })).rejects.toMatchObject({ code: "CLAIM_CONFLICT" });
  });

  it("retains consumed capital, never revives released retries, and deduplicates only the exact transition", async () => {
    const f = fixture(); await recordCapitalEvent(f.tx, 7, eventInput); await claimCapital(f.tx, 7, claimInput);
    const committed = await transitionCapitalClaim(f.tx, 7, transition("pending", "committed"));
    expect(await transitionCapitalClaim(f.tx, 7, transition("pending", "committed"))).toEqual({ ...committed, duplicate: true });
    await transitionCapitalClaim(f.tx, 7, transition("committed", "consumed"));
    await expect(transitionCapitalClaim(f.tx, 7, transition("consumed", "released"))).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(claimCapital(f.tx, 7, { ...claimInput, allocationId: "allocation:2" })).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });
    await claimCapital(f.tx, 7, { ...claimInput, allocationId: "allocation:2", amountCents: 40_000 });
    const release = { ...transition("pending", "released"), allocationId: "allocation:2" };
    const released = await transitionCapitalClaim(f.tx, 7, release);
    expect(await transitionCapitalClaim(f.tx, 7, release)).toEqual({ ...released, duplicate: true });
    await expect(transitionCapitalClaim(f.tx, 7, { ...release, expectedState: "committed" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect((await claimCapital(f.tx, 7, { ...claimInput, allocationId: "allocation:2", amountCents: 40_000 })).claim.state).toBe("released");
  });

  it.each(["owner", "account", "unsafe_amount", "future", "state", "overclaimed"])("refuses a complete receipt for corrupt %s claim data", async kind => {
    const f = fixture(); await recordCapitalEvent(f.tx, 7, eventInput); await claimCapital(f.tx, 7, claimInput);
    if (kind === "owner") f.claims[0].userId = 8;
    if (kind === "account") f.claims[0].accountId = 12;
    if (kind === "unsafe_amount") f.claims[0].amountCents = Number.MAX_SAFE_INTEGER + 1;
    if (kind === "future") f.claims[0].updatedAt = NOW + 1;
    if (kind === "state") f.claims[0].state = "verified" as any;
    if (kind === "overclaimed") f.claims[0].amountCents = 120_001;
    await expect(readCapitalLedger(f.tx, 7, target)).rejects.toMatchObject({ code: "LEDGER_INTEGRITY" });
  });

  it("propagates a failed claims SELECT instead of issuing a checked-empty receipt", async () => {
    const f = fixture(); await recordCapitalEvent(f.tx, 7, eventInput);
    const select = f.rawTx.select.getMockImplementation()!;
    f.rawTx.select.mockImplementationOnce(select).mockImplementationOnce(select)
      .mockImplementationOnce(() => { throw new Error("claims storage unavailable"); });
    await expect(readCapitalLedger(f.tx, 7, target)).rejects.toThrow("claims storage unavailable");
    expect(f.claims).toEqual([]);
  });

  it("supplies matching source/claim uniqueness in the schema and migration without touching existing tables", () => {
    const migration = readFileSync(new URL("../../drizzle/0065_aperture_capital_ledger.sql", import.meta.url), "utf8");
    for (const table of [apertureCapitalEvents, apertureCapitalClaims]) {
      const config = getTableConfig(table);
      expect(migration).toContain(`CREATE TABLE \`${config.name}\``);
      for (const idx of config.indexes) expect(migration).toContain(`\`${idx.config.name}\``);
      for (const column of config.columns) expect(migration).toContain(`\`${column.name}\``);
    }
    expect(migration).not.toMatch(/\b(ALTER|UPDATE|DELETE|INSERT|DROP)\s/i);
  });
});
