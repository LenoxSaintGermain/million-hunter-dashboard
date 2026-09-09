/**
 * Existing legacy STACK tables, not a new production migration.
 * Authority: main's read-only SHOW CREATE capture, 2026-09-09, corroborated by
 * .manus/db/db-query-1778509049216.json (original deployment, 6892337).
 * No data, AUTO_INCREMENT counter, or production engine directive is copied.
 */
import { bigint, boolean, decimal, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const capitalStackTemplates = mysqlTable("capital_stack_templates", {
  id: int("id").autoincrement().primaryKey(),
  templateId: varchar("template_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  thesisAlignment: varchar("thesis_alignment", { length: 128 }),
  totalLayers: int("total_layers").default(0),
  targetLtv: decimal("target_ltv", { precision: 5, scale: 2 }),
  targetEquityPct: decimal("target_equity_pct", { precision: 5, scale: 2 }),
  targetSellerNotePct: decimal("target_seller_note_pct", { precision: 5, scale: 2 }),
  isPrincipalDefault: boolean("is_principal_default").default(false),
  isActive: boolean("is_active").default(true),
  disclaimer: text("disclaimer"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, table => ({ templateIdUnique: uniqueIndex("template_id").on(table.templateId) }));

export const capitalStacks = mysqlTable("capital_stacks", {
  id: int("id").autoincrement().primaryKey(),
  dealId: varchar("deal_id", { length: 64 }),
  templateId: varchar("template_id", { length: 64 }),
  userId: int("user_id"),
  name: varchar("name", { length: 255 }),
  purchasePrice: bigint("purchase_price", { mode: "number" }),
  totalCapital: bigint("total_capital", { mode: "number" }),
  status: mysqlEnum("status", ["draft", "modeled", "approved", "closed"]).default("draft"),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const capitalStackLayers = mysqlTable("capital_stack_layers", {
  id: int("id").autoincrement().primaryKey(),
  stackId: int("stack_id").notNull(),
  layerOrder: int("layer_order").notNull(),
  layerType: mysqlEnum("layer_type", ["senior_debt", "sba_7a", "sba_504", "seller_note", "equity", "mezzanine", "grant", "reap", "earnout", "rollover_equity", "other"]).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  pctOfTotal: decimal("pct_of_total", { precision: 5, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  termMonths: int("term_months"),
  lender: varchar("lender", { length: 255 }),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
