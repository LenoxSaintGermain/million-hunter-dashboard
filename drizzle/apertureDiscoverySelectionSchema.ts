import { bigint, int, json, mysqlTable, varchar, uniqueIndex, index } from "drizzle-orm/mysql-core";

/** An operator-selected research lead, not capital reservation or trade approval. */
export const apertureDiscoverySelections = mysqlTable("aperture_discovery_selections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sourceDecisionRunId: int("source_decision_run_id").notNull(),
  sourceRevisionId: int("source_revision_id").notNull(),
  discoveryReceiptId: int("discovery_receipt_id").notNull(),
  hypothesisId: varchar("hypothesis_id", { length: 160 }).notNull(),
  researchDecisionRunId: int("research_decision_run_id").notNull(),
  researchRevisionId: int("research_revision_id").notNull(),
  capitalThesisId: int("capital_thesis_id").notNull(),
  sourceRecordHash: varchar("source_record_hash", { length: 64 }).notNull(),
  context: json("context").$type<Record<string, unknown>>().notNull(),
  recordHash: varchar("record_hash", { length: 64 }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, table => [
  uniqueIndex("aperture_selection_source_hypothesis_uq").on(table.userId, table.discoveryReceiptId, table.hypothesisId),
  uniqueIndex("aperture_selection_research_decision_uq").on(table.researchDecisionRunId),
  uniqueIndex("aperture_selection_projection_uq").on(table.capitalThesisId),
  index("aperture_selection_owner_source_idx").on(table.userId, table.sourceDecisionRunId, table.sourceRevisionId),
]);
