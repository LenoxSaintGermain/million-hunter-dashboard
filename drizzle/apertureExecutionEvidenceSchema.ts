import { bigint, index, int, json, mysqlEnum, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import type { OrderExecutionReceipt } from "../server/aperture/brokers/orderExecutions";

/** Append-only attempts; pending may finalize once. Never a gain/cash ledger. */
export const apertureExecutionEvidence = mysqlTable("aperture_execution_evidence", {
  id: int("id").autoincrement().primaryKey(), userId: int("user_id").notNull(),
  accountId: int("account_id").notNull(), runId: int("run_id").notNull(),
  candidateId: int("candidate_id").notNull(), orderId: int("order_id").notNull(),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  externalAccountId: varchar("external_account_id", { length: 128 }).notNull(),
  brokerOrderId: varchar("broker_order_id", { length: 128 }).notNull(),
  state: mysqlEnum("state", ["pending", "complete", "failed"]).notNull(),
  receipt: json("receipt").$type<OrderExecutionReceipt>(),
  recordHash: varchar("record_hash", { length: 64 }),
  failureCode: varchar("failure_code", { length: 64 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
}, table => [
  uniqueIndex("execution_evidence_owner_request_uq").on(table.userId, table.requestId),
  index("execution_evidence_owner_order_idx").on(table.userId, table.orderId, table.id),
]);
