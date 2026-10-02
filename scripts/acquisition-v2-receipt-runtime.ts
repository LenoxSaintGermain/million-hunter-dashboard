/** Run with Node26: DATABASE_URL= pnpm exec tsx scripts/acquisition-v2-receipt-runtime.ts
 * Exact existing Docker UAT target only. No dotenv, migrations, HTTP, or provider imports.
 * Inserts unique test-owned rows, then deletes only those rows in finally.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { eq, inArray } from "drizzle-orm";

const targetDatabase = "capital_aperture_uat_9c18799";
const container = JSON.parse(execFileSync("docker", ["inspect", "sh-ch-capital-uat-db", "--format", "{{json .}}"], { encoding: "utf8" }));
const bindings = container.NetworkSettings?.Ports?.["3306/tcp"];
assert(container.State?.Running && bindings?.length === 1 && bindings[0].HostIp === "127.0.0.1" && bindings[0].HostPort === "3307", "Exact loopback Docker binding required");
const local = Object.fromEntries(container.Config.Env.map((entry: string) => { const split = entry.indexOf("="); return [entry.slice(0, split), entry.slice(split + 1)]; }));
assert(local.MARIADB_DATABASE === targetDatabase && local.MARIADB_ROOT_PASSWORD, "Exact local database identity required");
// Never inherit production credentials or read .env. Set the database before importing db.ts.
for (const name of Object.keys(process.env)) if (/KEY|TOKEN|SECRET|DATABASE|PASSWORD/.test(name)) process.env[name] = "";
process.env.DATABASE_URL = `mysql://root:${encodeURIComponent(local.MARIADB_ROOT_PASSWORD)}@127.0.0.1:3307/${targetDatabase}`;
process.env.NODE_ENV = "test";
globalThis.fetch = async () => { throw new Error("HTTP/provider calls forbidden in receipt acceptance"); };
const observer = await mysql.createConnection({ host: "127.0.0.1", port: 3307, user: "root", password: local.MARIADB_ROOT_PASSWORD, database: targetDatabase });
const marker = `v2-receipt-runtime:${randomUUID()}`;
const jobs: number[] = [], owners: number[] = [];
let db: NonNullable<Awaited<ReturnType<typeof import("../server/db").getDb>>> | undefined;
const passed: string[] = [];
let baseline: Map<string, Map<number, string>> | undefined;
const tables = ["users", "scan_jobs", "research_results"] as const;
// Hash original rows locally; never print original row bodies or credentials.
async function originalRows() {
  const result = new Map<string, Map<number, string>>();
  for (const table of tables) {
    const [rows] = await observer.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${table}\` ORDER BY id`);
    result.set(table, new Map(rows.map(row => [row.id, createHash("sha256").update(JSON.stringify(row)).digest("hex")])));
  }
  return result;
}
const check = async (name: string, action: () => Promise<void>) => { await action(); passed.push(name); console.log(`PASS ${name}`); };
try {
  const [identity] = await observer.query<mysql.RowDataPacket[]>("SELECT DATABASE() AS db, VERSION() AS version, @@hostname AS host, @@port AS port");
  assert.equal(identity[0].db, targetDatabase);
  assert.equal(identity[0].host, container.Config.Hostname);
  assert.equal(Number(identity[0].port), 3306);
  const [engines] = await observer.query<mysql.RowDataPacket[]>("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('users','scan_jobs','research_results')", [targetDatabase]);
  assert.equal(engines.length, 3, "Required tables missing; do not migrate this existing fixture");
  assert(engines.every(row => row.engine === "InnoDB"), "Transactional InnoDB tables required");
  console.log(JSON.stringify({ target: "127.0.0.1:3307", database: targetDatabase, engine: identity[0].version, marker }));
  baseline = await originalRows();
  const schema = await import("../drizzle/schema");
  const shared = await import("../shared/acquisitionV2");
  const receipt = await import("../server/acquisitionV2Runs");
  const { getDb } = await import("../server/db");
  db = (await getDb()) ?? undefined;
  assert(db, "Database adapter unavailable");
  const store = db;
  for (const suffix of ["owner", "foreign"]) {
    const [result] = await store.insert(schema.users).values({ openId: `${marker}:${suffix}`, name: `${marker}:${suffix}`, role: "user" });
    const ownerId = Number(result.insertId); assert(ownerId > 0); owners.push(ownerId);
  }
  async function job() {
    const [result] = await store.insert(schema.scanJobs).values({ status: "running", sources: [receipt.ACQUISITION_V2_PENDING_SOURCE, marker], currentPhase: marker });
    const jobId = Number(result.insertId); assert(jobId > 0); jobs.push(jobId); return jobId;
  }
  const mandate = { ...shared.exampleMandate, version: marker };
  const source = { url: "https://www.bizbuysell.com/business-opportunity/illustrative-runtime-fixture/1234567/", fetchedAt: new Date().toISOString(), type: "primary" as const };
  const body = "Illustrative runtime fixture, not a real listing.\nAsking Price: $1,850,000\nRevenue: $3,590,234\nSDE: $702,537";
  const capture = (text = body) => ({ ...source, state: "captured" as const, evidence: shared.extractListingEvidence({ ...source, text }), contentHash: createHash("sha256").update(text).digest("hex") });
  const keys = (jobId: number) => [`acquisition-v2:search:${jobId}:manifest`, `acquisition-v2:user:${owners[0]}:search:${jobId}`];
  async function rows(jobId: number) {
    const [result] = await observer.query<mysql.RowDataPacket[]>("SELECT * FROM research_results WHERE subject_key IN (?, ?) ORDER BY id", keys(jobId));
    return result;
  }
  const main = await job();
  await check("pending marker denies reads before begin", async () => {
    await assert.rejects(receipt.assertAcquisitionV2JobAccess(null, main), /manifest pending/);
  });
  await check("concurrent first begin serializes to one durable manifest", async () => {
    const states = await Promise.all(Array.from({ length: 6 }, () => receipt.beginAcquisitionV2Run(owners[0], main, mandate)));
    states.forEach(state => assert.deepEqual(state, states[0]));
    assert.equal((await rows(main)).length, 1);
    assert.deepEqual(await receipt.readAcquisitionV2RunState(owners[0], main), states[0]);
  });
  await check("actual row lock blocks concurrent writer until transaction release", async () => {
    await observer.beginTransaction();
    let pending: Promise<unknown> | undefined;
    try {
      await observer.query("SELECT id FROM scan_jobs WHERE id = ? FOR UPDATE", [main]);
      let settled = false;
      pending = receipt.beginAcquisitionV2Run(owners[0], main, mandate).finally(() => { settled = true; });
      let observedWait = false;
      for (let attempt = 0; attempt < 20 && !observedWait; attempt++) {
        const [waits] = await observer.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS waiting FROM information_schema.INNODB_LOCK_WAITS w JOIN information_schema.INNODB_TRX t ON w.blocking_trx_id = t.trx_id WHERE t.trx_mysql_thread_id = CONNECTION_ID()");
        observedWait = Number(waits[0].waiting) > 0;
        if (!observedWait) await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert(observedWait, "Engine did not expose a writer waiting on this transaction's lock");
      assert.equal(settled, false);
    } finally { await observer.rollback(); await pending; }
  });
  await check("foreign and unauthenticated callers denied without receipt changes", async () => {
    const before = await rows(main);
    await assert.rejects(receipt.assertAcquisitionV2JobAccess(null, main), /access denied/);
    await assert.rejects(receipt.assertAcquisitionV2JobAccess(owners[1], main), /access denied/);
    await assert.rejects(receipt.readAcquisitionV2RunState(owners[1], main), /access denied/);
    await assert.rejects(receipt.readAcquisitionV2Run(owners[1], main), /access denied/);
    await assert.rejects(receipt.beginAcquisitionV2Run(owners[1], main, mandate), /access denied/);
    await assert.rejects(receipt.saveAcquisitionV2Run(owners[1], main, mandate, []), /access denied/);
    await assert.rejects(receipt.updateAcquisitionV2RunState(owners[1], main, "failed"), /access denied/);
    assert.deepEqual(await rows(main), before);
  });
  await check("concurrent capture retries commit one immutable capture", async () => {
    await Promise.all(Array.from({ length: 6 }, () => receipt.saveAcquisitionV2Run(owners[0], main, mandate, [capture()])));
    assert.equal((await rows(main)).length, 2);
    const before = await rows(main);
    await assert.rejects(receipt.saveAcquisitionV2Run(owners[0], main, mandate, [capture(body + "\nChanged claim")]), /retry conflict/);
    await assert.rejects(receipt.beginAcquisitionV2Run(owners[0], main, { ...mandate, priceMax: 4000000 }), /approval content mismatch/);
    assert.deepEqual(await rows(main), before);
    const report = await receipt.readAcquisitionV2Run(owners[0], main);
    assert.equal(report.length, 1); assert.equal(report[0].report?.verdict.value, "HOLD");
    await receipt.updateAcquisitionV2RunState(owners[0], main, "completed");
    const completed = await rows(main);
    await receipt.saveAcquisitionV2Run(owners[0], main, mandate, [capture()]);
    await assert.rejects(receipt.updateAcquisitionV2RunState(owners[0], main, "capturing"), /immutable/);
    assert.deepEqual(await rows(main), completed);
  });
  await check("empty and pre-capture failed outcomes survive independent SQL reads", async () => {
    const empty = await job(); await receipt.beginAcquisitionV2Run(owners[0], empty, mandate);
    await receipt.saveAcquisitionV2Run(owners[0], empty, mandate, []);
    await receipt.updateAcquisitionV2RunState(owners[0], empty, "completed");
    const savedEmpty = JSON.parse((await rows(empty))[0].content);
    assert.equal(savedEmpty.state, "completed"); assert.equal(savedEmpty.capturesSaved, true); assert.deepEqual(savedEmpty.captures, []);
    assert.deepEqual(await receipt.readAcquisitionV2Run(owners[0], empty), []);
    const failed = await job(); await receipt.beginAcquisitionV2Run(owners[0], failed, mandate);
    await receipt.updateAcquisitionV2RunState(owners[0], failed, "failed", "Intentional runtime fixture failure before capture");
    assert.equal(JSON.parse((await rows(failed))[0].content).state, "failed");
    assert.equal((await receipt.readAcquisitionV2RunState(owners[0], failed))?.capturesSaved, false);
  });
  await check("oversized manifest failure rolls back already-issued capture inserts", async () => {
    const rollback = await job(); await receipt.beginAcquisitionV2Run(owners[0], rollback, mandate);
    const before = await rows(rollback);
    const captures = Array.from({ length: 30 }, (_, i) => ({ ...source, url: `${source.url}?fixture=${i}-${"x".repeat(2500)}`, state: "unresolved" as const, reason: "Synthetic rollback fixture" }));
    await assert.rejects(receipt.saveAcquisitionV2Run(owners[0], rollback, mandate, captures), /manifest exceeds safe storage size/);
    assert.deepEqual(await rows(rollback), before);
    assert.equal((await receipt.readAcquisitionV2RunState(owners[0], rollback))?.capturesSaved, false);
  });
} finally {
  try {
    if (db) {
      const schema = await import("../drizzle/schema");
      // Exact keys derive only from auto-generated IDs inserted by this invocation.
      for (const jobId of jobs) {
        await db.delete(schema.researchResults).where(inArray(schema.researchResults.subjectKey, [
          `acquisition-v2:search:${jobId}:manifest`, ...owners.map(owner => `acquisition-v2:user:${owner}:search:${jobId}`),
        ]));
        await db.delete(schema.scanJobs).where(eq(schema.scanJobs.id, jobId));
        const [remaining] = await observer.query<mysql.RowDataPacket[]>("SELECT id FROM research_results WHERE subject_key IN (?, ?, ?)", [
          `acquisition-v2:search:${jobId}:manifest`, ...owners.map(owner => `acquisition-v2:user:${owner}:search:${jobId}`),
        ]);
        assert.equal(remaining.length, 0, "Test receipt cleanup failed");
      }
      for (const owner of owners) await db.delete(schema.users).where(eq(schema.users.id, owner));
    }
    if (baseline) {
      const after = await originalRows();
      for (const [table, originals] of baseline) for (const [rowId, contentHash] of originals) {
        assert.equal(after.get(table)?.get(rowId), contentHash, `Original ${table} row ${rowId} changed during runtime acceptance`);
      }
      for (const jobId of jobs) assert(!after.get("scan_jobs")?.has(jobId), "Test job cleanup failed");
      for (const owner of owners) assert(!after.get("users")?.has(owner), "Test owner cleanup failed");
      console.log(JSON.stringify({ checksPassed: passed.length, testJobsRemoved: jobs.length, testOwnersRemoved: owners.length, originalRowsUnchanged: true }));
    }
  } finally {
    await observer.end();
    if (db) await db.$client.end();
  }
}
