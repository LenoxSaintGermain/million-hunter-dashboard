import { createHash } from "node:crypto";
import { and, desc, eq, like } from "drizzle-orm";
import { z } from "zod";
import { researchResults, scanJobs } from "../drizzle/schema";
import { ACQUISITION_V2_ENGINE_VERSION, acquisitionMandateSchema, evaluateAcquisitionV2, extractListingEvidence, type AcquisitionMandate } from "../shared/acquisitionV2";
import {
  simulateAcquisitionV2,
  applyWalkAwayRefusal,
  exampleGamePriors,
  gamePriorsSchema,
  type WaterfallCosts,
} from "../shared/acquisitionGameTheory";
import { getDb } from "./db";
import type { ListingCapture } from "./acquisitionCapture";

const id = z.number().int().positive();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });
const stateSchema = z.enum(["capturing", "completed", "failed"]);
const reasonSchema = z.string().trim().min(1).max(2000).optional();
const snapshot = z.object({ version: z.literal(2), engineVersion: z.string(), userId: id, jobId: id,
  mandate: acquisitionMandateSchema, url: z.string().url(), fetchedAt: timestamp, state: z.enum(["captured", "unresolved", "unavailable"]),
  text: z.string().min(1).max(60000).optional(), hash: digest.optional(), reason: reasonSchema })
  .refine(v => v.state === "captured" ? !!v.text && !!v.hash : !!v.reason, "V2 capture state is incomplete");

export const scenarioReceiptSchema = z.object({
  version: z.literal(1),
  approvedAt: timestamp,
  approvedBy: z.string(),
  costs: z.object({
    ownerReplacement: z.number().finite().nonnegative(),
    marketRent: z.number().finite().nonnegative(),
    capexReserve: z.number().finite().nonnegative(),
    qualifierFee: z.number().finite().nonnegative(),
    investorReturn: z.number().finite().nonnegative(),
  }),
  priors: z.record(z.string(), z.unknown()),
  simulation: z.object({
    evUnprotected: z.number(),
    evProtected: z.number(),
    difference: z.number(),
    priceReduction: z.number(),
    walkAwayCondition: z.string(),
    countermoves: z.array(z.object({
      id: z.string(),
      flagId: z.string(),
      title: z.string(),
      description: z.string(),
      marginalEvGain: z.number(),
      walkAway: z.boolean(),
    })),
    monteCarlo: z.object({
      draws: z.literal(10000),
      p10: z.number(),
      p50: z.number(),
      p90: z.number(),
      dscrBelowThresholdProb: z.number(),
    }),
  }),
  walkAwayTriggered: z.boolean().default(false),
  verdictOverride: z.enum(["WATCHLIST"]).nullable().optional(),
  refusalReason: z.string().nullable().optional(),
});
export type AcquisitionV2ScenarioReceipt = z.infer<typeof scenarioReceiptSchema>;

const manifestSchema = z.object({
  version: z.literal(1), kind: z.literal("acquisition-v2-run"), engineVersion: z.string(), userId: id, jobId: id,
  mandate: acquisitionMandateSchema, mandateHash: digest, approvedAt: timestamp, updatedAt: timestamp,
  state: stateSchema, reason: reasonSchema, capturesSaved: z.boolean(),
  captures: z.array(z.object({ url: z.string().url(), contentHash: digest })).max(30),
  scenarioReceipt: scenarioReceiptSchema.nullable().optional(),
  contentHash: digest,
}).strict().refine(v => (v.capturesSaved || v.captures.length === 0) && (v.state !== "completed" || v.capturesSaved), "V2 manifest outcome is incomplete");
export type AcquisitionV2RunState = z.infer<typeof manifestSchema>;
/** Parent includes this in createScanJob.sources, never in provider inputs. It closes
 * the getLatest/getStatus privacy window before begin commits (or if begin fails). */
export const ACQUISITION_V2_PENDING_SOURCE = "__acquisition_v2_pending__";

// Canonical JSON keeps approval and receipt hashes independent of object key order.
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const key = (userId: number, jobId: number) => `acquisition-v2:user:${id.parse(userId)}:search:${id.parse(jobId)}`;
// Global job identity enables legacy endpoints to check ownership without returning the body.
const manifestKey = (jobId: number) => `acquisition-v2:search:${id.parse(jobId)}:manifest`;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select">;
async function database() {
  const db = await getDb();
  if (!db) throw new Error("V2 evidence unavailable");
  return db;
}
async function locked<T>(jobId: number, action: (tx: Transaction) => Promise<T>): Promise<T> {
  id.parse(jobId);
  return (await database()).transaction(async tx => {
    // research_results has no unique subjectKey. Lock an existing durable row before
    // checking/inserting, including first begin; an in-process mutex is insufficient.
    const jobs = await tx.select({ id: scanJobs.id }).from(scanJobs).where(eq(scanJobs.id, jobId)).for("update");
    if (jobs.length !== 1) throw new Error("V2 scan job not found");
    return action(tx);
  });
}
function seal(value: Omit<AcquisitionV2RunState, "contentHash">): AcquisitionV2RunState {
  return manifestSchema.parse({ ...value, contentHash: hash(value) });
}
async function manifestRow(db: Reader, jobId: number) {
  const rows = await db.select().from(researchResults).where(eq(researchResults.subjectKey, manifestKey(jobId))).limit(2);
  if (rows.length > 1) throw new Error("V2 manifest identity conflict");
  if (!rows.length) {
    // Pre-manifest V2 snapshots must not be misclassified as public legacy jobs.
    const orphan = await db.select({ id: researchResults.id }).from(researchResults).where(and(
      eq(researchResults.model, "deterministic-acquisition-v2"),
      like(researchResults.subjectKey, `acquisition-v2:user:%:search:${jobId}`),
    )).limit(1);
    if (orphan.length) throw new Error("V2 manifest missing for existing evidence");
    return null;
  }
  const value = manifestSchema.parse(JSON.parse(rows[0].content));
  if (value.jobId !== jobId) throw new Error("V2 manifest job mismatch");
  if (value.engineVersion !== ACQUISITION_V2_ENGINE_VERSION) throw new Error("V2 engine version mismatch; explicit re-evaluation required");
  const { contentHash, ...body } = value;
  if (hash(body) !== contentHash || hash(value.mandate) !== value.mandateHash) throw new Error("V2 manifest integrity mismatch");
  if (new Set(value.captures.map(c => c.url)).size !== value.captures.length) throw new Error("V2 manifest capture identity conflict");
  return { row: rows[0], value };
}
function own(value: AcquisitionV2RunState, userId: number | null) {
  if (userId === null || !id.safeParse(userId).success || value.userId !== userId) throw new Error("V2 job access denied");
}
async function requiredManifest(db: Reader, userId: number, jobId: number) {
  const found = await manifestRow(db, jobId);
  if (!found) throw new Error("V2 run must begin before saving or updating");
  own(found.value, userId);
  return found;
}
function rowValue(subjectKey: string, content: string, citations: string[], expiresAt: number) {
  if (Buffer.byteLength(content) > 63000) throw new Error("V2 capture exceeds safe storage size; run not promoted");
  return { subjectKey, subjectType: "market" as const, model: "deterministic-acquisition-v2", query: "Operator-confirmed V2 run receipt", content, citations, createdAt: Date.now(), expiresAt };
}
async function writeManifest(tx: Transaction, rowId: number, value: AcquisitionV2RunState) {
  const content = canonical(value);
  if (Buffer.byteLength(content) > 63000) throw new Error("V2 manifest exceeds safe storage size");
  await tx.update(researchResults).set({ content }).where(eq(researchResults.id, rowId));
}

/** Caller must authenticate and obtain explicit approval first. This records that act,
 * not permission to buy, contact a broker, or launch additional research. */
export async function beginAcquisitionV2Run(userId: number, jobId: number, mandate: AcquisitionMandate) {
  key(userId, jobId);
  const validatedMandate = acquisitionMandateSchema.parse(mandate);
  const mandateHash = hash(validatedMandate);
  return locked(jobId, async tx => {
    const existing = await manifestRow(tx, jobId);
    if (existing) {
      own(existing.value, userId);
      if (existing.value.mandateHash !== mandateHash) throw new Error("V2 approval content mismatch; begin a new job");
      return existing.value;
    }
    const now = new Date().toISOString();
    const value = seal({ version: 1, kind: "acquisition-v2-run", engineVersion: ACQUISITION_V2_ENGINE_VERSION,
      userId, jobId, mandate: validatedMandate, mandateHash, approvedAt: now, updatedAt: now,
      state: "capturing", capturesSaved: false, captures: [] });
    // Manifests are durable receipts, not expiring research cache entries.
    await tx.insert(researchResults).values(rowValue(manifestKey(jobId), canonical(value), [], Number.MAX_SAFE_INTEGER));
    return value;
  });
}

export async function assertAcquisitionV2JobAccess(userId: number | null, jobId: number): Promise<boolean> {
  const db = await database();
  const found = await manifestRow(db, jobId);
  if (!found) {
    const [job] = await db.select({ sources: scanJobs.sources }).from(scanJobs).where(eq(scanJobs.id, jobId)).limit(1);
    const sources = typeof job?.sources === "string" ? JSON.parse(job.sources) : job?.sources;
    if (Array.isArray(sources) && sources.includes(ACQUISITION_V2_PENDING_SOURCE)) throw new Error("V2 job access denied; manifest pending");
    return false;
  }
  own(found.value, userId);
  return true;
}
export async function readAcquisitionV2RunState(userId: number, jobId: number): Promise<AcquisitionV2RunState | null> {
  key(userId, jobId);
  const found = await manifestRow(await database(), jobId);
  if (!found) return null;
  own(found.value, userId);
  return found.value;
}

async function captureRows(db: Reader, userId: number, jobId: number, manifest: AcquisitionV2RunState) {
  const rows = await db.select().from(researchResults).where(eq(researchResults.subjectKey, key(userId, jobId))).orderBy(desc(researchResults.id)).limit(31);
  if (rows.length > 30) throw new Error("V2 run exceeds replay limit; incomplete report refused");
  if (rows.length !== manifest.captures.length) throw new Error("V2 capture receipt integrity mismatch");
  const seen = new Set<string>();
  return rows.map(row => {
    const record = snapshot.parse(JSON.parse(row.content));
    if (record.userId !== userId || record.jobId !== jobId) throw new Error("V2 record owner mismatch");
    if (record.engineVersion !== ACQUISITION_V2_ENGINE_VERSION) throw new Error("V2 engine version mismatch; explicit re-evaluation required");
    if (seen.has(record.url)) throw new Error("V2 capture identity conflict");
    seen.add(record.url);
    if (hash(record.mandate) !== manifest.mandateHash || manifest.captures.find(c => c.url === record.url)?.contentHash !== hash(record)) throw new Error("V2 capture receipt integrity mismatch");
    if (record.state === "captured" && createHash("sha256").update(record.text!).digest("hex") !== record.hash) throw new Error("V2 evidence integrity mismatch");
    return { row, record };
  });
}

export async function saveAcquisitionV2Run(userId: number, jobId: number, mandate: AcquisitionMandate, captures: ListingCapture[]) {
  const subjectKey = key(userId, jobId);
  const validatedMandate = acquisitionMandateSchema.parse(mandate);
  if (captures.length > 30) throw new Error("V2 run exceeds replay limit; run not promoted");
  const records = captures.map(capture => {
    if (capture.state === "captured") {
      if (capture.evidence.source.url !== capture.url || capture.evidence.source.fetchedAt !== capture.fetchedAt || capture.evidence.source.type !== "primary") throw new Error("V2 capture identity mismatch");
      if (createHash("sha256").update(capture.evidence.text).digest("hex") !== capture.contentHash) throw new Error("V2 evidence integrity mismatch");
    }
    return snapshot.parse({ ...capture, version: 2, engineVersion: ACQUISITION_V2_ENGINE_VERSION, userId, jobId, mandate: validatedMandate,
      text: capture.state === "captured" ? capture.evidence.text : undefined,
      hash: capture.state === "captured" ? capture.contentHash : undefined });
  });
  if (new Set(records.map(r => r.url)).size !== records.length) throw new Error("V2 duplicate capture identity");
  const entries = records.map(record => ({ url: record.url, contentHash: hash(record) })).sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
  return locked(jobId, async tx => {
    const { row, value } = await requiredManifest(tx, userId, jobId);
    if (hash(validatedMandate) !== value.mandateHash) throw new Error("V2 approval content mismatch");
    await captureRows(tx, userId, jobId, value);
    if (value.capturesSaved) {
      if (canonical(entries) !== canonical(value.captures)) throw new Error("V2 capture retry conflict; existing evidence preserved");
      return; // Exact retry, including after completion; never refresh timestamps or expiry.
    }
    if (value.state !== "capturing") throw new Error("V2 terminal run cannot accept new captures");
    const values = records.map(record => rowValue(subjectKey, canonical(record), [record.url], Date.parse(record.fetchedAt) + 72 * 3600 * 1000));
    if (values.length) await tx.insert(researchResults).values(values);
    const { contentHash: _hash, ...body } = value;
    await writeManifest(tx, row.id, seal({ ...body, capturesSaved: true, captures: entries, updatedAt: new Date().toISOString() }));
  });
}

export async function updateAcquisitionV2RunState(userId: number, jobId: number, state: "capturing" | "completed" | "failed", reason?: string) {
  key(userId, jobId);
  stateSchema.parse(state);
  const validatedReason = reasonSchema.parse(reason);
  return locked(jobId, async tx => {
    const { row, value } = await requiredManifest(tx, userId, jobId);
    await captureRows(tx, userId, jobId, value);
    if (value.state === state && value.reason === validatedReason) return value;
    if (value.state !== "capturing") throw new Error("V2 terminal outcome is immutable");
    if (state === "completed" && !value.capturesSaved) throw new Error("V2 completion requires a saved capture receipt, including an empty receipt");
    const { contentHash: _hash, ...body } = value;
    const next = seal({ ...body, state, reason: validatedReason, updatedAt: new Date().toISOString() });
    await writeManifest(tx, row.id, next);
    return next;
  });
}

/** Existing array response preserved. Run-level empty/failure outcome is a separate API. */
export async function readAcquisitionV2Run(userId: number, jobId: number) {
  key(userId, jobId);
  return locked(jobId, async tx => {
    const found = await manifestRow(tx, jobId);
    if (!found) return [];
    own(found.value, userId);
    const rows = await captureRows(tx, userId, jobId, found.value);
    const scenarioReceipt = found.value.scenarioReceipt ?? null;
    return rows.map(({ row, record }) => {
      if (record.state !== "captured") return { url: record.url, state: record.state, reason: record.reason, report: null, stale: row.expiresAt <= Date.now() };
      const report = evaluateAcquisitionV2(extractListingEvidence({ url: record.url, fetchedAt: record.fetchedAt, type: "primary", text: record.text! }), record.mandate);
      if (scenarioReceipt) {
        (report as Record<string, unknown>).scenarioReceipt = scenarioReceipt;
        if (scenarioReceipt.walkAwayTriggered && scenarioReceipt.verdictOverride) {
          report.verdict.value = scenarioReceipt.verdictOverride;
          report.verdict.reason = `${scenarioReceipt.refusalReason}; ${report.verdict.reason}`;
        }
      }
      return { url: record.url, state: record.state, reason: undefined, stale: row.expiresAt <= Date.now(), report };
    });
  });
}

export async function saveAcquisitionV2Scenario(
  userId: number,
  jobId: number,
  params: {
    costs: WaterfallCosts;
    priors?: z.infer<typeof gamePriorsSchema>;
    refusedMoveId?: string;
  }
) {
  key(userId, jobId);
  return locked(jobId, async tx => {
    const { row, value } = await requiredManifest(tx, userId, jobId);
    if (value.state !== "completed") {
      throw new Error("V2 run must be completed before saving scenario analysis");
    }
    const captures = await captureRows(tx, userId, jobId, value);
    const validListing = captures.find(c => c.record.state === "captured" && c.record.text);
    if (!validListing) {
      throw new Error("No captured listing evidence available for scenario analysis");
    }
    const evidence = extractListingEvidence({
      url: validListing.record.url,
      fetchedAt: validListing.record.fetchedAt,
      type: "primary",
      text: validListing.record.text!,
    });
    const ask = evidence.fields.ask.value;
    const sde = evidence.fields.sde.value;
    if (ask == null || sde == null) {
      throw new Error("Core ask and SDE claims required for scenario waterfall");
    }
    const report = evaluateAcquisitionV2(evidence, value.mandate);
    const flags = report.redFlags.map(f => f.id);
    const simulation = simulateAcquisitionV2({
      ask,
      sde,
      mandate: value.mandate,
      costs: params.costs,
      flags,
      priors: params.priors ?? exampleGamePriors,
    });

    let refusalResult = null;
    if (params.refusedMoveId) {
      refusalResult = applyWalkAwayRefusal(simulation, params.refusedMoveId);
    }

    const now = new Date().toISOString();
    const scenarioReceipt: AcquisitionV2ScenarioReceipt = scenarioReceiptSchema.parse({
      version: 1,
      approvedAt: now,
      approvedBy: `user_${userId}`,
      costs: params.costs,
      priors: params.priors ?? exampleGamePriors,
      simulation: {
        evUnprotected: simulation.evUnprotected,
        evProtected: simulation.evProtected,
        difference: simulation.difference,
        priceReduction: simulation.priceReduction,
        walkAwayCondition: simulation.walkAwayCondition,
        countermoves: simulation.countermoves,
        monteCarlo: simulation.monteCarlo,
      },
      walkAwayTriggered: refusalResult?.walkAwayTriggered ?? false,
      verdictOverride: refusalResult?.verdictOverride ?? null,
      refusalReason: refusalResult?.reason ?? null,
    });

    const { contentHash: _h, ...body } = value;
    const next = seal({ ...body, scenarioReceipt, updatedAt: now });
    await writeManifest(tx, row.id, next);
    return next;
  });
}
