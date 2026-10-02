import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ACQUISITION_V2_ENGINE_VERSION, exampleMandate, extractListingEvidence } from "../shared/acquisitionV2";
const store = vi.hoisted(() => ({ rows: [] as any[], jobs: [9, 10], serial: Promise.resolve(),
  sources: {} as Record<number, unknown>, available: true, failUpdate: false, values: vi.fn(), locks: vi.fn() }));
vi.mock("./db", async () => {
  const { MySqlDialect } = await import("drizzle-orm/mysql-core");
  const { scanJobs } = await import("../drizzle/schema");
  const dialect = new MySqlDialect();
  function matches(row: any, condition: any) {
    const { sql, params } = dialect.sqlToQuery(condition);
    if (sql.includes(" like ")) return row.model === params[0] && new RegExp(`^${String(params[1]).replaceAll("%", ".*")}$`).test(row.subjectKey);
    if (sql.includes("subject_key")) return row.subjectKey === params[0];
    return row.id === params[0];
  }
  const db: any = {
    select: () => ({ from: (table: any) => ({ where: (condition: any) => {
      let descending = false;
      const result = () => {
        const rows = (table === scanJobs ? store.jobs.map(id => ({ id, sources: store.sources[id] })) : store.rows).filter(row => matches(row, condition));
        return structuredClone(descending ? [...rows].sort((a, b) => b.id - a.id) : rows);
      };
      const query = {
        orderBy: () => { descending = true; return query; },
        for: (mode: string) => { store.locks(mode); return query; },
        limit: async (n: number) => result().slice(0, n),
        then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
      };
      return query;
    } }) }),
    insert: () => ({ values: async (value: any) => {
      store.values(value);
      for (const row of Array.isArray(value) ? value : [value]) store.rows.push({ ...structuredClone(row), id: Math.max(0, ...store.rows.map(r => r.id)) + 1 });
    } }),
    update: () => ({ set: (value: any) => ({ where: async (condition: any) => {
      if (store.failUpdate) throw new Error("Simulated storage failure");
      for (const row of store.rows.filter(row => matches(row, condition))) Object.assign(row, structuredClone(value));
    } }) }),
    transaction: async (action: any) => {
      const prior = store.serial;
      let release!: () => void;
      store.serial = new Promise<void>(resolve => { release = resolve; });
      await prior;
      const before = structuredClone(store.rows);
      try { return await action(db); }
      catch (error) { store.rows = before; throw error; }
      finally { release(); }
    },
  };
  return { getDb: async () => store.available ? db : null };
});
import { ACQUISITION_V2_PENDING_SOURCE, assertAcquisitionV2JobAccess, beginAcquisitionV2Run, readAcquisitionV2Run, readAcquisitionV2RunState, saveAcquisitionV2Run, updateAcquisitionV2RunState } from "./acquisitionV2Runs";

const source = { url: "https://www.bizbuysell.com/business-opportunity/fixture/1234567/", fetchedAt: "2026-09-30T12:00:00Z", type: "primary" as const };
const text = "Asking Price: $1,850,000\nRevenue: $3,590,234\nSDE: $702,537";
const textHash = (text: string) => createHash("sha256").update(text).digest("hex");
const capture = (body = text) => ({ ...source, state: "captured" as const, evidence: extractListingEvidence({ ...source, text: body }), contentHash: textHash(body) });
const begin = () => beginAcquisitionV2Run(7, 9, exampleMandate);
const save = () => saveAcquisitionV2Run(7, 9, exampleMandate, [capture()]);
const manifestRow = () => store.rows.find(row => row.subjectKey === "acquisition-v2:search:9:manifest")!;
const captureRow = () => store.rows.find(row => row.subjectKey === "acquisition-v2:user:7:search:9")!;
function mutate(row: any, change: (value: any) => void) {
  const value = JSON.parse(row.content); change(value); row.content = JSON.stringify(value);
}
beforeEach(() => {
  store.rows = []; store.jobs = [9, 10]; store.sources = {}; store.serial = Promise.resolve(); store.available = true; store.failUpdate = false;
  store.values.mockReset(); store.locks.mockReset();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-30T13:00:00Z"));
});
afterEach(() => vi.useRealTimers());

it("records durable approval content and timestamp under a separate global job manifest key", async () => {
  const state = await begin();
  expect(state).toMatchObject({ userId: 7, jobId: 9, state: "capturing", capturesSaved: false, captures: [], mandate: exampleMandate,
    approvedAt: "2026-09-30T13:00:00.000Z", engineVersion: ACQUISITION_V2_ENGINE_VERSION });
  expect(state.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(state.mandateHash).toMatch(/^[a-f0-9]{64}$/);
  expect(manifestRow().expiresAt).toBe(Number.MAX_SAFE_INTEGER);
  expect(await readAcquisitionV2RunState(7, 9)).toEqual(state);
  expect(await readAcquisitionV2Run(7, 9)).toEqual([]);
  expect(store.locks).toHaveBeenCalledWith("update");
});
it("begin retries preserve approval time/hash and reject changed mandate content even at the same version", async () => {
  const first = await begin(); vi.setSystemTime(new Date("2026-10-01T13:00:00Z"));
  const reordered = Object.fromEntries(Object.entries(exampleMandate).reverse()) as typeof exampleMandate;
  expect(await beginAcquisitionV2Run(7, 9, reordered)).toEqual(first);
  await expect(beginAcquisitionV2Run(7, 9, { ...exampleMandate, priceMax: 4000000 })).rejects.toThrow("approval content mismatch");
  expect(store.rows).toHaveLength(1);
});
it("persists successful zero-discovery outcomes without conflating unrun and empty", async () => {
  await begin();
  await expect(updateAcquisitionV2RunState(7, 9, "completed")).rejects.toThrow("saved capture receipt");
  await saveAcquisitionV2Run(7, 9, exampleMandate, []);
  const completed = await updateAcquisitionV2RunState(7, 9, "completed");
  expect(completed).toMatchObject({ state: "completed", capturesSaved: true, captures: [] });
  expect(await readAcquisitionV2Run(7, 9)).toEqual([]);
  expect(await readAcquisitionV2RunState(7, 9)).toEqual(completed);
});
it("persists a failure before capture and keeps terminal outcomes immutable", async () => {
  await begin();
  const failed = await updateAcquisitionV2RunState(7, 9, "failed", "Provider unavailable");
  expect(failed).toMatchObject({ state: "failed", reason: "Provider unavailable", capturesSaved: false });
  expect(await updateAcquisitionV2RunState(7, 9, "failed", "Provider unavailable")).toEqual(failed);
  expect(await begin()).toEqual(failed);
  expect(await readAcquisitionV2Run(7, 9)).toEqual([]);
  await expect(updateAcquisitionV2RunState(7, 9, "capturing")).rejects.toThrow("immutable");
  await expect(updateAcquisitionV2RunState(7, 9, "failed", "Different reason")).rejects.toThrow("immutable");
  await expect(save()).rejects.toThrow("terminal");
});
it("saves exact captures once and preserves the report-array API on repeated reads", async () => {
  await begin(); await save();
  const before = structuredClone(store.rows);
  vi.setSystemTime(new Date("2026-10-01T13:00:00Z")); await save();
  expect(store.rows).toEqual(before);
  expect(JSON.parse(captureRow().content)).toMatchObject({ userId: 7, jobId: 9, text, hash: textHash(text), mandate: exampleMandate });
  const first = await readAcquisitionV2Run(7, 9);
  expect(first[0].report?.verdict.value).toBe("HOLD");
  expect(first[0]).toMatchObject({ url: source.url, state: "captured", stale: false });
  expect(await readAcquisitionV2Run(7, 9)).toEqual(first);
  await updateAcquisitionV2RunState(7, 9, "completed"); await save();
  vi.setSystemTime(new Date("2026-10-04T13:00:00Z"));
  expect((await readAcquisitionV2Run(7, 9))[0].stale).toBe(true);
});
it("rejects differing evidence, timestamps and mandates without overwriting a receipt", async () => {
  await begin(); await save(); const before = structuredClone(store.rows);
  await expect(saveAcquisitionV2Run(7, 9, exampleMandate, [capture(text + "\nNew claim")])).rejects.toThrow("retry conflict");
  const later = { ...source, fetchedAt: "2026-10-01T12:00:00Z" };
  await expect(saveAcquisitionV2Run(7, 9, exampleMandate, [{ ...capture(), ...later, evidence: extractListingEvidence({ ...later, text }) }])).rejects.toThrow("retry conflict");
  await expect(saveAcquisitionV2Run(7, 9, { ...exampleMandate, priceMax: 4000000 }, [capture()])).rejects.toThrow("approval content mismatch");
  await expect(saveAcquisitionV2Run(7, 9, exampleMandate, [])).rejects.toThrow("retry conflict");
  expect(store.rows).toEqual(before);
});
it("accepts an order-independent exact retry and preserves failed-source records", async () => {
  const unavailable = { ...source, url: source.url.replace("1234567", "7654321"), state: "unavailable" as const, reason: "HTTP 404" };
  await begin(); await saveAcquisitionV2Run(7, 9, exampleMandate, [capture(), unavailable]);
  const before = structuredClone(store.rows);
  await saveAcquisitionV2Run(7, 9, exampleMandate, [unavailable, capture()]);
  expect(store.rows).toEqual(before);
  await updateAcquisitionV2RunState(7, 9, "failed", "Extraction failed after capture");
  expect(await readAcquisitionV2Run(7, 9)).toEqual(expect.arrayContaining([expect.objectContaining({ state: "unavailable", reason: "HTTP 404", report: null })]));
});
it("serializes concurrent first begins and exact capture retries", async () => {
  const begun = await Promise.all([begin(), begin()]); expect(begun[0]).toEqual(begun[1]);
  await Promise.all([save(), save()]); expect(store.rows).toHaveLength(2);
  const outcomes = await Promise.allSettled([save(), saveAcquisitionV2Run(7, 9, exampleMandate, [capture(text + " changed")])]);
  expect(outcomes.map(r => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(store.rows).toHaveLength(2);
});
it("rolls back capture insertion if manifest update fails", async () => {
  await begin(); const before = structuredClone(store.rows); store.failUpdate = true;
  await expect(save()).rejects.toThrow("storage failure"); expect(store.rows).toEqual(before);
  store.failUpdate = false; await save(); expect(store.rows).toHaveLength(2);
});
it("requires begin and validates IDs/mandate for empty runs", async () => {
  await expect(saveAcquisitionV2Run(7, 9, exampleMandate, [])).rejects.toThrow("must begin");
  await expect(updateAcquisitionV2RunState(7, 9, "failed")).rejects.toThrow("must begin");
  await expect(beginAcquisitionV2Run(0, 9, exampleMandate)).rejects.toThrow();
  await expect(beginAcquisitionV2Run(7, 9, { ...exampleMandate, priceMax: -1 })).rejects.toThrow();
  await expect(beginAcquisitionV2Run(7, 999, exampleMandate)).rejects.toThrow("job not found");
  await expect(saveAcquisitionV2Run(0, 9, exampleMandate, [])).rejects.toThrow();
  await expect(saveAcquisitionV2Run(7, 9, { ...exampleMandate, priceMax: -1 }, [])).rejects.toThrow();
  expect(store.rows).toEqual([]);
});
it("rejects mismatched identity/hash, incomplete captures, duplicates, and overflow before writing", async () => {
  await begin(); const before = structuredClone(store.rows);
  await expect(saveAcquisitionV2Run(7, 9, exampleMandate, [{ ...capture(), url: source.url + "?other" }])).rejects.toThrow("identity");
  await expect(saveAcquisitionV2Run(7, 9, exampleMandate, [{ ...capture(), contentHash: "0".repeat(64) }])).rejects.toThrow("integrity");
  await expect(saveAcquisitionV2Run(7, 9, exampleMandate, [{ ...source, state: "unresolved", reason: "" }])).rejects.toThrow();
  await expect(saveAcquisitionV2Run(7, 9, exampleMandate, [capture(), capture()])).rejects.toThrow("duplicate");
  await expect(saveAcquisitionV2Run(7, 9, exampleMandate, Array(31).fill(capture()))).rejects.toThrow("replay limit");
  expect(store.rows).toEqual(before);
});
it("returns legacy false/null but denies unauthenticated and foreign V2 access on every API", async () => {
  expect(await assertAcquisitionV2JobAccess(null, 9)).toBe(false);
  expect(await readAcquisitionV2RunState(7, 9)).toBeNull();
  expect(await readAcquisitionV2Run(7, 9)).toEqual([]);
  await begin();
  expect(await assertAcquisitionV2JobAccess(7, 9)).toBe(true);
  await expect(assertAcquisitionV2JobAccess(null, 9)).rejects.toThrow("access denied");
  await expect(assertAcquisitionV2JobAccess(8, 9)).rejects.toThrow("access denied");
  await expect(beginAcquisitionV2Run(8, 9, exampleMandate)).rejects.toThrow("access denied");
  await expect(saveAcquisitionV2Run(8, 9, exampleMandate, [])).rejects.toThrow("access denied");
  await expect(updateAcquisitionV2RunState(8, 9, "failed")).rejects.toThrow("access denied");
  await expect(readAcquisitionV2RunState(8, 9)).rejects.toThrow("access denied");
  await expect(readAcquisitionV2Run(8, 9)).rejects.toThrow("access denied");
  expect(store.rows).toHaveLength(1);
});
it.each(["mandate", "contentHash", "version", "engineVersion", "userId", "jobId", "approvedAt"])("fails closed on manifest tampering: %s", async field => {
  await begin();
  mutate(manifestRow(), value => {
    if (field === "mandate") value.mandate.priceMax += 1;
    else if (field === "version") value.version = 99;
    else if (field === "userId" || field === "jobId") value[field] += 1;
    else if (field === "contentHash") value[field] = "0".repeat(64);
    else value[field] = "invalid";
  });
  await expect(assertAcquisitionV2JobAccess(7, 9)).rejects.toThrow();
  await expect(readAcquisitionV2RunState(7, 9)).rejects.toThrow();
  await expect(save()).rejects.toThrow();
});
it("rejects duplicate manifests and never treats pre-manifest V2 evidence as legacy", async () => {
  await begin(); await save();
  const duplicate = { ...manifestRow(), id: 100 }; store.rows.push(duplicate);
  await expect(assertAcquisitionV2JobAccess(null, 9)).rejects.toThrow("identity conflict");
  store.rows = [captureRow()];
  await expect(assertAcquisitionV2JobAccess(null, 9)).rejects.toThrow("manifest missing");
  await expect(begin()).rejects.toThrow("manifest missing");
});
it.each(["text", "owner", "version", "deletion", "overflow"])("refuses corrupted capture replay or outcome promotion: %s", async kind => {
  await begin(); await save();
  if (kind === "deletion") store.rows = [manifestRow()];
  else if (kind === "overflow") store.rows.push(...Array(31).fill(captureRow()));
  else mutate(captureRow(), value => {
    if (kind === "owner") value.userId = 8;
    else if (kind === "version") value.engineVersion = "acquisition-v2.1";
    else value.text += " changed";
  });
  await expect(readAcquisitionV2Run(7, 9)).rejects.toThrow();
  await expect(updateAcquisitionV2RunState(7, 9, "completed")).rejects.toThrow();
});
it("does not classify storage outage as a legacy job", async () => {
  store.available = false;
  await expect(assertAcquisitionV2JobAccess(null, 9)).rejects.toThrow("unavailable");
  await expect(begin()).rejects.toThrow("unavailable");
});
it("denies a pending V2 job before manifest creation without changing legacy access", async () => {
  store.sources[9] = ["bizbuysell", ACQUISITION_V2_PENDING_SOURCE];
  store.sources[10] = ["bizbuysell"];
  await expect(assertAcquisitionV2JobAccess(null, 9)).rejects.toThrow("manifest pending");
  await expect(assertAcquisitionV2JobAccess(7, 9)).rejects.toThrow("manifest pending");
  expect(await assertAcquisitionV2JobAccess(null, 10)).toBe(false);
  await begin();
  expect(await assertAcquisitionV2JobAccess(7, 9)).toBe(true);
  await expect(assertAcquisitionV2JobAccess(8, 9)).rejects.toThrow("access denied");
});
