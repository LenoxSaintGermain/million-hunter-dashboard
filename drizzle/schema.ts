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
  uniqueIndex,
  index,
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
  /** The first authenticated workspace for this user; controls the root-route handoff only. */
  defaultWorkspace: mysqlEnum("default_workspace", ["command_center", "capital_aperture", "capital_aperture_trader"]).default("command_center").notNull(),
  /** Compact Cockpit Rail preference. A critical measured constraint always overrides this to open the rail. */
  cockpitRailExpanded: boolean("cockpit_rail_expanded").default(false).notNull(),
  /** Exact measured constraint snapshot the operator has already reviewed; a changed value reopens the rail. */
  cockpitRailAcknowledgedSignature: varchar("cockpit_rail_acknowledged_signature", { length: 255 }),
  /** Canonical Capital / Trade thesis selected by this profile for its daily Decision Center context. */
  activeCapitalThesisId: int("active_capital_thesis_id"),
  /** Immutable Heartbeat identity for this owner's paper-only daily outcome refresh. */
  dailyOutcomeRefreshTaskUid: varchar("daily_outcome_refresh_task_uid", { length: 65 }),
  dailyOutcomeRefreshEnabled: boolean("daily_outcome_refresh_enabled").default(false).notNull(),
  dailyOutcomeRefreshLastRunAt: bigint("daily_outcome_refresh_last_run_at", { mode: "number" }),
  dailyOutcomeRefreshLastResult: text("daily_outcome_refresh_last_result"),
  huntingParams: text("hunting_params"), // Free-text agentic command / hunting parameters
  /**
   * Duplicate-account pointer. When one person has signed up twice under two
   * OAuth identities, the non-canonical row keeps existing (deleting it is not
   * reversible, and investor_dna.user_id is UNIQUE so a naive merge throws) and
   * points here instead. createContext resolves it, so either login lands in the
   * same account. NULL for every ordinary user.
   */
  mergedIntoUserId: int("merged_into_user_id"),
}, (table) => ({
  dailyOutcomeRefreshTaskUidIdx: uniqueIndex("users_daily_outcome_refresh_task_uid_uq").on(table.dailyOutcomeRefreshTaskUid),
}));

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
  // Flags LLM-generated Market Scan rows so synthetic data is distinguishable/purgeable.
  isSynthetic: boolean("is_synthetic").notNull().default(false),
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
  // ─── Historic Building Thesis fields (Wingate preset) ─────────────────────
  yearBuilt: int("year_built"),
  stories: int("stories"),
  isHistoric: boolean("is_historic").notNull().default(false),
  historicRegisterEligible: boolean("historic_register_eligible").notNull().default(false),
  isStabilized: boolean("is_stabilized").notNull().default(false),
  occupancyRate: float("occupancy_rate"),
  hasAirRights: boolean("has_air_rights").notNull().default(false),
  lotSqFt: int("lot_sq_ft"),
  higherAndBetterUseNotes: text("higher_and_better_use_notes"),
  source: varchar("source", { length: 100 }).notNull().default("manual"),
  sourceUrl: text("source_url"),
  aiScore: float("ai_score"),
  aiAnalysis: text("ai_analysis"),
  // ─── Adaptive Asset-Class framework (shared/assetClasses.ts) ──────────────
  assetClass: varchar("asset_class", { length: 64 }).default("historic"),
  classMetadata: json("class_metadata"), // class-specific fields for non-native classes
  // ─── Scoring (A–G for historic; generic engine maps dims onto A..G) ────────
  thesisCompilationId: int("thesis_compilation_id"),
  dimA: int("dim_a"),
  dimB: int("dim_b"),
  dimC: int("dim_c"),
  dimD: int("dim_d"),
  dimE: int("dim_e"),
  dimF: int("dim_f"),
  dimG: int("dim_g"),
  compositeScore: int("composite_score"),
  penalties: int("penalties"),
  bonuses: int("bonuses"),
  confidenceScore: float("confidence_score"),
  rankScore: float("rank_score"),
  assetTier: varchar("asset_tier", { length: 16 }),      // tier1 | tier2 | tier3 | archive | fasttrack
  marketTier: varchar("market_tier", { length: 4 }),     // A | B | C
  dispositionCode: varchar("disposition_code", { length: 8 }), // R1..R10
  verifyFields: json("verify_fields"),                   // unverified mandatory-critical fields
  historicInputs: json("historic_inputs"),               // qualitative spec inputs not in columns
  scorecard: json("scorecard"),                          // full computed A–G breakdown
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: bigint("archived_at", { mode: "number" }),
  // ─── Provenance & freshness (premium trust layer) ─────────────────────────
  // Listings go stale fast (auctions close, listings withdraw). Every asset
  // carries when it was last checked, what the check found, and its sources.
  lastVerifiedAt: bigint("last_verified_at", { mode: "number" }),
  listingStatus: varchar("listing_status", { length: 24 }), // active | stale | withdrawn | unknown
  verificationNote: text("verification_note"),
  verificationSources: json("verification_sources"),
  /** Not for sale — found in public records (tax roll, vacant registry, land bank). */
  isOffMarket: boolean("is_off_market").default(false).notNull(),
  offMarketSignals: json("off_market_signals"),
  /** 0-100: how likely the OWNER is to sell. Separate from the thesis score. */
  motivationScore: int("motivation_score"),
  /** Operator can hand a specific asset to a specific client. */
  assignedUserId: int("assigned_user_id"),
  assignmentNote: text("assignment_note"),
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
/**
 * Scheduled sourcing. `enabled` defaults to FALSE — an unattended job that
 * spends tokens should never start itself.
 */
export const sourcingSchedules = mysqlTable("sourcing_schedules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  assetClass: varchar("asset_class", { length: 64 }).default("historic").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  cadence: varchar("cadence", { length: 16 }).default("daily").notNull(),
  hourUtc: int("hour_utc").default(9).notNull(),
  nationwide: boolean("nationwide").default(false).notNull(),
  marketsPerRun: int("markets_per_run").default(5).notNull(),
  limitPerRun: int("limit_per_run").default(10).notNull(),
  lastRunAt: bigint("last_run_at", { mode: "number" }),
  lastRunCreated: int("last_run_created"),
  lastRunMessage: text("last_run_message"),
  nextRunAt: bigint("next_run_at", { mode: "number" }),
  createdByUserId: int("created_by_user_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

/** Every run, scheduled or manual — so an unattended job leaves a trail. */
export const sourcingRuns = mysqlTable("sourcing_runs", {
  id: int("id").autoincrement().primaryKey(),
  scheduleId: int("schedule_id"),
  assetClass: varchar("asset_class", { length: 64 }).notNull(),
  trigger: varchar("trigger", { length: 16 }).default("schedule").notNull(),
  createdCount: int("created_count").default(0).notNull(),
  researchedCount: int("researched_count").default(0).notNull(),
  markets: json("markets"),
  message: text("message"),
  error: text("error"),
  ranAt: bigint("ran_at", { mode: "number" }).notNull(),
  durationMs: int("duration_ms"),
});

/**
 * A variant thesis — the same scoring model with different dials, owned by an
 * operator and optionally assigned to a client. Lets a building that fails the
 * primary thesis still surface as a fit for someone else.
 */
export const thesisVariants = mysqlTable("thesis_variants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  assetClass: varchar("asset_class", { length: 64 }).default("historic").notNull(),
  /** ThesisOverrides — gates, vintage window, storey cap, tier cutoffs. */
  overrides: json("overrides"),
  /** Who this thesis is FOR, in human terms ("Cincinnati restoration client"). */
  clientLabel: varchar("client_label", { length: 160 }),
  ownerUserId: int("owner_user_id"),
  assignedUserId: int("assigned_user_id"),
  isPrimary: boolean("is_primary").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

/** Link-sharing for a property dossier — mirrors dealShareTokens. */
export const assetShareTokens = mysqlTable("asset_share_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  assetId: int("asset_id").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  viewCount: int("view_count").default(0).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

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
  // Which bespoke thesis this investor acquires (shared/assetClasses.ts id).
  // Drives their landing surface, pipeline, and scoring model.
  assetClass: varchar("asset_class", { length: 64 }).default("historic"),
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
  // Exactly one of dealId / assetId is set. Property classes never enter the
  // business `deals` table, so their interest points at commercial_assets.
  dealId: int("deal_id"),
  assetId: int("asset_id"),
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

/** Operator-managed access to a canonical thesis without transferring ownership. */
export const thesisShares = mysqlTable("thesis_shares", {
  id: int("id").autoincrement().primaryKey(),
  compilationId: int("compilation_id").notNull(),
  userId: int("user_id").notNull(),
  sharedByUserId: int("shared_by_user_id").notNull(),
  permission: mysqlEnum("permission", ["view", "use"]).default("use").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => ({
  thesisUserUnique: uniqueIndex("thesis_shares_compilation_user_unique").on(table.compilationId, table.userId),
}));
export type ThesisShare = typeof thesisShares.$inferSelect;

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

// ─── Demo Scenario (living public thesis deal) ────────────────────────────────
// A single curated deal that powers the /demo public experience.
// Operators can trigger a refresh scan to update the snapshot with real data.
export const demoScenarios = mysqlTable("demo_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  thesisTitle: varchar("thesis_title", { length: 256 }).notNull(),
  thesisSummary: text("thesis_summary"),
  dealId: int("deal_id"), // FK to deals table (optional — can be standalone)
  // Core deal data (denormalized for fast public reads)
  businessName: varchar("business_name", { length: 256 }).notNull(),
  industry: varchar("industry", { length: 128 }),
  location: varchar("location", { length: 256 }),
  revenue: bigint("revenue", { mode: "number" }),
  cashFlow: bigint("cash_flow", { mode: "number" }),
  askingPrice: bigint("asking_price", { mode: "number" }),
  multiple: float("multiple"),
  employees: int("employees"),
  yearEstablished: int("year_established"),
  // AI outputs
  score: float("score"),
  scoreBreakdown: json("score_breakdown").$type<{
    financialHealth: number;
    marketPosition: number;
    operationalRisk: number;
    growthPotential: number;
    sbaEligibility: number;
    ownerDependency: number;
  }>(),
  signals: json("signals").$type<Array<{
    type: "tailwind" | "headwind" | "neutral";
    title: string;
    summary: string;
    source: string;
    relevanceScore: number;
  }>>(),
  icSummary: text("ic_summary"),
  investmentThesis: text("investment_thesis"),
  keyRisks: json("key_risks").$type<string[]>(),
  catalysts: json("catalysts").$type<string[]>(),
  // Snapshot metadata
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
  dataSourcesUsed: json("data_sources_used").$type<string[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type DemoScenario = typeof demoScenarios.$inferSelect;
export type InsertDemoScenario = typeof demoScenarios.$inferInsert;

// ─── Access Requests ──────────────────────────────────────────────────────────
// Captures inbound operator access requests from the public landing page.
export const accessRequests = mysqlTable("access_requests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  dealThesis: text("deal_thesis"),
  capitalAccess: varchar("capital_access", { length: 100 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

// ─── RippleEffect: Scan Cache ─────────────────────────────────────────────────
// Caches Sonar search results per location for 24h to avoid redundant API calls.
export const rippleScanCache = mysqlTable("ripple_scan_cache", {
  id: int("id").autoincrement().primaryKey(),
  location: varchar("location", { length: 255 }).notNull(),
  queryHash: varchar("query_hash", { length: 64 }).notNull(), // MD5 of location+anchorTypes
  resultsJson: json("results_json").$type<any[]>().notNull(),
  signalCount: int("signal_count").default(0).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(), // createdAt + 24h
});
export type RippleScanCache = typeof rippleScanCache.$inferSelect;
export type InsertRippleScanCache = typeof rippleScanCache.$inferInsert;

// ─── RippleEffect: Favorites ──────────────────────────────────────────────────
// User-saved RippleEffect signals for cross-tool pipeline enrichment.
export const rippleFavorites = mysqlTable("ripple_favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  anchorType: varchar("anchor_type", { length: 64 }),
  projectName: varchar("project_name", { length: 255 }),
  signalSnapshot: json("signal_snapshot").$type<any>().notNull(), // full signal object
  playsJson: json("plays_json").$type<any[]>(), // gap analysis plays
  gapAnalysisJson: json("gap_analysis_json").$type<any>(), // full gap analysis
  pipelineStatus: mysqlEnum("pipeline_status", ["none", "queued", "running", "done", "error"]).default("none").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type RippleFavorite = typeof rippleFavorites.$inferSelect;
export type InsertRippleFavorite = typeof rippleFavorites.$inferInsert;

// ─── RippleEffect: Pipeline Jobs ──────────────────────────────────────────────
// Async cross-tool enrichment jobs triggered when a signal is favorited.
export const ripplePipelineJobs = mysqlTable("ripple_pipeline_jobs", {
  id: int("id").autoincrement().primaryKey(),
  favoriteId: int("favorite_id").notNull(),
  userId: int("user_id").notNull(),
  status: mysqlEnum("status", ["queued", "running", "done", "error"]).default("queued").notNull(),
  currentStep: varchar("current_step", { length: 64 }), // "market_scan" | "tide" | "ic"
  marketScanResults: json("market_scan_results").$type<any[]>(),
  tideSignals: json("tide_signals").$type<any[]>(),
  icVerdict: json("ic_verdict").$type<any>(),
  errorMessage: text("error_message"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
});
export type RipplePipelineJob = typeof ripplePipelineJobs.$inferSelect;
export type InsertRipplePipelineJob = typeof ripplePipelineJobs.$inferInsert;

// ─── Role Module Permissions ──────────────────────────────────────────────────
// Controls which modules each role can access. Operator can toggle these from
// the Admin Panel. Changes take effect immediately on next nav render.
export const roleModulePermissions = mysqlTable("role_module_permissions", {
  id: int("id").autoincrement().primaryKey(),
  role: mysqlEnum("role", ["admin", "investor", "insurance", "user"]).notNull(),
  moduleKey: varchar("module_key", { length: 64 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type RoleModulePermission = typeof roleModulePermissions.$inferSelect;
export type InsertRoleModulePermission = typeof roleModulePermissions.$inferInsert;

// ─── Deep Research Cache ──────────────────────────────────────────────────────
// Stores cached results from Perplexity Sonar research calls.
// subjectType: "deal" | "radar_signal" | "industry" | "market"
// model: "sonar" | "sonar-pro" | "sonar-deep-research"
// TTL enforced by expiresAt — service checks this before making new API calls.
export const researchResults = mysqlTable("research_results", {
  id: int("id").autoincrement().primaryKey(),
  subjectKey: varchar("subject_key", { length: 256 }).notNull(), // e.g. "deal:42" or "radar:charlotte-nc-commercial"
  subjectType: mysqlEnum("subject_type", ["deal", "radar_signal", "industry", "market"]).notNull(),
  model: varchar("model", { length: 64 }).notNull(),
  query: text("query").notNull(),
  content: text("content").notNull(), // full markdown report from model
  citations: json("citations").$type<string[]>().notNull(), // array of source URLs
  searchResults: json("search_results").$type<Array<{ title: string; url: string; snippet: string; date?: string }>>(), // rich search result objects
  numSearchQueries: int("num_search_queries"),
  costUsd: float("cost_usd"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(), // unix ms — service respects TTL
});
export type ResearchResult = typeof researchResults.$inferSelect;
export type InsertResearchResult = typeof researchResults.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// CAPITAL APERTURE — the second engine (liquid securities)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Everything above this line describes ONE illiquid thing at a time: a building,
// a business. There is no quantity, no price series, no portfolio. Capital
// Aperture answers a different question — "given a thesis, a portfolio, and
// $X of deployable capital, what is the best way to deploy the next dollar?" —
// so it gets its own tables rather than distorting `commercial_assets`.
//
// MONEY IS STORED IN CENTS. Every monetary column is named `...Cents` so a unit
// mix-up has to be written out in full before it can happen. Share quantities
// are floats because fractional shares are real.
//
// ⚠️ Admin-only surface. See ADMIN_ONLY_MODULES in server/rolePermissionsRouter.ts.

/** The Thesis Graph — an investment constitution, not a risk-tolerance bucket. */
export const capitalTheses = mysqlTable("capital_theses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 160 }),
  rawText: text("raw_text").notNull(),
  /** Canonical Signal Hunter thesis compilation this liquid-securities view projects. */
  sourceCompilationId: int("source_compilation_id"),
  /** Compiled constitution: beliefs, what to seek/avoid, portfolio rules, behaviour. */
  graph: json("graph").$type<{
    beliefs?: string[];
    seek?: string[];
    avoid?: string[];
    horizons?: string[];
    sectors?: string[];
    exclusions?: string[];
    portfolioRules?: {
      maxSingleNamePct?: number;
      maxCorrelatedClusterPct?: number;
      minAvgDailyVolumeUsd?: number;
      reservePct?: number;
    };
    behavior?: { researches?: number; shortlists?: number; executes?: number };
  }>(),
  /** The compiler flagging its own ambiguous readings — never silently resolved. */
  confidenceNotes: json("confidence_notes").$type<string[]>().default([]),
  status: mysqlEnum("status", ["compiling", "review", "active", "archived"]).default("compiling").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => ({
  sourcePerUserUnique: uniqueIndex("capital_theses_user_source_compilation_unique").on(table.userId, table.sourceCompilationId),
}));
export type CapitalThesis = typeof capitalTheses.$inferSelect;
export type InsertCapitalThesis = typeof capitalTheses.$inferInsert;

/** Broker-agnostic account. Jim does not have "a Robinhood portfolio". */
export const portfolioAccounts = mysqlTable("portfolio_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  /** manual | alpaca_paper | robinhood_mcp — see server/aperture/brokers/. */
  brokerId: varchar("broker_id", { length: 32 }).default("manual").notNull(),
  externalAccountId: varchar("external_account_id", { length: 128 }),
  /** No live-money account is supported by this build. Guarded in the adapters. */
  isPaper: boolean("is_paper").default(true).notNull(),
  cashCents: bigint("cash_cents", { mode: "number" }),
  buyingPowerCents: bigint("buying_power_cents", { mode: "number" }),
  equityValueCents: bigint("equity_value_cents", { mode: "number" }),
  lastSyncedAt: bigint("last_synced_at", { mode: "number" }),
  syncSource: varchar("sync_source", { length: 64 }),
  syncError: text("sync_error"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type PortfolioAccount = typeof portfolioAccounts.$inferSelect;
export type InsertPortfolioAccount = typeof portfolioAccounts.$inferInsert;

export const positions = mysqlTable("positions", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  assetType: mysqlEnum("asset_type", ["equity", "etf", "option", "crypto", "cash"]).default("equity").notNull(),
  qty: float("qty").notNull(),
  avgCostCents: bigint("avg_cost_cents", { mode: "number" }),
  lastPriceCents: bigint("last_price_cents", { mode: "number" }),
  marketValueCents: bigint("market_value_cents", { mode: "number" }),
  /** A price with no timestamp and no source is not a fact. Both are recorded. */
  priceAsOf: bigint("price_as_of", { mode: "number" }),
  priceSource: varchar("price_source", { length: 64 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;

/** Thin identity record. Anything with a value lives in `security_facts`. */
export const securities = mysqlTable("securities", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 24 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  exchange: varchar("exchange", { length: 32 }),
  sector: varchar("sector", { length: 96 }),
  industry: varchar("industry", { length: 128 }),
  cik: varchar("cik", { length: 16 }),
  assetType: mysqlEnum("asset_type", ["equity", "etf", "option", "crypto"]).default("equity").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type Security = typeof securities.$inferSelect;
export type InsertSecurity = typeof securities.$inferInsert;

/**
 * THE HONESTY CONTRACT, MADE STRUCTURAL.
 *
 * No number may appear in a memo, a score, or a strategy unless a row exists
 * here to back it. The memo generator is handed only these rows, and a validator
 * rejects any figure in generated prose that does not trace back to one. This is
 * the same failure shape already killed three times in the property engine
 * (offMarket.hunt, Market Scan, convertToDeal) — a model asked for plausible
 * numbers will produce them, so the schema refuses to store an unsourced one.
 */
export const securityFacts = mysqlTable("security_facts", {
  id: int("id").autoincrement().primaryKey(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  /** e.g. "revenue_ttm", "pe_ratio", "adv_usd_30d", "last_price". */
  factKey: varchar("fact_key", { length: 80 }).notNull(),
  valueNum: float("value_num"),
  valueText: text("value_text"),
  unit: varchar("unit", { length: 24 }),
  /** verified = stated by the source · modeled = derived from an assumption ·
   *  unknown = the input is missing and NO number was invented. */
  basis: mysqlEnum("basis", ["verified", "modeled", "unknown"]).notNull(),
  /** Required when basis = "modeled": the assumption, rendered inline in the UI. */
  assumption: text("assumption"),
  providerId: varchar("provider_id", { length: 32 }).notNull(),
  sourceName: varchar("source_name", { length: 160 }),
  sourceUrl: text("source_url"),
  /** When the SOURCE says this was true — not when we fetched it. */
  asOf: bigint("as_of", { mode: "number" }),
  fetchedAt: bigint("fetched_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }),
});
export type SecurityFact = typeof securityFacts.$inferSelect;
export type InsertSecurityFact = typeof securityFacts.$inferInsert;

/** One capital-deployment analysis. */
export const apertureRuns = mysqlTable("aperture_runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  thesisId: int("thesis_id").notNull(),
  accountId: int("account_id"),
  deployableCapitalCents: bigint("deployable_capital_cents", { mode: "number" }).notNull(),
  /** What the human was already planning to do — the baseline to re-underwrite. */
  intendedTrades: json("intended_trades").$type<Array<{ symbol: string; dollarsCents: number; note?: string }>>().default([]),
  /** Below this, capital stays in cash rather than chasing a marginal idea. */
  hurdleRateBps: int("hurdle_rate_bps"),
  // ── Short-Horizon Paper Run preset — these fields ARE the mandate ──────────
  // Null on runs created before the preset existed: pre-mandate, not gated.
  // See server/aperture/mandate.ts.
  holdingPeriod: mysqlEnum("holding_period", ["intraday", "overnight", "swing", "catalyst_window"]),
  /** When the thesis for this run expires. A short-horizon run without one is a hold. */
  catalystDeadlineAt: bigint("catalyst_deadline_at", { mode: "number" }),
  /** 30-day ADV floor in USD. May tighten the mandate floor, never loosen it. */
  liquidityFloorAdvUsd: bigint("liquidity_floor_adv_usd", { mode: "number" }),
  /** Single-name cap, 0..100. May tighten the mandate cap, never loosen it. */
  maxSingleNamePct: float("max_single_name_pct"),
  /** What would make this run's premise wrong. Free text, boilerplate rejected. */
  invalidationRule: text("invalidation_rule"),
  /** Which mandate version the preset was checked against. */
  mandateVersion: varchar("mandate_version", { length: 16 }),
  status: mysqlEnum("status", [
    "queued", "compiling", "discovering", "researching", "scoring", "constructing", "completed", "failed",
  ]).default("queued").notNull(),
  universeCount: int("universe_count"),
  candidateCount: int("candidate_count"),
  /** What the universe cap threw away. A silent top-N reads as "covered everything". */
  droppedNote: text("dropped_note"),
  /** Which data providers were actually live for this run — missing ones are
   *  rendered as named gaps, never as a silent null. */
  providerAvailability: json("provider_availability").$type<Record<string, boolean>>(),
  error: text("error"),
  startedAt: bigint("started_at", { mode: "number" }),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type ApertureRun = typeof apertureRuns.$inferSelect;
export type InsertApertureRun = typeof apertureRuns.$inferInsert;

export const apertureCandidates = mysqlTable("aperture_candidates", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  /** Null means legacy research supplied no directional model; the recipe states its long assumption. */
  playSide: mysqlEnum("play_side", ["long", "short"]),
  /** core = expresses the thesis directly · complementary = strengthens/diversifies
   *  it · remainder = optimised for capital that would sit idle ·
   *  alternative_expression = a different way to hold the same idea. */
  role: mysqlEnum("role", ["core", "complementary", "remainder", "alternative_expression"]).notNull(),
  compositeScore: int("composite_score"),
  confidenceScore: float("confidence_score"),
  rankScore: float("rank_score"),
  dimensions: json("dimensions"),
  /** Facts a Tier-1 call would need but which no source stated. */
  verifyFields: json("verify_fields").$type<string[]>().default([]),
  exposureNodeIds: json("exposure_node_ids").$type<number[]>().default([]),
  memo: json("memo"),
  /** rejected = the fact-validator found a figure with no supporting fact row. */
  memoStatus: mysqlEnum("memo_status", ["pending", "ok", "rejected", "skipped"]).default("pending").notNull(),
  memoRejectReason: text("memo_reject_reason"),
  citations: json("citations").$type<string[]>().default([]),
  /** A range, never an unexplained point estimate. */
  suggestedSizeLowCents: bigint("suggested_size_low_cents", { mode: "number" }),
  suggestedSizeHighCents: bigint("suggested_size_high_cents", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type ApertureCandidate = typeof apertureCandidates.$inferSelect;
export type InsertApertureCandidate = typeof apertureCandidates.$inferInsert;

/**
 * A human acknowledgement of one decision-critical evidence item. This does
 * not recommend, approve, or submit a trade; it makes the operator's review
 * visible before a paper proposal may be prepared.
 */
export const apertureEvidenceReviews = mysqlTable("aperture_evidence_reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  runId: int("run_id").notNull(),
  candidateId: int("candidate_id").notNull(),
  checkLabel: varchar("check_label", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["reviewed", "needs_follow_up"]).default("reviewed").notNull(),
  note: text("note"),
  reviewedAt: bigint("reviewed_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => ({
  reviewScope: uniqueIndex("aperture_evidence_review_scope").on(table.userId, table.runId, table.candidateId, table.checkLabel),
}));
export type ApertureEvidenceReview = typeof apertureEvidenceReviews.$inferSelect;

/**
 * A trader's explicit decision not to use a surfaced research play.
 *
 * This is distinct from a broker-order rejection: no proposal need exist to
 * conclude that cash, delay, or another play is the correct action. Retaining
 * the reason makes the weekly scorecard measure selectivity as well as fills.
 */
export const aperturePlayDecisions = mysqlTable("aperture_play_decisions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  runId: int("run_id").notNull(),
  candidateId: int("candidate_id").notNull(),
  decision: mysqlEnum("decision", ["skipped", "deferred"]).notNull(),
  reason: text("reason").notNull(),
  /** A defer is temporarily hidden only until the next regular session begins. */
  resumeAt: bigint("resume_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => ({
  decisionScope: uniqueIndex("aperture_play_decision_scope").on(table.userId, table.runId, table.candidateId),
  byRun: index("aperture_play_decision_run_idx").on(table.runId),
}));
export type AperturePlayDecision = typeof aperturePlayDecisions.$inferSelect;
export type InsertAperturePlayDecision = typeof aperturePlayDecisions.$inferInsert;

/**
 * A daily decision-time snapshot of the system's paper opportunity set.
 *
 * A slate is deliberately separate from a research run: the same completed run
 * can be relevant on several days, but a historical replay needs to preserve
 * exactly what was surfaced, which canonical thesis and account boundary were
 * active, and what the operator knew at that specific point in time.
 */
export const aperturePlaySlates = mysqlTable("aperture_play_slates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  canonicalThesisId: int("canonical_thesis_id"),
  accountId: int("account_id"),
  /** ET calendar date that the daily decision surface represented. */
  sessionDateEt: varchar("session_date_et", { length: 10 }).notNull(),
  /** Named decision checkpoint: e.g. opening, mid_session, catalyst. */
  windowKey: varchar("window_key", { length: 64 }).notNull().default("opening"),
  /** Historical reconstruction is useful for review but never treated as a live captured recommendation. */
  snapshotBasis: mysqlEnum("snapshot_basis", ["live_capture", "historical_reconstruction"]).default("live_capture").notNull(),
  status: mysqlEnum("status", ["captured", "awaiting_outcome", "complete"]).default("captured").notNull(),
  /** A slate-level cash decision is distinct from declining an individual play. */
  operatorDecision: mysqlEnum("operator_decision", ["not_recorded", "cash", "selected"]).default("not_recorded").notNull(),
  operatorReason: text("operator_reason"),
  decidedAt: bigint("decided_at", { mode: "number" }),
  /** Immutable account/equity/freshness state available during the decision. */
  portfolioSnapshot: json("portfolio_snapshot").$type<Record<string, unknown>>().notNull(),
  /** Market clock, data-provider availability, and active-thesis presentation context. */
  contextSnapshot: json("context_snapshot").$type<Record<string, unknown>>().notNull(),
  capturedAt: bigint("captured_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => ({
  oneSlatePerThesisSession: uniqueIndex("aperture_play_slate_user_thesis_date_window_unique").on(table.userId, table.canonicalThesisId, table.sessionDateEt, table.windowKey),
  byUserCapture: index("aperture_play_slate_user_capture_idx").on(table.userId, table.capturedAt),
}));
export type AperturePlaySlate = typeof aperturePlaySlates.$inferSelect;
export type InsertAperturePlaySlate = typeof aperturePlaySlates.$inferInsert;

/**
 * One immutable recommended play within a captured daily slate.
 *
 * `recommendationSnapshot` carries the fully rendered, modelled recipe and its
 * assumptions. It is never updated from a later rerun. `outcome*` fields state
 * a counterfactual, not a fill or performance result; unknown or ambiguous tape
 * remains explicitly unresolved and is excluded from trust calibration.
 */
export const aperturePlaySlateItems = mysqlTable("aperture_play_slate_items", {
  id: int("id").autoincrement().primaryKey(),
  slateId: int("slate_id").notNull(),
  sourceRunId: int("source_run_id").notNull(),
  sourceCandidateId: int("source_candidate_id").notNull(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  conditionKey: varchar("condition_key", { length: 160 }).notNull(),
  /** Exact candidate, evidence, and constructed recipe available at capture. */
  recommendationSnapshot: json("recommendation_snapshot").$type<Record<string, unknown>>().notNull(),
  /** Choice at play level; cash remains a slate-level decision. */
  operatorDecision: mysqlEnum("operator_decision", ["not_recorded", "selected", "skipped", "deferred"]).default("not_recorded").notNull(),
  operatorReason: text("operator_reason"),
  decidedAt: bigint("decided_at", { mode: "number" }),
  outcomeStatus: mysqlEnum("outcome_status", ["pending", "resolved", "unavailable"]).default("pending").notNull(),
  outcomeResult: mysqlEnum("outcome_result", ["win", "breakeven", "loss", "not_triggered", "unresolved"]).default("unresolved").notNull(),
  triggerObservation: mysqlEnum("trigger_observation", ["met", "not_met", "not_observed"]).default("not_observed").notNull(),
  exitObservation: mysqlEnum("exit_observation", ["time_stop", "stop_hit", "ambiguous", "not_observed"]).default("not_observed").notNull(),
  entryPriceCents: bigint("entry_price_cents", { mode: "number" }),
  settlementPriceCents: bigint("settlement_price_cents", { mode: "number" }),
  returnBps: int("return_bps"),
  rMultiple: float("r_multiple"),
  outcomeBasis: mysqlEnum("outcome_basis", ["verified", "modeled", "unknown"]).default("unknown").notNull(),
  outcomeProviderId: varchar("outcome_provider_id", { length: 32 }),
  outcomeSourceUrl: text("outcome_source_url"),
  observedAt: bigint("observed_at", { mode: "number" }),
  outcomeExplanation: text("outcome_explanation"),
  computedAt: bigint("computed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => ({
  oneCandidatePerSlate: uniqueIndex("aperture_play_slate_item_unique").on(table.slateId, table.sourceCandidateId),
  bySlate: index("aperture_play_slate_item_slate_idx").on(table.slateId),
  byTrustCondition: index("aperture_play_slate_item_condition_idx").on(table.conditionKey, table.outcomeStatus, table.outcomeBasis),
}));
export type AperturePlaySlateItem = typeof aperturePlaySlateItems.$inferSelect;
export type InsertAperturePlaySlateItem = typeof aperturePlaySlateItems.$inferInsert;

/** Competing deployment strategies — the output is a choice, not a list. */
export const apertureStrategies = mysqlTable("aperture_strategies", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  kind: mysqlEnum("kind", ["concentrated", "expanded", "risk_balanced", "dry_powder", "human_baseline"]).notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  rationale: text("rationale"),
  allocations: json("allocations").$type<Array<{ symbol: string; dollarsCents: number; pctOfDeployable: number }>>().default([]),
  cashRetainedCents: bigint("cash_retained_cents", { mode: "number" }),
  /** Concentration, correlation, liquidity, thesis exposure — each with a basis. */
  portfolioImpact: json("portfolio_impact"),
  /** What deploying here gives up versus the alternatives and versus cash. */
  opportunityCost: json("opportunity_cost"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type ApertureStrategy = typeof apertureStrategies.$inferSelect;
export type InsertApertureStrategy = typeof apertureStrategies.$inferInsert;

/** The thesis decomposed into a tree — "AI infrastructure" → power → uranium. */
export const exposureNodes = mysqlTable("exposure_nodes", {
  id: int("id").autoincrement().primaryKey(),
  thesisId: int("thesis_id").notNull(),
  parentId: int("parent_id"),
  label: varchar("label", { length: 160 }).notNull(),
  depth: int("depth").default(0).notNull(),
  path: varchar("path", { length: 512 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type ExposureNode = typeof exposureNodes.$inferSelect;
export type InsertExposureNode = typeof exposureNodes.$inferInsert;

/** Which nodes the portfolio actually covers — and which are underexposed. */
export const exposureCoverage = mysqlTable("exposure_coverage", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  nodeId: int("node_id").notNull(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  weightPct: float("weight_pct"),
  source: mysqlEnum("source", ["holding", "intended", "candidate"]).notNull(),
});
export type ExposureCoverage = typeof exposureCoverage.$inferSelect;
export type InsertExposureCoverage = typeof exposureCoverage.$inferInsert;

/**
 * Every symbol the run deliberately dropped, and the rule that dropped it.
 *
 * assembleRun has always computed this list; until migration 0037 it was thrown
 * away at persistence and only the coarse `dropped_note` survived. The honest-gap
 * list is the thing that separates this from a screener — "we looked at 41 names
 * and set 12 aside for these stated reasons" is a defensible piece of work;
 * "here are 29 names" is not. A row per symbol (rather than a json blob on
 * aperture_runs) so a name that keeps failing the same hard stop across runs is
 * queryable, and so this joins to candidates the same way exposure_coverage does.
 */
export const apertureSetAside = mysqlTable("aperture_set_aside", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  /** The hard stop that dropped it, in the scorer's own words. Never blank. */
  reason: text("reason").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => ({
  byRun: index("aperture_set_aside_run_idx").on(table.runId),
}));
export type ApertureSetAside = typeof apertureSetAside.$inferSelect;
export type InsertApertureSetAside = typeof apertureSetAside.$inferInsert;

// ── Phase 2: Execute, Monitor, Measure ───────────────────────────────────────

/**
 * Paper orders — the human approves, the system submits, fills are mirrored back.
 * No live money. assertPaperOnly() enforces this at the adapter layer.
 *
 * Lifecycle: pending_approval → approved → submitted → filled | rejected | cancelled
 * A human must approve before submission. There is no auto-submit path.
 */
export const brokerOrders = mysqlTable("broker_orders", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  candidateId: int("candidate_id"),
  accountId: int("account_id").notNull(),
  userId: int("user_id").notNull(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  side: mysqlEnum("side", ["buy", "sell"]).notNull(),
  /** Whole or fractional shares. Exactly one of qty / notionalCents. */
  qty: float("qty"),
  notionalCents: bigint("notional_cents", { mode: "number" }),
  orderType: mysqlEnum("order_type", ["market", "limit"]).default("market").notNull(),
  limitPriceCents: bigint("limit_price_cents", { mode: "number" }),
  timeInForce: mysqlEnum("time_in_force", ["day", "gtc"]).default("day").notNull(),
  /** Human approval is required before submission. */
  status: mysqlEnum("status", [
    "pending_approval", "approved", "submitted", "filled", "rejected", "cancelled",
  ]).default("pending_approval").notNull(),
  /** Broker-assigned order ID, set after submission. */
  brokerOrderId: varchar("broker_order_id", { length: 128 }),
  /** Fill details, mirrored from the broker after the order settles. */
  filledQty: float("filled_qty"),
  filledAvgPriceCents: bigint("filled_avg_price_cents", { mode: "number" }),
  /** Why the human rejected or the broker rejected. */
  rejectionReason: text("rejection_reason"),
  // ── Risk gates — see server/aperture/gates.ts. Null on pre-mandate rows. ───
  /** Why this trade. Required; boilerplate is rejected at the gate. */
  reason: text("reason"),
  /** What would make it wrong. Required; boilerplate is rejected at the gate. */
  invalidationCondition: text("invalidation_condition"),
  /** Optional price level attached to the invalidation. */
  invalidationPriceCents: bigint("invalidation_price_cents", { mode: "number" }),
  /** Intraday play recipe: entry, stop, and slippage are operator-stated price controls. */
  entryPriceCents: bigint("entry_price_cents", { mode: "number" }),
  stopPriceCents: bigint("stop_price_cents", { mode: "number" }),
  slippageCents: bigint("slippage_cents", { mode: "number" }),
  /** Derived server-side from quantity × stop distance including slippage. */
  plannedRiskCents: bigint("planned_risk_cents", { mode: "number" }),
  /** A human review deadline for an intraday close; never an autonomous exit. */
  timeStopAt: bigint("time_stop_at", { mode: "number" }),
  /** Market conditions that mean the operator should not create or should reject this proposal. */
  noTradeConditions: json("no_trade_conditions").$type<string[]>().default([]),
  holdingPeriod: mysqlEnum("holding_period", ["intraday", "overnight", "swing", "catalyst_window"]),
  catalystDeadlineAt: bigint("catalyst_deadline_at", { mode: "number" }),
  /** regular | pre_market | after_hours | closed | unknown, at creation time. */
  marketSession: varchar("market_session", { length: 24 }),
  /** HOW the session was determined — computed, never asserted. */
  sessionBasis: varchar("session_basis", { length: 200 }),
  /** When the operator echoed the paper acknowledgement. */
  paperAckAt: bigint("paper_ack_at", { mode: "number" }),
  /** The notional the ceilings were actually checked against (qty orders included). */
  gatedNotionalCents: bigint("gated_notional_cents", { mode: "number" }),
  mandateVersion: varchar("mandate_version", { length: 16 }),
  /** The full gate evaluation, so a blocked order records which ceiling stopped it. */
  gateSnapshot: json("gate_snapshot"),
  approvedAt: bigint("approved_at", { mode: "number" }),
  submittedAt: bigint("submitted_at", { mode: "number" }),
  filledAt: bigint("filled_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type BrokerOrder = typeof brokerOrders.$inferSelect;
export type InsertBrokerOrder = typeof brokerOrders.$inferInsert;

/**
 * Position snapshots — periodic captures of account state for P&L tracking.
 * Measured from real paper fills, never asserted.
 */
export const positionSnapshots = mysqlTable("position_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  runId: int("run_id"),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  qty: float("qty").notNull(),
  avgCostCents: bigint("avg_cost_cents", { mode: "number" }),
  lastPriceCents: bigint("last_price_cents", { mode: "number" }),
  marketValueCents: bigint("market_value_cents", { mode: "number" }),
  unrealizedPnlCents: bigint("unrealized_pnl_cents", { mode: "number" }),
  /** Verified = from broker API. Modeled = estimated from last known price. */
  priceBasis: mysqlEnum("price_basis", ["verified", "modeled"]).default("modeled").notNull(),
  snapshotAt: bigint("snapshot_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type PositionSnapshot = typeof positionSnapshots.$inferSelect;
export type InsertPositionSnapshot = typeof positionSnapshots.$inferInsert;

/**
 * Monitoring checks — post-entry catalyst and thesis-invalidation signals.
 * Sourced from Sonar with citations. A check that fires is surfaced to the
 * operator; it does not trigger any autonomous action.
 */
export const monitoringChecks = mysqlTable("monitoring_checks", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull(),
  candidateId: int("candidate_id").notNull(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  checkType: mysqlEnum("check_type", ["catalyst", "thesis_invalidation", "earnings", "macro"]).notNull(),
  /** What the check found. Null if nothing material. */
  finding: text("finding"),
  /** Did this check find something that warrants operator review? */
  flagged: boolean("flagged").default(false).notNull(),
  citations: json("citations").$type<string[]>().default([]),
  checkedAt: bigint("checked_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type MonitoringCheck = typeof monitoringChecks.$inferSelect;
export type InsertMonitoringCheck = typeof monitoringChecks.$inferInsert;

/**
 * Aperture Alpha — the honest product metric.
 *
 * Measures: human opportunity set vs system opportunity set, candidates added,
 * and deltas in return, max drawdown, concentration, and capital utilization.
 * Computed from real paper outcomes only. Never asserted.
 *
 * One row per run, updated as fills arrive and positions are marked.
 */
export const apertureAlpha = mysqlTable("aperture_alpha", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("run_id").notNull().unique(),
  userId: int("user_id").notNull(),
  /** How many symbols the human intended to trade. */
  humanOpportunitySetCount: int("human_opportunity_set_count").default(0).notNull(),
  /** How many symbols the system discovered beyond the human set. */
  systemAddedCount: int("system_added_count").default(0).notNull(),
  /** How many system candidates the human approved and filled. */
  systemFilledCount: int("system_filled_count").default(0).notNull(),
  /** P&L of human-intended positions (paper, cents). */
  humanPnlCents: bigint("human_pnl_cents", { mode: "number" }),
  /** P&L of system-added positions (paper, cents). */
  systemPnlCents: bigint("system_pnl_cents", { mode: "number" }),
  /** Max drawdown of the full aperture portfolio (basis points). */
  maxDrawdownBps: int("max_drawdown_bps"),
  /** HHI concentration before vs after system additions. */
  hhiBefore: float("hhi_before"),
  hhiAfter: float("hhi_after"),
  /** Capital utilization: deployed / deployable. */
  capitalUtilizationPct: float("capital_utilization_pct"),
  // ── Pilot scorecard: baseline · benchmark · sample size · horizon ─────────
  // Without these, "system P&L was +$400" is a number with nothing behind it.
  /** Every system candidate that reached an order, approved or not. */
  systemSurfacedCount: int("system_surfaced_count"),
  /** System candidates the operator declined — the filter, made visible. */
  systemDeclinedCount: int("system_declined_count"),
  selectionBiasNote: text("selection_bias_note"),
  /** What the system is measured against: the operator's plan, or cash. */
  baselineKind: mysqlEnum("baseline_kind", ["human_intended", "cash_only"]),
  baselinePnlCents: bigint("baseline_pnl_cents", { mode: "number" }),
  baselineNote: text("baseline_note"),
  /** Market benchmark. Null + basis "unknown" when no priced history covers it. */
  benchmarkSymbol: varchar("benchmark_symbol", { length: 24 }),
  benchmarkReturnBps: int("benchmark_return_bps"),
  benchmarkBasis: mysqlEnum("benchmark_basis", ["verified", "modeled", "unknown"]),
  benchmarkNote: text("benchmark_note"),
  /** Sample size, and which claim it can carry. n=30 cannot measure an edge. */
  filledOrderCount: int("filled_order_count"),
  closedTradeCount: int("closed_trade_count"),
  sampleSufficiency: mysqlEnum("sample_sufficiency", ["process_only", "indicative", "edge_capable"]),
  sampleNote: text("sample_note"),
  /** Horizon the figures cover. */
  horizonStartAt: bigint("horizon_start_at", { mode: "number" }),
  horizonEndAt: bigint("horizon_end_at", { mode: "number" }),
  horizonDays: float("horizon_days"),
  holdingPeriod: mysqlEnum("holding_period", ["intraday", "overnight", "swing", "catalyst_window"]),
  /** Paper fills flatter. The assumption travels with the figures. */
  slippageAssumption: text("slippage_assumption"),
  /** Basis for all figures: verified = from real fills, modeled = estimated. */
  metricBasis: mysqlEnum("metric_basis", ["verified", "modeled", "mixed"]).default("modeled").notNull(),
  lastComputedAt: bigint("last_computed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type ApertureAlpha = typeof apertureAlpha.$inferSelect;
export type InsertApertureAlpha = typeof apertureAlpha.$inferInsert;
