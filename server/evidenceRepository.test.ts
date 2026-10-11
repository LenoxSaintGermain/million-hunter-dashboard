import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableColumns } from "drizzle-orm";
import { publicEvidenceReceipts } from "../drizzle/publicEvidenceSchema";
import { createEvidenceRepository, deriveSecSubjectKey, type AppendEvidenceInput } from "./evidenceRepository";

const input = (overrides: Partial<AppendEvidenceInput> = {}): AppendEvidenceInput => ({
  ownerId: 1, subjectKey: "sec:CIK0000320193", requestId: randomUUID(),
  provider: "sec-submissions", schemaVersion: 1,
  sourceUrl: "https://data.sec.gov/submissions/CIK0000320193.json",
  status: "empty", payload: {
    status: "empty", sourceUrl: "https://data.sec.gov/submissions/CIK0000320193.json",
    retrievedAt: "2026-10-11T12:00:00.123Z", company: { cik: "0000320193", name: "Illustrative issuer" },
    filings: [], message: null, failureCode: null,
  }, payloadHash: "a".repeat(64),
  retrievedAt: new Date("2026-10-11T12:00:00.123Z"),
  expiresAt: new Date("2026-10-12T12:00:00.123Z"), message: null, failureCode: null,
  ...overrides,
});
function dbRow(receipt: Record<string, unknown>) {
  return Object.keys(getTableColumns(publicEvidenceReceipts)).map(key => {
    const value = receipt[key];
    return value instanceof Date ? value.toISOString().replace("T", " ").replace("Z", "") : value;
  });
}

// Real Drizzle query generation against a fake mysql2 driver; no network or DB env.
function harness() {
  const responses: unknown[] = [];
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = vi.fn(async (options: { sql: string }, params: unknown[]) => {
    calls.push({ sql: options.sql, params });
    if (/^(begin|commit|rollback)/i.test(options.sql)) return [{ affectedRows: 0 }, []];
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return [response ?? [], []];
  });
  const db = drizzle({ query } as any);
  const getDb = vi.fn(async () => db);
  return { repo: createEvidenceRepository(getDb), responses, calls, getDb };
}

describe("SEC receipt repository", () => {
  it("derives a canonical personal-research subject, rejecting absent/invalid CIKs", () => {
    expect(deriveSecSubjectKey("320193")).toBe("sec:CIK0000320193");
    for (const cik of ["", "0", "0000000000", "Apple", "12345678901", "../1"])
      expect(() => deriveSecSubjectKey(cik)).toThrow();
  });
  it("fails closed without a database for every operation", async () => {
    const repo = createEvidenceRepository(async () => null);
    for (const operation of [
      () => repo.append(input()), () => repo.list(1, input().subjectKey),
      () => repo.get(1, randomUUID()), () => repo.findRequest(1, randomUUID()),
      () => repo.reserveSecBudget(1), () => repo.reserveSecProviderBudget(),
      () => repo.reserveCaptureAttempt(1),
      () => repo.reserveFeedCaller(1), () => repo.reserveFeedProvider("polymarket"),
      () => repo.claimCapture(1, randomUUID(), input().subjectKey), () => repo.setSecCooldown(new Date()),
    ]) await expect(operation()).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
  });
  it("scopes reads by owner and orders lists before applying a bounded limit", async () => {
    const h = harness(); const subject = input().subjectKey; const id = randomUUID();
    expect(await h.repo.list(2, subject)).toEqual([]);
    expect(h.calls[0].params).toEqual([2, subject, 20]);
    expect(h.calls[0].sql).toMatch(/owner_id.*= \?.*subject_key.*= \?/);
    expect(h.calls[0].sql).toMatch(/order by .*recorded_at.*desc, .*id.*desc limit \?/);
    expect(await h.repo.get(2, id)).toBeNull();
    expect(h.calls[1].params).toEqual([2, id, 1]);
    expect(await h.repo.findRequest(2, id)).toBeNull();
    expect(h.calls[2].params).toEqual([2, id, 1]);
  });
  it("rejects invalid owner, pagination and capture fields before DB access", async () => {
    const h = harness();
    for (const owner of [0, -1, 1.5, NaN, 2147483648]) await expect(h.repo.list(owner, input().subjectKey)).rejects.toThrow();
    for (const limit of [0, -1, 1.5, 101]) await expect(h.repo.list(1, input().subjectKey, limit)).rejects.toThrow();
    for (const patch of [{ payloadHash: "bad" }, { subjectKey: "deal:1" }, { payload: undefined },
      { expiresAt: new Date(0) }, { schemaVersion: 2 }, { sourceUrl: "https://example.com/" }])
      await expect(h.repo.append(input(patch as any))).rejects.toThrow();
    expect(h.getDb).not.toHaveBeenCalled();
  });
  it("has no update or delete API", () => {
    expect(Object.keys(harness().repo).sort()).toEqual(["append", "claimCapture", "findRequest", "get", "list", "reserveCaptureAttempt", "reserveFeedCaller", "reserveFeedProvider", "reserveSecBudget", "reserveSecProviderBudget", "setSecCooldown"]);
  });
  it.each(["get", "list", "findRequest", "append"] as const)("normalizes MariaDB JSON text on %s without changing receipt metadata", async method => {
    const h = harness(); const capture = input();
    const original = { ...capture, id: randomUUID(), recordedAt: new Date("2026-10-11T12:00:01.123Z") };
    h.responses.push([dbRow({ ...original, payload: JSON.stringify(original.payload) })]);
    const result = method === "get" ? await h.repo.get(1, original.id)
      : method === "list" ? (await h.repo.list(1, original.subjectKey))[0]
      : method === "findRequest" ? await h.repo.findRequest(1, original.requestId)
      : await h.repo.append(capture);
    expect(result).toEqual(original);
    expect(result?.payload.company?.name).toBe("Illustrative issuer");
    expect(result?.recordedAt).toBeInstanceOf(Date);
    expect(result?.retrievedAt).toBeInstanceOf(Date);
    expect(result?.expiresAt).toBeInstanceOf(Date);
  });
  it.each(["{broken", "null", "[]", "{}", '{"company":{"name":"misleading"}}',
    JSON.stringify({ ...input().payload, filings: [{ accessionNumber: 42 }] })])("fails closed on malformed stored payload %s", async payload => {
    const h = harness(); const original = { ...input(), id: randomUUID(), recordedAt: new Date() };
    for (const read of [() => h.repo.get(1, original.id), () => h.repo.list(1, original.subjectKey),
      () => h.repo.findRequest(1, original.requestId), () => h.repo.append(input({ requestId: original.requestId }))]) {
      h.responses.push([dbRow({ ...original, payload })]);
      await expect(read()).rejects.toMatchObject({ code: "RECEIPT_INVALID" });
    }
    expect(h.calls.some(c => /^insert/i.test(c.sql))).toBe(false);
  });
  it("appends fresh UUIDs without overwriting earlier captures", async () => {
    const h = harness(); const capture = input();
    h.responses.push([], { affectedRows: 1 }, [], { affectedRows: 1 });
    const first = await h.repo.append(capture);
    const next = await h.repo.append({ ...capture, requestId: randomUUID() });
    expect(first.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    expect(next.id).not.toBe(first.id);
    expect(first.recordedAt).toBeInstanceOf(Date);
    expect(first.retrievedAt).toEqual(capture.retrievedAt);
    expect(first.payloadHash).toBe(capture.payloadHash);
    expect(h.calls.filter(c => /^insert/i.test(c.sql))).toHaveLength(2);
    expect(h.calls.some(c => /update|delete/i.test(c.sql))).toBe(false);
    expect(first.payload).not.toBe(capture.payload);
  });
  it("replays the original receipt without changing payload, hash or timestamps", async () => {
    const h = harness(); const capture = input();
    const original = { ...capture, id: randomUUID(), recordedAt: new Date() };
    h.responses.push([dbRow(original)]);
    expect(await h.repo.append({ ...capture, payloadHash: "b".repeat(64) })).toEqual(original);
    expect(h.calls).toHaveLength(1);
  });
  it.each([false, true])("conflicts on a request bound to a different subject (race=%s)", async race => {
    const h = harness(); const capture = input();
    const original = { ...capture, subjectKey: "sec:CIK0000000001", id: randomUUID(), recordedAt: new Date() };
    if (race) h.responses.push([], Object.assign(new Error("wrapped"), { cause: { code: "ER_DUP_ENTRY" } }));
    h.responses.push([dbRow(original)]);
    await expect(h.repo.append(capture)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(h.calls.at(-1)?.params).toEqual([1, capture.requestId, 1]);
  });
  it("recovers a concurrent duplicate by reading only the same owner's request", async () => {
    const h = harness(); const capture = input();
    const original = { ...capture, id: randomUUID(), recordedAt: new Date() };
    h.responses.push([], Object.assign(new Error("duplicate"), { errno: 1062 }), [dbRow(original)]);
    expect(await h.repo.append(capture)).toEqual(original);
    expect(h.calls.at(-1)?.params).toEqual([1, capture.requestId, 1]);
  });
  it("propagates nonduplicate storage errors instead of claiming an empty success", async () => {
    const h = harness(); const failure = new Error("disconnected");
    h.responses.push([], failure);
    await expect(h.repo.append(input())).rejects.toMatchObject({ cause: failure });
  });
  it("records failures with recordedAt but no fabricated retrieval time", async () => {
    const h = harness(); const capture = input({ status: "unavailable", retrievedAt: null, expiresAt: null,
      payload: { status: "unavailable", sourceUrl: input().sourceUrl, retrievedAt: null, company: null,
        filings: [], message: "Unavailable", failureCode: "NETWORK_ERROR" },
      message: "Unavailable", failureCode: "NETWORK_ERROR" });
    h.responses.push([], { affectedRows: 1 });
    const saved = await h.repo.append(capture);
    expect(saved.recordedAt).toBeInstanceOf(Date);
    expect(saved.retrievedAt).toBeNull(); expect(saved.expiresAt).toBeNull();
    await expect(h.repo.append({ ...capture, retrievedAt: new Date() })).rejects.toThrow();
  });
  it("reads immutable interrupted outcomes as unavailable, never as proof that no upstream work occurred", async () => {
    const h = harness(); const capture = input({ status: "unavailable", retrievedAt: null, expiresAt: null,
      failureCode: "CAPTURE_INTERRUPTED", message: "Capture outcome unconfirmed.",
      payload: { status: "unavailable", sourceUrl: input().sourceUrl, retrievedAt: null, company: null,
        filings: [], message: "Capture outcome unconfirmed.", failureCode: "CAPTURE_INTERRUPTED" } });
    const original = { ...capture, id: randomUUID(), recordedAt: new Date() };
    h.responses.push([dbRow({ ...original, payload: JSON.stringify(original.payload) })]);
    expect(await h.repo.get(1, original.id)).toEqual(original);
  });
});

describe("persistent SEC budget transactions", () => {
  const budget = (requestCount = 1, secondCount = 1) => [{ windowStart: 120, requestCount, secondStart: 121, secondCount, cooldownUntil: 0, dbNowMs: 121000 }];
  it("shares the global quota with provider-only SEC index requests without an owner=0 row", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, budget());
    await h.repo.reserveSecProviderBudget();
    expect(h.calls).toHaveLength(4);
    expect(h.calls.at(-1)?.sql).toBe("commit");
    expect(h.calls.some(c => c.sql.includes("owner:") || c.params.some(p => String(p).includes("owner:")))).toBe(false);
    await expect(h.repo.reserveSecBudget(0)).rejects.toThrow();
  });
  it("sets persistent cooldown atomically without overwriting counts or shortening a prior cooldown", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 });
    await h.repo.setSecCooldown(new Date(150000));
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].sql).toContain("GREATEST(cooldown_until, ?)");
    expect(h.calls[0].params).toEqual([150000, 150000]);
    expect(h.calls[0].sql.split("ON DUPLICATE KEY UPDATE")[1]).not.toContain("request_count");
    await expect(h.repo.setSecCooldown(new Date(NaN))).rejects.toThrow();
  });
  it.each([false, true])("denies persisted cooldown based on DB time and rolls back (providerOnly=%s)", async providerOnly => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, [{ ...budget()[0], cooldownUntil: 121001 }]);
    await expect(providerOnly ? h.repo.reserveSecProviderBudget() : h.repo.reserveSecBudget(1)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(h.calls.at(-1)?.sql).toBe("rollback");
    expect(h.calls).toHaveLength(4);
  });
  it("allows an expired cooldown at the exact DB-time boundary", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, [{ ...budget()[0], cooldownUntil: 121000 }]);
    await h.repo.reserveSecProviderBudget();
    expect(h.calls.at(-1)?.sql).toBe("commit");
  });
  it("locks global before owner, uses DB-clock rollovers, and commits both reservations", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, budget(), { affectedRows: 1 }, budget());
    await h.repo.reserveSecBudget(7);
    expect(h.calls[0].sql).toBe("begin");
    expect(h.calls[1].sql).toContain("'sec-submissions:global'");
    expect(h.calls[1].sql).toContain("ON DUPLICATE KEY UPDATE");
    expect(h.calls[1].sql).toContain("FLOOR(UNIX_TIMESTAMP()/60)*60");
    expect(h.calls[2].sql).toContain("FOR UPDATE");
    expect(h.calls[3].params[0]).toBe("sec-submissions:owner:7");
    expect(h.calls[4].params).toEqual(["sec-submissions:owner:7"]);
    expect(h.calls.at(-1)?.sql).toBe("commit");
  });
  it.each([[31, 1], [1, 2]])("rolls back global overflow %s/min %s/sec before touching owner", async (minute, second) => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, budget(minute, second));
    await expect(h.repo.reserveSecBudget(7)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(h.calls.at(-1)?.sql).toBe("rollback");
    expect(h.calls.some(c => c.params.includes("sec-submissions:owner:7"))).toBe(false);
  });
  it("rolls back both increments on owner overflow", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, budget(30), { affectedRows: 1 }, budget(7));
    await expect(h.repo.reserveSecBudget(7)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(h.calls.at(-1)?.sql).toBe("rollback");
    expect(h.calls.some(c => c.sql === "commit")).toBe(false);
  });
  it("does not permit a reservation when persistent state is missing or a query fails", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, []);
    await expect(h.repo.reserveSecBudget(7)).rejects.toMatchObject({ code: "BUDGET_STATE_INVALID" });
    expect(h.calls.at(-1)?.sql).toBe("rollback");
    const other = harness(); other.responses.push(new Error("DB offline"));
    await expect(other.repo.reserveSecBudget(7)).rejects.toThrow();
    expect(other.calls.at(-1)?.sql).toBe("rollback");
  });
});

describe("durable append-only capture claims", () => {
  const startedAt = new Date("2026-10-11T12:00:00.123Z");
  it.each([false, true])("returns the durable timestamp and only the insert winner is claimed (duplicate=%s)", async duplicate => {
    const h = harness(); const requestId = randomUUID(); const subjectKey = input().subjectKey;
    h.responses.push(duplicate ? Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" }) : { affectedRows: 1 },
      [[1, requestId, subjectKey, "2026-10-11 12:00:00.123"]]);
    expect(await h.repo.claimCapture(1, requestId, subjectKey)).toEqual({ status: duplicate ? "pending" : "claimed", startedAt });
    expect(h.calls[0].sql).toMatch(/^insert into `public_evidence_capture_claims`/);
    expect(h.calls[0].sql).toContain("UTC_TIMESTAMP(3)");
    expect(h.calls[1].params).toEqual([1, requestId, 1]);
    expect(h.calls.some(c => /update|delete/i.test(c.sql))).toBe(false);
  });
  it("conflicts on a different subject without modifying an existing claim", async () => {
    const h = harness(); const requestId = randomUUID();
    h.responses.push(Object.assign(new Error("duplicate"), { errno: 1062 }), [[1, requestId, "sec:CIK0000000001", "2026-10-11 12:00:00.123"]]);
    await expect(h.repo.claimCapture(1, requestId, input().subjectKey)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("fails closed for missing claim readback and nonduplicate DB errors", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, []);
    await expect(h.repo.claimCapture(1, randomUUID(), input().subjectKey)).rejects.toThrow();
    const other = harness(); const error = new Error("offline"); other.responses.push(error);
    await expect(other.repo.claimCapture(1, randomUUID(), input().subjectKey)).rejects.toMatchObject({ cause: error });
    expect(other.calls).toHaveLength(1);
  });
});

describe("shared feed budgets", () => {
  const cases = [
    { key: "public-feed:caller:7", limit: 30, run: (h: ReturnType<typeof harness>) => h.repo.reserveFeedCaller(7) },
    ...(["polymarket", "markbase", "usaspending", "frankfurter"] as const).map(provider => ({
      key: `public-feed:provider:${provider}`, limit: 60,
      run: (h: ReturnType<typeof harness>) => h.repo.reserveFeedProvider(provider),
    })),
  ];
  for (const { key, limit, run } of cases) {
    it(`${key} admits its inclusive limit with a fixed DB-clock row and lock`, async () => {
      const h = harness(); h.responses.push({ affectedRows: 1 }, [{ windowStart: "120", requestCount: String(limit) }]);
      await run(h);
      expect(h.calls.map(c => c.sql === "begin" || c.sql === "commit" ? c.sql : "query")).toEqual(["begin", "query", "query", "commit"]);
      expect(h.calls[1].params).toEqual([key]);
      expect(h.calls[1].sql).toContain("request_count = IF(window_start < FLOOR(UNIX_TIMESTAMP()/60)*60, 1, request_count + 1)");
      expect(h.calls[1].sql).toContain("window_start = GREATEST(window_start, FLOOR(UNIX_TIMESTAMP()/60)*60)");
      expect(h.calls[2].params).toEqual([key]);
      expect(h.calls[2].sql).toContain("FOR UPDATE");
    });
    it(`${key} rolls back over-limit admission`, async () => {
      const h = harness(); h.responses.push({ affectedRows: 1 }, [{ windowStart: 120, requestCount: limit + 1 }]);
      await expect(run(h)).rejects.toMatchObject({ code: "RATE_LIMITED" });
      expect(h.calls.at(-1)?.sql).toBe("rollback");
      expect(h.calls.some(c => c.sql === "commit")).toBe(false);
    });
    it(`${key} fails closed on malformed state and database errors`, async () => {
      for (const rows of [[], [{ windowStart: null, requestCount: 1 }], [{ windowStart: 120, requestCount: 0 }], [{ windowStart: 120, requestCount: "bad" }]]) {
        const h = harness(); h.responses.push({ affectedRows: 1 }, rows);
        await expect(run(h)).rejects.toMatchObject({ code: "BUDGET_STATE_INVALID" });
        expect(h.calls.at(-1)?.sql).toBe("rollback");
      }
      const h = harness(); const failure = new Error("offline"); h.responses.push(failure);
      await expect(run(h)).rejects.toMatchObject({ cause: failure });
      expect(h.calls.at(-1)?.sql).toBe("rollback");
    });
  }
  it("validates caller and provider before database access", async () => {
    const h = harness();
    for (const owner of [0, -1, NaN, 1.5, 2147483648]) await expect(h.repo.reserveFeedCaller(owner)).rejects.toThrow();
    for (const provider of ["", "sec-submissions", "POLYMARKET", "arbitrary-key"]) await expect(h.repo.reserveFeedProvider(provider as any)).rejects.toThrow();
    expect(h.getDb).not.toHaveBeenCalled();
  });
});

describe("durable capture-attempt admission", () => {
  const minute = (requestCount: number, windowStart = 120) => [{ windowStart, requestCount }];
  it.each([[1, 1], [60, 10]])("admits inclusive global/owner limits %s/%s in one global-first transaction", async (global, owner) => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, minute(global), { affectedRows: 1 }, minute(owner));
    await h.repo.reserveCaptureAttempt(7);
    expect(h.calls[0].sql).toBe("begin");
    expect(h.calls[1].sql).toContain("'sec-capture-attempt:global'");
    expect(h.calls[1].sql).toContain("ON DUPLICATE KEY UPDATE");
    expect(h.calls[1].sql).toContain("FLOOR(UNIX_TIMESTAMP()/60)*60");
    expect(h.calls[2].sql).toContain("FOR UPDATE");
    expect(h.calls[3].params[0]).toBe("sec-capture-attempt:owner:7");
    expect(h.calls[4].params).toEqual(["sec-capture-attempt:owner:7"]);
    expect(h.calls.at(-1)?.sql).toBe("commit");
    expect(h.calls.every(c => !c.sql.includes("sec-submissions:") && !c.sql.includes("public_evidence_receipts") && !c.sql.includes("public_evidence_capture_claims"))).toBe(true);
  });
  it("denies global request 61 before creating or charging an owner row", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, minute(61));
    await expect(h.repo.reserveCaptureAttempt(7)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(h.calls).toHaveLength(4);
    expect(h.calls.at(-1)?.sql).toBe("rollback");
  });
  it("denies owner request 11 and rolls back the global increment too", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, minute(60), { affectedRows: 1 }, minute(11));
    await expect(h.repo.reserveCaptureAttempt(7)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(h.calls.at(-1)?.sql).toBe("rollback");
    expect(h.calls.some(c => c.sql === "commit")).toBe(false);
  });
  it("reuses fixed row keys on rollover and takes the owner's window from the locked global row", async () => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, minute(1, 180), { affectedRows: 1 }, minute(1, 180));
    await h.repo.reserveCaptureAttempt(7);
    expect(h.calls[1].sql).toContain("request_count = IF(window_start < FLOOR(UNIX_TIMESTAMP()/60)*60, 1, request_count + 1)");
    expect(h.calls[3].params).toEqual(["sec-capture-attempt:owner:7", 180, 180, 180]);
    expect(h.calls[3].sql).toContain("request_count = IF(window_start < ?, 1, request_count + 1)");
    expect(h.calls.some(c => /delete/i.test(c.sql))).toBe(false);
  });
  it.each([[], [{ windowStart: 120, requestCount: null }], [{ windowStart: null, requestCount: 1 }]])("fails closed on invalid persisted admission state %#", async rows => {
    const h = harness(); h.responses.push({ affectedRows: 1 }, rows);
    await expect(h.repo.reserveCaptureAttempt(7)).rejects.toMatchObject({ code: "BUDGET_STATE_INVALID" });
    expect(h.calls.at(-1)?.sql).toBe("rollback");
  });
  it("validates the owner before access and propagates DB errors without local admission", async () => {
    const h = harness();
    for (const owner of [0, -1, 1.5, NaN]) await expect(h.repo.reserveCaptureAttempt(owner)).rejects.toThrow();
    expect(h.getDb).not.toHaveBeenCalled();
    const failure = new Error("storage unavailable"); h.responses.push(failure);
    await expect(h.repo.reserveCaptureAttempt(7)).rejects.toMatchObject({ cause: failure });
    expect(h.calls.at(-1)?.sql).toBe("rollback");
  });
});
