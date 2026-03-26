import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  deals,
  signals,
  memos,
  outreach,
  activityLog,
  scanJobs,
  type InsertDeal,
  type InsertSignal,
  type InsertMemo,
  type InsertOutreach,
  type InsertActivityLog,
  type InsertScanJob,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  try {
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Deals ────────────────────────────────────────────────────────────────────
export async function getDeals(opts?: { limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deals).where(eq(deals.isArchived, false))
    .orderBy(desc(deals.score), desc(deals.createdAt))
    .limit(opts?.limit ?? 50).offset(opts?.offset ?? 0);
}

export async function getDealById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  return result[0];
}

export async function createDeal(data: InsertDeal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // ON DUPLICATE KEY UPDATE: if (name, source) already exists, update financials + stage
  // This prevents re-scans from creating duplicate deal rows
  return db.insert(deals).values(data).onDuplicateKeyUpdate({
    set: {
      revenue: data.revenue,
      cashFlow: data.cashFlow,
      askingPrice: data.askingPrice,
      multiple: data.multiple,
      employees: data.employees,
      description: data.description,
      updatedAt: new Date(),
    },
  });
}

// Returns the deal ID for an existing deal by name+source, or null if not found
export async function getDealIdByNameSource(name: string, source?: string | null): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const { and, isNull } = await import("drizzle-orm");
  const conditions = source
    ? [eq(deals.name, name), eq(deals.source, source)]
    : [eq(deals.name, name), isNull(deals.source)];
  const result = await db.select({ id: deals.id }).from(deals).where(and(...conditions)).limit(1);
  return result[0]?.id ?? null;
}

export async function updateDealStage(id: number, stage: typeof deals.$inferSelect["stage"]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(deals).set({ stage, updatedAt: new Date() }).where(eq(deals.id, id));
}

export async function updateDealScore(id: number, score: number, redFlagCount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(deals).set({ score, redFlagCount, updatedAt: new Date() }).where(eq(deals.id, id));
}

export async function getDealStats() {
  const db = await getDb();
  if (!db) return { total: 0, highPriority: 0, avgScore: 0, totalPipelineValue: 0 };
  const allDeals = await db.select().from(deals).where(eq(deals.isArchived, false));
  const total = allDeals.length;
  const highPriority = allDeals.filter(d => d.stage === "high_priority" || d.stage === "in_diligence").length;
  const scored = allDeals.filter(d => d.score !== null);
  const avgScore = scored.length > 0 ? scored.reduce((s, d) => s + (d.score ?? 0), 0) / scored.length : 0;
  const totalPipelineValue = allDeals.reduce((s, d) => s + (d.askingPrice ?? 0), 0);
  return { total, highPriority, avgScore, totalPipelineValue };
}

// ─── Signals ──────────────────────────────────────────────────────────────────
export async function getSignalByDealId(dealId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(signals).where(eq(signals.dealId, dealId)).limit(1);
  return result[0];
}

export async function upsertSignal(data: InsertSignal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getSignalByDealId(data.dealId);
  if (existing) {
    await db.update(signals).set({ ...data, analyzedAt: new Date() }).where(eq(signals.dealId, data.dealId));
  } else {
    await db.insert(signals).values(data);
  }
}

// ─── Memos ────────────────────────────────────────────────────────────────────
export async function getMemos(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memos).orderBy(desc(memos.createdAt)).limit(limit);
}

export async function getMemoByDealId(dealId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(memos).where(eq(memos.dealId, dealId)).orderBy(desc(memos.version)).limit(1);
  return result[0];
}

export async function createMemo(data: InsertMemo) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(memos).values(data);
}

// ─── Outreach ─────────────────────────────────────────────────────────────────
export async function getOutreach(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(outreach).orderBy(desc(outreach.updatedAt)).limit(limit);
}

export async function getOutreachByDealId(dealId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(outreach).where(eq(outreach.dealId, dealId));
}

export async function createOutreach(data: InsertOutreach) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(outreach).values(data);
}

export async function updateOutreachStatus(id: number, status: typeof outreach.$inferSelect["status"], notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(outreach).set({ status, ...(notes ? { notes } : {}), lastContactedAt: new Date(), updatedAt: new Date() }).where(eq(outreach.id, id));
}

export async function getOutreachStats() {
  const db = await getDb();
  if (!db) return { totalSent: 0, responded: 0, scheduled: 0 };
  const all = await db.select().from(outreach);
  return {
    totalSent: all.filter(o => ["sent","opened","replied","meeting_scheduled","closed"].includes(o.status)).length,
    responded: all.filter(o => ["replied","meeting_scheduled","closed"].includes(o.status)).length,
    scheduled: all.filter(o => o.status === "meeting_scheduled").length,
  };
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
export async function getActivityLog(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

export async function logActivity(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values(data);
}

// ─── Scan Jobs ────────────────────────────────────────────────────────────────
export async function getLatestScanJob() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scanJobs).orderBy(desc(scanJobs.createdAt)).limit(1);
  return result[0];
}

export async function createScanJob(data: InsertScanJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(scanJobs).values(data);
}

export async function updateScanJob(id: number, data: Partial<Pick<InsertScanJob, "status" | "listingsFound" | "listingsQualified" | "currentPhase" | "phaseDetail" | "progressPct" | "dealsScored" | "errorMessage" | "completedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(scanJobs).set(data).where(eq(scanJobs.id, id));
}


// ─── Model Config ─────────────────────────────────────────────────────────────
import { modelConfig, type InsertModelConfig } from "../drizzle/schema";
import { DEFAULT_MODULE_MODELS, type AnalysisModule } from "../shared/models";

export async function getModelConfig(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return { ...DEFAULT_MODULE_MODELS };
  try {
    const rows = await db.select().from(modelConfig);
    const config: Record<string, string> = { ...DEFAULT_MODULE_MODELS };
    for (const row of rows) {
      if (row.enabled) config[row.module] = row.modelId;
    }
    return config;
  } catch {
    return { ...DEFAULT_MODULE_MODELS };
  }
}

export async function getModuleModel(module: AnalysisModule): Promise<string> {
  const config = await getModelConfig();
  return config[module] ?? DEFAULT_MODULE_MODELS[module];
}

export async function upsertModelConfig(module: AnalysisModule, modelId: string, enabled = true) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(modelConfig)
    .values({ module, modelId, enabled })
    .onDuplicateKeyUpdate({ set: { modelId, enabled } });
}

export async function getAllModelConfigs() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(modelConfig);
  } catch {
    return [];
  }
}

// ─── Commercial Assets (Scout) ────────────────────────────────────────────────
import { commercialAssets, type InsertCommercialAsset } from "../drizzle/schema";

export async function getCommercialAssets(opts?: { limit?: number; offset?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(commercialAssets)
    .orderBy(desc(commercialAssets.createdAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
  return query;
}

export async function getCommercialAssetById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(commercialAssets).where(eq(commercialAssets.id, id)).limit(1);
  return result[0];
}

export async function createCommercialAsset(data: InsertCommercialAsset) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  return db.insert(commercialAssets).values({ ...data, createdAt: now, updatedAt: now });
}

export async function updateCommercialAssetStatus(id: number, status: typeof commercialAssets.$inferSelect["status"]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(commercialAssets).set({ status, updatedAt: Date.now() }).where(eq(commercialAssets.id, id));
}
