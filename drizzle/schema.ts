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
  role: mysqlEnum("role", ["user", "admin", "investor", "insurance"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
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
  // OZ / TAD enrichment fields
  opportunityZone: boolean("opportunity_zone").default(false),
  ozTractId: varchar("oz_tract_id", { length: 32 }),
  tadDistrict: varchar("tad_district", { length: 128 }),
  ozPotentialGain: bigint("oz_potential_gain", { mode: "number" }),
  eventProximityMiles: float("event_proximity_miles"),
  eventRevenueLow: bigint("event_revenue_low", { mode: "number" }),
  eventRevenueHigh: bigint("event_revenue_high", { mode: "number" }),
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

// ─── Freedom Goals (goal-first deal engineering) ──────────────────────────────
export const freedomGoals = mysqlTable("freedom_goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 64 }),
  name: varchar("name", { length: 128 }).notNull().default("My Freedom Plan"),
  targetMonthlyIncome: bigint("targetMonthlyIncome", { mode: "number" }).notNull(),
  currentIncome: bigint("currentIncome", { mode: "number" }),
  investmentCapital: bigint("investmentCapital", { mode: "number" }),
  timelineYears: int("timelineYears").notNull().default(3),
  riskTolerance: mysqlEnum("riskTolerance", ["conservative", "moderate", "aggressive"]).default("moderate").notNull(),
  location: varchar("location", { length: 256 }),
  situation: mysqlEnum("situation", ["single", "married", "family"]).default("single").notNull(),
  age: int("age"),
  aiRationale: text("aiRationale"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FreedomGoal = typeof freedomGoals.$inferSelect;
export type InsertFreedomGoal = typeof freedomGoals.$inferInsert;

// ─── Strategy Blueprints (custom deal mix recipes) ────────────────────────────
export const strategyBlueprints = mysqlTable("strategy_blueprints", {
  id: int("id").autoincrement().primaryKey(),
  goalId: int("goalId"),
  userId: varchar("userId", { length: 64 }),
  name: varchar("name", { length: 256 }).notNull(),
  recipe: json("recipe").notNull(), // Array of deal components
  capitalStack: json("capitalStack"), // Sources & uses breakdown
  projectedMonthlyIncome: bigint("projectedMonthlyIncome", { mode: "number" }),
  projectedTotalInvestment: bigint("projectedTotalInvestment", { mode: "number" }),
  dscr: float("dscr"),
  scenario: mysqlEnum("scenario", ["conservative", "base", "aggressive"]).default("base").notNull(),
  aiRationale: text("aiRationale"),
  isFavorite: boolean("isFavorite").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StrategyBlueprint = typeof strategyBlueprints.$inferSelect;
export type InsertStrategyBlueprint = typeof strategyBlueprints.$inferInsert;

// ─── Opportunity Radar (creative plays & market signals) ──────────────────────
export const opportunityRadar = mysqlTable("opportunity_radar", {
  id: int("id").autoincrement().primaryKey(),
  signalType: mysqlEnum("signalType", [
    "permit_filed",
    "tad_boundary",
    "zoning_change",
    "world_event",
    "land_play",
    "gas_station_hold",
    "parking_arbitrage",
    "lot_prep",
    "microloan",
    "other",
  ]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  location: varchar("location", { length: 256 }),
  description: text("description"),
  urgencyScore: float("urgencyScore"),
  estimatedROI: float("estimatedROI"),
  estimatedHoldYears: float("estimatedHoldYears"),
  capitalRequired: bigint("capitalRequired", { mode: "number" }),
  aiAnalysis: text("aiAnalysis"),
  sourceUrl: text("sourceUrl"),
  expiresAt: timestamp("expiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OpportunityRadar = typeof opportunityRadar.$inferSelect;
export type InsertOpportunityRadar = typeof opportunityRadar.$inferInsert;

// ─── Investor Dossiers (bespoke pitch decks) ──────────────────────────────────
export const investorDossiers = mysqlTable("investor_dossiers", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId"),
  blueprintId: int("blueprintId"),
  userId: varchar("userId", { length: 64 }),
  title: varchar("title", { length: 256 }).notNull(),
  investorPersona: mysqlEnum("investorPersona", ["passive", "active", "institutional", "family_office", "syndicate"]).default("passive").notNull(),
  thesis: text("thesis"),
  analystCommentary: text("analystCommentary"),
  skepticCommentary: text("skepticCommentary"),
  visionaryCommentary: text("visionaryCommentary"),
  financialProjections: json("financialProjections"),
  riskAssessment: json("riskAssessment"),
  capitalStack: json("capitalStack"),
  keyHighlights: json("keyHighlights"),
  recommendation: mysqlEnum("recommendation", ["STRONG_BUY", "BUY", "CONSIDER", "PASS"]).default("CONSIDER").notNull(),
  pdfUrl: text("pdfUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InvestorDossier = typeof investorDossiers.$inferSelect;
export type InsertInvestorDossier = typeof investorDossiers.$inferInsert;

// ─── Deal Trajectory (ADK agent step log — Hermes trajectory memory) ──────────
export const dealTrajectory = mysqlTable("deal_trajectory", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId").notNull(),
  agentName: varchar("agentName", { length: 128 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  inputSummary: text("inputSummary"),
  outputSummary: text("outputSummary"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DealTrajectory = typeof dealTrajectory.$inferSelect;
export type InsertDealTrajectory = typeof dealTrajectory.$inferInsert;

// ─── Consensus Scores (ADK ParallelAgent — MiroFish divergence scoring) ───────
export const consensusScores = mysqlTable("consensus_scores", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId").notNull(),
  model1Name: varchar("model1Name", { length: 128 }),
  model1Score: float("model1Score"),
  model1Rationale: text("model1Rationale"),
  model2Name: varchar("model2Name", { length: 128 }),
  model2Score: float("model2Score"),
  model2Rationale: text("model2Rationale"),
  model3Name: varchar("model3Name", { length: 128 }),
  model3Score: float("model3Score"),
  model3Rationale: text("model3Rationale"),
  consensusScore: float("consensusScore"),
  divergenceScore: float("divergenceScore"),
  divergenceFlag: boolean("divergenceFlag").default(false),
  summary: text("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ConsensusScore = typeof consensusScores.$inferSelect;
export type InsertConsensusScore = typeof consensusScores.$inferInsert;

// ─── Seller Simulations (MiroFish persona agent) ──────────────────────────────
export const sellerSimulations = mysqlTable("seller_simulations", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId").notNull(),
  personaJson: json("personaJson").$type<Record<string, unknown>>(),
  scenariosJson: json("scenariosJson").$type<Array<Record<string, unknown>>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SellerSimulation = typeof sellerSimulations.$inferSelect;
export type InsertSellerSimulation = typeof sellerSimulations.$inferInsert;

// ─── Commercial Assets (Sprint 5 Scout agent) ─────────────────────────────────
export const commercialAssets = mysqlTable("commercial_assets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  zip: varchar("zip", { length: 20 }),
  propertyType: mysqlEnum("property_type", ["office", "industrial", "retail", "mixed_use", "land", "warehouse", "flex"]).notNull().default("retail"),
  squareFootage: int("square_footage"),
  askingPrice: bigint("asking_price", { mode: "number" }),
  capRate: float("cap_rate"),
  noi: bigint("noi", { mode: "number" }),
  leaseType: mysqlEnum("lease_type", ["nnn", "gross", "modified_gross", "vacant"]),
  zoning: text("zoning"),
  opportunityZone: boolean("opportunity_zone").notNull().default(false),
  ozTractId: varchar("oz_tract_id", { length: 20 }),
  tadDistrict: varchar("tad_district", { length: 100 }),
  distanceToVenue: float("distance_to_venue"),
  eventRevenueLow: int("event_revenue_low"),
  eventRevenueHigh: int("event_revenue_high"),
  source: varchar("source", { length: 100 }).notNull().default("manual"),
  sourceUrl: text("source_url"),
  aiScore: float("ai_score"),
  aiAnalysis: text("ai_analysis"),
  status: mysqlEnum("status", ["new", "reviewing", "qualified", "rejected", "acquired"]).notNull().default("new"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export type CommercialAsset = typeof commercialAssets.$inferSelect;
export type InsertCommercialAsset = typeof commercialAssets.$inferInsert;

// ─── Macro Signals (Sprint 6 Sentinel agent) ──────────────────────────────────
export const macroSignals = mysqlTable("macro_signals", {
  id: int("id").autoincrement().primaryKey(),
  signalType: mysqlEnum("signal_type", ["institutional", "government", "seasonal", "event", "macro_momentum"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  roryPitch: text("rory_pitch"),
  impactedAssetClasses: json("impacted_asset_classes").$type<string[]>(),
  recommendedAction: text("recommended_action"),
  confidenceScore: float("confidence_score"),
  direction: mysqlEnum("direction", ["tailwind", "headwind", "neutral"]).default("tailwind").notNull(),
  sourceUrl: text("source_url"),
  expiresAt: bigint("expires_at", { mode: "number" }),
  archived: boolean("archived").default(false).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type MacroSignal = typeof macroSignals.$inferSelect;
export type InsertMacroSignal = typeof macroSignals.$inferInsert;

// ─── Deal Share Tokens (public investor one-pager links) ──────────────────────
export const dealShareTokens = mysqlTable("deal_share_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  dealId: int("deal_id").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }),
  viewCount: int("view_count").default(0).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type DealShareToken = typeof dealShareTokens.$inferSelect;
export type InsertDealShareToken = typeof dealShareTokens.$inferInsert;

// ─── Agent Artifact / Finding / Remediation types ────────────────────────────
export type AgentArtifact = {
  type: "cold_outreach_email" | "loi_draft" | "investment_thesis" | "due_diligence_checklist" | "seller_profile" | "negotiation_playbook" | "financing_model" | "risk_matrix";
  title: string;
  content: string;
  format: "markdown" | "html" | "json";
  generatedAt: number;
};

export type RedTeamFinding = {
  category: "financial" | "operational" | "legal" | "market" | "execution" | "personal_fit";
  severity: "critical" | "high" | "medium" | "low";
  finding: string;
  evidence: string;
  recommendation: string;
  confidenceScore: number;
};

export type RemediationAction = {
  findingCategory: string;
  action: string;
  artifact?: AgentArtifact;
  status: "pending" | "complete";
};

// ─── Agent Runs (Hermes-pattern: Plan→Execute→Reflect→Remediate) ──────────────
// Stores every agent invocation with full input context, tool calls, and output artifacts.
// Mirrors Hermes' trajectory.py — enables cross-run recall and skill improvement.
export const agentRuns = mysqlTable("agent_runs", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("deal_id").notNull(),
  agentType: mysqlEnum("agent_type", ["deal_architect", "red_team", "remediation"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "complete", "failed"]).notNull().default("pending"),
  // Input context snapshot (deal data, user goals, prior run outputs)
  inputContext: json("input_context").$type<Record<string, unknown>>(),
  // Structured output artifacts (array of artifact objects)
  artifacts: json("artifacts").$type<AgentArtifact[]>(),
  // Red team findings (gaps, risks, confidence scores)
  findings: json("findings").$type<RedTeamFinding[]>(),
  // Remediation actions taken
  remediations: json("remediations").$type<RemediationAction[]>(),
  // Raw LLM response for debugging / trajectory replay
  rawResponse: text("raw_response"),
  // Confidence score 0-1 (self-assessed by agent)
  confidenceScore: float("confidence_score"),
  // Token usage for cost tracking
  tokensUsed: int("tokens_used"),
  // Parent run ID for chained agents (architect → red_team → remediation)
  parentRunId: int("parent_run_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
});
export type AgentRun = typeof agentRuns.$inferSelect;
export type InsertAgentRun = typeof agentRuns.$inferInsert;

// ─── Investor DNA (Tripoli-pattern: onboarding quiz → archetype profile) ─────
// Stores each investor's risk/return/sector preferences as strand scores.
// Used to compute deal match scores and curate the Deal Room shelves.
export const investorDna = mysqlTable("investor_dna", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  // Strand scores 0-1 (answers from onboarding quiz)
  timeHorizon: float("time_horizon").notNull().default(0.5),      // 0=short, 1=long
  riskTolerance: float("risk_tolerance").notNull().default(0.5),  // 0=stable, 1=aggressive
  liquidityNeed: float("liquidity_need").notNull().default(0.5),  // 0=locked, 1=liquid
  esgConviction: float("esg_conviction").notNull().default(0.5),  // 0=returns, 1=mission
  // Sector affinity as JSON array of selected sectors
  sectorAffinity: json("sector_affinity").$type<string[]>().default([]),
  // Computed archetype code (e.g. "ALPHA-7", "ANCHOR-3")
  archetypeCode: varchar("archetype_code", { length: 32 }),
  archetypeLabel: varchar("archetype_label", { length: 128 }),
  // Whether onboarding quiz is complete
  quizCompleted: boolean("quiz_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InvestorDna = typeof investorDna.$inferSelect;
export type InsertInvestorDna = typeof investorDna.$inferInsert;

// ─── Investor Interest (deal interest expression → operator approval flow) ────
// Investor flags a deal as "interested" → operator runs AI scoring → operator shares memo.
// This keeps the operator in control of token spend.
export const investorInterest = mysqlTable("investor_interest", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  dealId: int("deal_id").notNull(),
  // Investor's intended allocation amount
  allocationAmount: bigint("allocation_amount", { mode: "number" }),
  // Status: expressed → operator_reviewing → memo_shared → committed → passed
  status: mysqlEnum("status", [
    "expressed",
    "operator_reviewing",
    "memo_shared",
    "committed",
    "passed",
  ]).default("expressed").notNull(),
  // Investor notes / questions for the operator
  investorNote: text("investor_note"),
  // Operator response / memo share note
  operatorNote: text("operator_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InvestorInterest = typeof investorInterest.$inferSelect;
export type InsertInvestorInterest = typeof investorInterest.$inferInsert;

// ─── Thesis Compilations (STRATEGIST agent — Spec TSL-SCI-PROD-001-A1) ────────
// Stores each thesis compile: raw text → decomposed filters + weights + evidence.
// Saved theses become reusable assets; approved theses can trigger a scan pipeline.
export const thesisCompilations = mysqlTable("thesis_compilations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  // Raw thesis text entered by the user
  thesisText: text("thesis_text").notNull(),
  // Template used (if any)
  templateUsed: varchar("template_used", { length: 64 }),
  // Strategist-compiled structured output (JSON)
  compiledFilters: json("compiled_filters").$type<{
    revenueMin?: number; revenueMax?: number;
    geographies?: string[];
    businessAgeMin?: number;
    headcountMin?: number; headcountMax?: number;
    exclusions?: string[];
  }>().default({}),
  scoringWeights: json("scoring_weights").$type<Array<{
    dimension: string; weight: number; isCustom: boolean;
  }>>().default([]),
  evidenceRequirements: json("evidence_requirements").$type<string[]>().default([]),
  autoDisqualifiers: json("auto_disqualifiers").$type<string[]>().default([]),
  confidenceNotes: json("confidence_notes").$type<string[]>().default([]),
  // Strategist's universe estimate
  estimatedTargetsMin: int("estimated_targets_min"),
  estimatedTargetsMax: int("estimated_targets_max"),
  estimatedCostMin: int("estimated_cost_min"),
  estimatedCostMax: int("estimated_cost_max"),
  // Status: compiling | review | approved | running | completed | archived
  status: mysqlEnum("status", [
    "compiling", "review", "approved", "running", "completed", "archived",
  ]).default("compiling").notNull(),
  // Linked scan job if the thesis was approved and run
  scanJobId: int("scan_job_id"),
  // User-editable name for saved thesis
  name: varchar("name", { length: 256 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ThesisCompilation = typeof thesisCompilations.$inferSelect;
export type InsertThesisCompilation = typeof thesisCompilations.$inferInsert;

// ─── Insurance Prospects (NY Life / commercial insurance prospecting) ─────────
// Each deal in the pipeline can be scored as a commercial insurance prospect.
// Surfaces premium potential, policy fit, and a pre-call brief for insurance agents.
export const insuranceProspects = mysqlTable("insurance_prospects", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("deal_id").notNull().unique(),
  // Composite prospect score 0–1 (weighted: premium potential + policy complexity + risk profile)
  prospectScore: float("prospect_score"),
  // Estimated annual premium range in cents
  estimatedPremiumLow: bigint("estimated_premium_low", { mode: "number" }),
  estimatedPremiumHigh: bigint("estimated_premium_high", { mode: "number" }),
  // Risk profile: low | moderate | elevated | high
  riskProfile: mysqlEnum("risk_profile", ["low", "moderate", "elevated", "high"]).default("moderate").notNull(),
  // Policy fit map — which policies are relevant and why
  policyFit: json("policy_fit").$type<Array<{
    policy: string;          // e.g. "Key Man Life", "Business Interruption", "Commercial Property"
    relevance: "high" | "medium" | "low";
    estimatedPremium?: number; // annual, in cents
    rationale: string;
  }>>().default([]),
  // AI-generated pre-call brief (the conversation starter)
  briefText: text("brief_text"),
  // Prospect status in the insurance pipeline
  status: mysqlEnum("status", ["new", "briefed", "contacted", "quoted", "closed", "passed"]).default("new").notNull(),
  // Which user generated this prospect record
  generatedByUserId: int("generated_by_user_id"),
  scoredAt: timestamp("scored_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InsuranceProspect = typeof insuranceProspects.$inferSelect;
export type InsertInsuranceProspect = typeof insuranceProspects.$inferInsert;

// ─── Invite Tokens (one-click role-assignment invites) ────────────────────────
// Admin generates a signed token; recipient clicks the link, authenticates via
// Manus OAuth, and the callback auto-assigns the specified role on first use.
export const inviteTokens = mysqlTable("invite_tokens", {
  id: int("id").autoincrement().primaryKey(),
  // Cryptographically random token (32-byte hex)
  token: varchar("token", { length: 64 }).notNull().unique(),
  // Role to assign when the invite is consumed
  assignRole: mysqlEnum("assign_role", ["user", "admin", "investor", "insurance"]).notNull(),
  // Optional label for the admin to identify the invite (e.g. "NY Life — John Smith")
  label: varchar("label", { length: 256 }),
  // Optional email to pre-fill / restrict to a specific recipient
  recipientEmail: varchar("recipient_email", { length: 256 }),
  // Who created this invite
  createdByUserId: int("created_by_user_id").notNull(),
  // When the invite expires (NULL = never, default 30 days)
  expiresAt: timestamp("expires_at"),
  // When the invite was consumed (NULL = not yet used)
  consumedAt: timestamp("consumed_at"),
  // Which user consumed the invite
  consumedByUserId: int("consumed_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type InviteToken = typeof inviteTokens.$inferSelect;
export type InsertInviteToken = typeof inviteTokens.$inferInsert;

// ─── Deal Agent Runs (Multi-Model Orchestration) ──────────────────────────────
// Stores the output of each AI analysis run on a deal.
// Each run can contain multiple model outputs (Claude, Gemini, Perplexity/Sonar).
// The "consensus" field is the synthesized verdict across all models.
export const dealAgentRuns = mysqlTable("deal_agent_runs", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("deal_id").notNull(),
  // Analysis type: which lens was applied
  analysisType: mysqlEnum("analysis_type", [
    "consensus",
    "behavioral",
    "redteam",
    "capital_stack",
    "digital_alpha",
  ]).notNull(),
  // Status of the run
  status: mysqlEnum("status", ["pending", "running", "complete", "failed"]).default("pending").notNull(),
  // Per-model outputs (raw JSON from each model)
  claudeOutput: json("claude_output").$type<{
    verdict?: string;
    confidence?: number;
    rationale?: string;
    keyRisks?: string[];
    keyStrengths?: string[];
    rawText?: string;
  }>(),
  geminiOutput: json("gemini_output").$type<{
    verdict?: string;
    confidence?: number;
    rationale?: string;
    keyRisks?: string[];
    keyStrengths?: string[];
    rawText?: string;
  }>(),
  sonarOutput: json("sonar_output").$type<{
    verdict?: string;
    confidence?: number;
    rationale?: string;
    keyRisks?: string[];
    keyStrengths?: string[];
    rawText?: string;
    sources?: string[];
  }>(),
  // Synthesized consensus across all models
  consensus: json("consensus").$type<{
    verdict: string;
    confidence: number;
    divergence: boolean;
    summary: string;
    actionItem: string;
  }>(),
  // Behavioral profile (used for analysisType = "behavioral")
  behavioralProfile: json("behavioral_profile").$type<{
    ownerArchetype?: string;
    motivationPrimary?: string;
    negotiationStyle?: string;
    frictionPoints?: string[];
    openingMove?: string;
    anchorStrategy?: string;
    rehearsalScenarios?: Array<{
      scenario: string;
      ownerResponse: string;
      counterMove: string;
    }>;
  }>(),
  // Red team analysis
  redTeamAnalysis: json("red_team_analysis").$type<{
    dealBreakers?: string[];
    hiddenRisks?: string[];
    optimisticAssumptions?: string[];
    worstCaseScenario?: string;
    mitigations?: string[];
  }>(),
  // Digital alpha analysis
  digitalAlpha: json("digital_alpha").$type<{
    currentTechStack?: string;
    automationOpportunities?: string[];
    aiLeveragePoints?: string[];
    estimatedEfficiencyGain?: string;
    quickWins?: string[];
  }>(),
  totalTokens: int("total_tokens"),
  triggeredByUserId: int("triggered_by_user_id"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DealAgentRun = typeof dealAgentRuns.$inferSelect;
export type InsertDealAgentRun = typeof dealAgentRuns.$inferInsert;
