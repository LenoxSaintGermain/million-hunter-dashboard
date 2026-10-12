import { datetime, index, int, json, mysqlEnum, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import type { DealEvidenceSnapshot, EvidenceAnalysisOutput } from "../shared/dealEvidence";

export const dealEvidenceAttachments = mysqlTable("deal_evidence_attachments", {
  id: varchar("id", { length: 36 }).primaryKey(), ownerId: int("owner_id").notNull(), dealId: int("deal_id").notNull(),
  requestId: varchar("request_id", { length: 36 }).notNull(), receiptId: varchar("receipt_id", { length: 36 }).notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(), confirmedCik: varchar("confirmed_cik", { length: 10 }).notNull(),
  relation: mysqlEnum("relation", ["same_legal_entity"]).notNull(),
  identityBasis: varchar("identity_basis", { length: 64 }).$type<"owner_confirmed_not_independently_verified">().notNull(),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
}, table => [uniqueIndex("deal_evidence_attachment_request_uq").on(table.ownerId, table.requestId),
  index("deal_evidence_attachment_deal_idx").on(table.ownerId, table.dealId, table.createdAt, table.id)]);

/** Immutable start record also provides a durable execution claim. */
export const dealEvidenceAnalysisRequests = mysqlTable("deal_evidence_analysis_requests", {
  id: varchar("id", { length: 36 }).primaryKey(), ownerId: int("owner_id").notNull(), dealId: int("deal_id").notNull(),
  requestId: varchar("request_id", { length: 36 }).notNull(), requestHash: varchar("request_hash", { length: 64 }).notNull(),
  mode: mysqlEnum("mode", ["red_team", "ic"]).notNull(), models: json("models").$type<string[]>().notNull(),
  inputSnapshot: json("input_snapshot").$type<DealEvidenceSnapshot>().notNull(),
  startedAt: datetime("started_at", { mode: "date", fsp: 3 }).notNull(),
}, table => [uniqueIndex("deal_evidence_analysis_request_uq").on(table.ownerId, table.requestId),
  index("deal_evidence_analysis_deal_idx").on(table.ownerId, table.dealId, table.startedAt, table.id)]);

/** Completion is an INSERT, never an UPDATE to the claim or an old decision. */
export const dealEvidenceAnalysisResults = mysqlTable("deal_evidence_analysis_results", {
  id: varchar("id", { length: 36 }).primaryKey(), ownerId: int("owner_id").notNull(), dealId: int("deal_id").notNull(),
  status: mysqlEnum("status", ["complete", "failed"]).notNull(),
  output: json("output").$type<EvidenceAnalysisOutput>(),
  failureCode: varchar("failure_code", { length: 64 }), message: varchar("message", { length: 1000 }),
  completedAt: datetime("completed_at", { mode: "date", fsp: 3 }).notNull(),
});
