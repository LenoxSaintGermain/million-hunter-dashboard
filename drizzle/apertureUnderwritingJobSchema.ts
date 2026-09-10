import { bigint, int, json, mysqlEnum, mysqlTable, text, varchar, index, uniqueIndex } from "drizzle-orm/mysql-core";
import type { CapitalObjective } from "../shared/playUnderwriting";
import type { StrategyDiscoveryRequest } from "../shared/strategyDiscoveryJob";

// Analysis jobs are not broker dispatch jobs. A lease fences a lost worker's result.
export const apertureUnderwritingJobs = mysqlTable("aperture_underwriting_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  decisionRunId: int("decisionRunId").notNull(),
  decisionRevisionId: int("decisionRevisionId").notNull(),
  requestKey: varchar("requestKey", { length: 64 }).notNull(),
  request: json("request").$type<{ objective: CapitalObjective; requestedPlayCount: 1 | 2 | 3; appendRevision: boolean; revisionRequestId?: string; illustrativeUatFixture?: boolean; discovery?: StrategyDiscoveryRequest }>().notNull(),
  state: mysqlEnum("state", ["running", "complete", "failed"]).notNull(),
  milestone: mysqlEnum("milestone", ["market_evidence", "recording_result", "complete", "failed"]).notNull(),
  attemptToken: varchar("attemptToken", { length: 36 }).notNull(),
  attempt: int("attempt").notNull().default(1),
  leaseUntil: bigint("leaseUntil", { mode: "number" }).notNull(),
  resultRevisionId: int("resultRevisionId"),
  failure: text("failure"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, (table) => [
  uniqueIndex("underwriting_job_request").on(table.userId, table.decisionRunId, table.requestKey),
  index("underwriting_job_owner_revision").on(table.userId, table.decisionRevisionId, table.updatedAt),
]);
