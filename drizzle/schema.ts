import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  json,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Deals (core acquisition opportunities) ───────────────────────────────────
export const deals = mysqlTable("deals", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 128 }),
  source: varchar("source", { length: 64 }),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  industry: varchar("industry", { length: 128 }),
  location: varchar("location", { length: 256 }),
  askingPrice: bigint("askingPrice", { mode: "number" }),
  revenue: bigint("revenue", { mode: "number" }),
  cashFlow: bigint("cashFlow", { mode: "number" }),
  ebitda: bigint("ebitda", { mode: "number" }),
  multiple: float("multiple"),
  employees: int("employees"),
  yearEstablished: int("yearEstablished"),
  listingUrl: text("listingUrl"),
  stage: mysqlEnum("stage", [
    "new",
    "scanning",
    "qualified",
    "high_priority",
    "in_diligence",
    "loi_sent",
    "under_contract",
    "closed",
    "passed",
  ]).default("new").notNull(),
  score: float("score"),
  redFlagCount: int("redFlagCount").default(0),
  isArchived: boolean("isArchived").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;

// ─── Third Signal Analysis ─────────────────────────────────────────────────────
export const signals = mysqlTable("signals", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId").notNull(),
  ownerDistressScore: float("ownerDistressScore"),
  ownerRetirementSignal: boolean("ownerRetirementSignal"),
  ownerNegotiationStyle: varchar("ownerNegotiationStyle", { length: 64 }),
  ownerProfileSummary: text("ownerProfileSummary"),
  techDebtScore: float("techDebtScore"),
  digitalGrowthTrend: mysqlEnum("digitalGrowthTrend", ["growing", "stable", "declining"]),
  seoAuthorityScore: int("seoAuthorityScore"),
  reviewSentimentScore: float("reviewSentimentScore"),
  digitalAuditSummary: text("digitalAuditSummary"),
  killProbability: float("killProbability"),
  redFlags: json("redFlags"),
  redTeamSummary: text("redTeamSummary"),
  sbaEligible: boolean("sbaEligible"),
  recommendedSbaAmount: bigint("recommendedSbaAmount", { mode: "number" }),
  recommendedSellerNote: bigint("recommendedSellerNote", { mode: "number" }),
  recommendedEquity: bigint("recommendedEquity", { mode: "number" }),
  dscr: float("dscr"),
  cashOnCashReturn: float("cashOnCashReturn"),
  capitalStackSummary: text("capitalStackSummary"),
  analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
  modelVersions: json("modelVersions"),
});

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = typeof signals.$inferInsert;

// ─── Investment Memos ─────────────────────────────────────────────────────────
export const memos = mysqlTable("memos", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId").notNull(),
  title: varchar("title", { length: 256 }),
  content: text("content"),
  executiveSummary: text("executiveSummary"),
  investmentThesis: text("investmentThesis"),
  riskFactors: json("riskFactors"),
  aiOptimizationOpportunities: json("aiOptimizationOpportunities"),
  generatedBy: varchar("generatedBy", { length: 64 }),
  version: int("version").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Memo = typeof memos.$inferSelect;
export type InsertMemo = typeof memos.$inferInsert;

// ─── Outreach Contacts ────────────────────────────────────────────────────────
export const outreach = mysqlTable("outreach", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId").notNull(),
  contactName: varchar("contactName", { length: 256 }),
  contactRole: varchar("contactRole", { length: 128 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 32 }),
  channel: mysqlEnum("channel", ["email","phone","linkedin","sms"]).default("email").notNull(),
  status: mysqlEnum("status", [
    "pending",
    "sent",
    "opened",
    "replied",
    "meeting_scheduled",
    "no_response",
    "not_interested",
    "closed",
  ]).default("pending").notNull(),
  lastContactedAt: timestamp("lastContactedAt"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
  notes: text("notes"),
  subject: text("subject"),
  body: text("body"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Outreach = typeof outreach.$inferSelect;
export type InsertOutreach = typeof outreach.$inferInsert;

// ─── Activity Log ─────────────────────────────────────────────────────────────
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId"),
  type: mysqlEnum("type", [
    "scan_completed",
    "deal_added",
    "deal_scored",
    "signal_analyzed",
    "memo_generated",
    "outreach_sent",
    "stage_changed",
    "red_flag_detected",
    "system",
  ]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

// ─── Scan Jobs ────────────────────────────────────────────────────────────────
export const scanJobs = mysqlTable("scan_jobs", {
  id: int("id").autoincrement().primaryKey(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  sources: json("sources"),
  listingsFound: int("listingsFound").default(0),
  listingsQualified: int("listingsQualified").default(0),
  currentPhase: varchar("currentPhase", { length: 128 }),
  phaseDetail: varchar("phaseDetail", { length: 512 }),
  progressPct: int("progressPct").default(0),
  dealsScored: int("dealsScored").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScanJob = typeof scanJobs.$inferSelect;
export type InsertScanJob = typeof scanJobs.$inferInsert;
// ─── AI Model Config (per-module model selection) ─────────────────────────────
export const modelConfig = mysqlTable("model_config", {
  id: int("id").autoincrement().primaryKey(),
  module: varchar("module", { length: 64 }).notNull().unique(),
  modelId: varchar("modelId", { length: 128 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModelConfig = typeof modelConfig.$inferSelect;
export type InsertModelConfig = typeof modelConfig.$inferInsert;
