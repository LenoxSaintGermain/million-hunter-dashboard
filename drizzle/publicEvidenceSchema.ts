import { bigint, datetime, index, int, json, mysqlEnum, mysqlTable, primaryKey, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import type { SecSubmissionsResult } from "../shared/secEvidence";

/** Personal issuer research receipts, never an acquisition-deal identity match.
 * Append-only through the repository. No FK: ownership is enforced on all reads.
 */
export const publicEvidenceReceipts = mysqlTable("public_evidence_receipts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull(),
  subjectKey: varchar("subject_key", { length: 17 }).notNull(),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  provider: mysqlEnum("provider", ["sec-submissions"]).notNull(),
  schemaVersion: int("schema_version").$type<1>().notNull(),
  sourceUrl: varchar("source_url", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["ok", "empty", "unavailable"]).notNull(),
  payload: json("payload").$type<SecSubmissionsResult>().notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  recordedAt: datetime("recorded_at", { mode: "date", fsp: 3 }).notNull(),
  retrievedAt: datetime("retrieved_at", { mode: "date", fsp: 3 }),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }),
  message: text("message"),
  failureCode: varchar("failure_code", { length: 64 }),
}, table => [
  uniqueIndex("public_evidence_owner_request_uq").on(table.ownerId, table.requestId),
  index("public_evidence_owner_subject_time_idx").on(table.ownerId, table.subjectKey, table.recordedAt, table.id),
]);

/** One global row and one row per owner; no per-window row accumulation. */
export const publicEvidenceBudgets = mysqlTable("public_evidence_budgets", {
  budgetKey: varchar("budget_key", { length: 64 }).primaryKey(),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
  requestCount: int("request_count").notNull(),
  secondStart: bigint("second_start", { mode: "number" }).notNull(),
  secondCount: int("second_count").notNull(),
  cooldownUntil: bigint("cooldown_until", { mode: "number" }).notNull().default(0),
});

/** Durable execution claims are never renewed, reassigned or deleted by the API.
 * A pending claim means outcome unknown, not proof that no request was sent.
 */
export const publicEvidenceCaptureClaims = mysqlTable("public_evidence_capture_claims", {
  ownerId: int("owner_id").notNull(),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  subjectKey: varchar("subject_key", { length: 17 }).notNull(),
  startedAt: datetime("started_at", { mode: "date", fsp: 3 }).notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.requestId] })]);
