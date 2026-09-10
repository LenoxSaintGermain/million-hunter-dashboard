import { bigint, index, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Immutable source identity, not a balance, reservation, or broker instruction. */
export const apertureCapitalEvents = mysqlTable("aperture_capital_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  accountId: int("account_id").notNull(),
  accountLabel: varchar("account_label", { length: 120 }).notNull(),
  brokerId: varchar("broker_id", { length: 32 }).notNull(),
  externalAccountId: varchar("external_account_id", { length: 128 }),
  sourceId: varchar("source_id", { length: 160 }).notNull(),
  /** Stable originating record identity, not a fresh ID for each preview/retry. */
  sourceKey: varchar("source_key", { length: 160 }).notNull(),
  capitalEventId: varchar("capital_event_id", { length: 160 }).notNull(),
  sourceKind: mysqlEnum("source_kind", ["operator_declared_excess", "reconciled_available_funds", "realized_gains", "returned_principal", "hypothetical_future_proceeds"]).notNull(),
  currency: mysqlEnum("currency", ["USD"]).notNull(),
  /** Declared/observed amount only. Null is unknown; never default to zero. */
  amountCents: bigint("amount_cents", { mode: "number" }),
  /** No verified ingestion path exists in this increment. */
  proofBasis: mysqlEnum("proof_basis", ["operator_declared", "unknown"]).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, table => [
  uniqueIndex("capital_event_owner_source_key_uq").on(table.userId, table.sourceKey),
  uniqueIndex("capital_event_owner_source_uq").on(table.userId, table.sourceId),
  uniqueIndex("capital_event_owner_event_uq").on(table.userId, table.capitalEventId),
  index("capital_event_owner_account_idx").on(table.userId, table.accountId, table.id),
]);

/** Amount/identity are immutable. State transitions require the event lock. */
export const apertureCapitalClaims = mysqlTable("aperture_capital_claims", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  accountId: int("account_id").notNull(),
  eventId: int("event_id").notNull(),
  allocationId: varchar("allocation_id", { length: 160 }).notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  state: mysqlEnum("state", ["pending", "committed", "consumed", "released"]).notNull(),
  previousState: mysqlEnum("previous_state", ["pending", "committed"]),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, table => [
  uniqueIndex("capital_claim_owner_allocation_uq").on(table.userId, table.allocationId),
  index("capital_claim_event_idx").on(table.eventId, table.id),
]);

export type ApertureCapitalEvent = typeof apertureCapitalEvents.$inferSelect;
export type ApertureCapitalClaim = typeof apertureCapitalClaims.$inferSelect;
