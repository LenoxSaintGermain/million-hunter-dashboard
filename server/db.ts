import { eq, desc, and, lt, isNotNull } from "drizzle-orm";
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
  // Role assignment: set on INSERT only — never overwrite on re-login (preserves operator-assigned roles).
  // Owner → admin. New sign-ins default to 'user' (operator experience).
  // Assign 'investor' role manually via Admin Panel for capital allocators.
  if (user.role !== undefined) {
    values.role = user.role;
    // Don't put role in updateSet — operator may have changed it
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    // Don't put in updateSet — preserve admin on re-login without overwriting
  } else {
    // New users default to 'user' (operator/UAT experience).
    // Intentionally NOT in updateSet — role is set once at registration.
    values.role = "user";
  }
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
  // Fetch a larger window so dedup doesn't starve the result set
  const raw = await db.select().from(deals).where(eq(deals.isArchived, false))
    .orderBy(desc(deals.score), desc(deals.createdAt))
    .limit((opts?.limit ?? 50) * 4).offset(opts?.offset ?? 0);
  // Deduplicate by name (case-insensitive) — keep highest-score entry per unique name
  const seen = new Map<string, typeof raw[0]>();
  for (const deal of raw) {
    const key = deal.name.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing || (deal.score ?? 0) > (existing.score ?? 0)) {
      seen.set(key, deal);
    }
  }
  return Array.from(seen.values()).slice(0, opts?.limit ?? 50);
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
  return await query;
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

export async function updateCommercialAssetAiScore(id: number, score: number, summary?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(commercialAssets)
    .set({ aiScore: score, aiAnalysis: summary ?? null, status: "reviewing", updatedAt: Date.now() })
    .where(eq(commercialAssets.id, id));
}

// ─── Macro Signals ────────────────────────────────────────────────────────────
import { macroSignals, type InsertMacroSignal } from "../drizzle/schema";

export async function getMacroSignals(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(macroSignals)
    .orderBy(desc(macroSignals.createdAt))
    .limit(limit);
}

export async function insertMacroSignal(data: Omit<InsertMacroSignal, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(macroSignals).values({ ...data, createdAt: Date.now() });
}

export async function seedMacroSignals() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(macroSignals).limit(1);
  if (existing.length > 0) return { seeded: false, message: "Already seeded" };

  const now = Date.now();
  const seeds: Omit<InsertMacroSignal, "id">[] = [
    {
      signalType: "institutional",
      title: "Blackstone Acquires 3 Atlanta Industrial Parks",
      summary: "Blackstone Real Estate closed on $420M in Atlanta industrial assets near I-285 corridor, signaling continued institutional appetite for Southeast logistics.",
      roryPitch: "When the world's largest real estate fund bets $420M on Atlanta warehouses, the question isn't whether the market is hot — it's whether you're positioned before the next wave.",
      impactedAssetClasses: ["industrial", "warehouse", "flex"],
      recommendedAction: "Prioritize industrial assets within 5mi of I-285/I-20 interchange. Seller motivation may spike as smaller owners exit ahead of institutional compression.",
      confidenceScore: 0.91,
      sourceUrl: "https://www.wsj.com/real-estate",
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      createdAt: now - 2 * 60 * 60 * 1000,
    },
    {
      signalType: "government",
      title: "Atlanta BeltLine TAD Extension Approved — $180M Committed",
      summary: "Atlanta City Council approved a $180M TAD bond issuance extending the BeltLine Tax Allocation District to include Westside and Southside corridors through 2035.",
      roryPitch: "Government money rarely moves fast, but when it does, it creates a decade-long tailwind. The BeltLine TAD extension is a 10-year free ride for anyone who positions now.",
      impactedAssetClasses: ["retail", "mixed_use", "office"],
      recommendedAction: "Scan for distressed retail and mixed-use within 0.5mi of new TAD boundary. Seller expectations may not yet reflect the infrastructure premium.",
      confidenceScore: 0.95,
      sourceUrl: "https://www.atlantaga.gov/beltline",
      expiresAt: now + 90 * 24 * 60 * 60 * 1000,
      createdAt: now - 5 * 60 * 60 * 1000,
    },
    {
      signalType: "event",
      title: "Super Bowl LXI Awarded to Atlanta — 2027",
      summary: "The NFL awarded Super Bowl LXI to Atlanta, expected to generate $400M+ in economic activity and drive 18-month pre-event hospitality and retail demand surge.",
      roryPitch: "Super Bowls don't just fill hotels — they compress cap rates. Every hospitality and retail asset within 3 miles of Mercedes-Benz Stadium just got a 2-year demand guarantee.",
      impactedAssetClasses: ["retail", "mixed_use", "office"],
      recommendedAction: "Target hospitality-adjacent retail and flex space near downtown Atlanta. Acquisition window is 12 months before event premiums are fully priced in.",
      confidenceScore: 0.88,
      sourceUrl: "https://www.nfl.com/super-bowl",
      expiresAt: now + 180 * 24 * 60 * 60 * 1000,
      createdAt: now - 12 * 60 * 60 * 1000,
    },
    {
      signalType: "macro_momentum",
      title: "Fed Signals Rate Pause — CRE Financing Window Opens",
      summary: "Federal Reserve minutes indicate a likely pause in rate hikes through Q3 2026, reducing DSCR pressure on commercial real estate acquisitions and improving SBA 7(a) deal economics.",
      roryPitch: "Rate pauses are the market's exhale. Every month the Fed holds, the SBA deal math gets better. This is the window — not the warning.",
      impactedAssetClasses: ["industrial", "retail", "warehouse", "office"],
      recommendedAction: "Accelerate LOI submissions on qualified deals. Lock 10-year SBA rates before any policy reversal. Current DSCR thresholds favor deals with 1.25x+ coverage.",
      confidenceScore: 0.79,
      sourceUrl: "https://www.federalreserve.gov",
      expiresAt: now + 60 * 24 * 60 * 60 * 1000,
      createdAt: now - 24 * 60 * 60 * 1000,
    },
    {
      signalType: "seasonal",
      title: "Q2 Seller Motivation Peak — Listing Volume Up 23%",
      summary: "BizBuySell and LoopNet data show Q2 historically produces 23% more motivated seller listings as owners target summer closing timelines before fiscal year-end.",
      roryPitch: "Sellers who list in April want to close by July. That urgency is your leverage — not a coincidence.",
      impactedAssetClasses: ["retail", "industrial", "mixed_use", "warehouse"],
      recommendedAction: "Increase scan frequency to daily. Prioritize listings posted within last 14 days. Seller motivation peaks in weeks 6-10 after initial listing.",
      confidenceScore: 0.82,
      sourceUrl: null,
      expiresAt: now + 45 * 24 * 60 * 60 * 1000,
      createdAt: now - 36 * 60 * 60 * 1000,
    },
  ];

  await db.insert(macroSignals).values(seeds);
  return { seeded: true, count: seeds.length };
}

// ─── Sentinel Auto-Archive ────────────────────────────────────────────────────
import { dealShareTokens, type InsertDealShareToken } from "../drizzle/schema";

export async function archiveExpiredSignals(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = Date.now();
  const result = await db.update(macroSignals)
    .set({ archived: true })
    .where(and(
      isNotNull(macroSignals.expiresAt),
      lt(macroSignals.expiresAt, now),
      eq(macroSignals.archived, false),
    ));
  const affected = (result as any)[0]?.affectedRows ?? 0;
  return affected;
}

export async function archiveSignalById(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(macroSignals).set({ archived: true }).where(eq(macroSignals.id, id));
}

export async function getMacroSignalsActive(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(macroSignals)
    .where(eq(macroSignals.archived, false))
    .orderBy(desc(macroSignals.confidenceScore))
    .limit(limit);
}

// ─── Deal Share Tokens ────────────────────────────────────────────────────────
export async function createDealShareToken(dealId: number, ttlDays = 30): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { randomBytes } = await import("crypto");
  const token = randomBytes(24).toString("hex"); // 48-char hex token
  const now = Date.now();
  const expiresAt = now + ttlDays * 24 * 60 * 60 * 1000;
  await db.insert(dealShareTokens).values({ token, dealId, expiresAt, viewCount: 0, createdAt: now });
  return token;
}

export async function getDealShareToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dealShareTokens).where(eq(dealShareTokens.token, token)).limit(1);
  return result[0];
}

export async function incrementShareTokenViewCount(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const row = await getDealShareToken(token);
  if (!row) return;
  await db.update(dealShareTokens)
    .set({ viewCount: row.viewCount + 1 })
    .where(eq(dealShareTokens.token, token));
}
