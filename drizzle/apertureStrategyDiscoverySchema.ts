import { bigint, int, json, mysqlTable, varchar, index, uniqueIndex } from "drizzle-orm/mysql-core";
import type { StrategyDiscoveryResult } from "../server/aperture/strategyDiscovery";
import type { StrategyDiscoveryRequest } from "../shared/strategyDiscoveryJob";

/** Immutable result per fenced attempt in the existing analysis-job lifecycle. */
export const apertureStrategyDiscoveries = mysqlTable("aperture_strategy_discoveries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  decisionRunId: int("decision_run_id").notNull(),
  decisionRevisionId: int("decision_revision_id").notNull(),
  jobId: int("job_id").notNull(),
  attempt: int("attempt").notNull(),
  attemptToken: varchar("attempt_token", { length: 36 }).notNull(),
  request: json("request").$type<StrategyDiscoveryRequest>().notNull(),
  // Wrappers distinguish a raw JSON string from a driver's JSON-encoded column.
  payload: json("payload").$type<{ raw: unknown }>().notNull(),
  manifest: json("manifest").$type<{ raw: unknown }>().notNull(),
  result: json("result").$type<StrategyDiscoveryResult>().notNull(),
  recordHash: varchar("record_hash", { length: 64 }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, table => [
  uniqueIndex("aperture_discovery_job_attempt_uq").on(table.jobId, table.attempt),
  index("aperture_discovery_owner_revision_idx").on(table.userId, table.decisionRevisionId, table.id),
]);
