import { bigint, index, int, json, mysqlTable, uniqueIndex } from "drizzle-orm/mysql-core";
import type { MissionDraftValues } from "../shared/apertureMissionDraft";

/** Incomplete, owner-scoped input. Never treated as an authoritative Mission. */
export const apertureMissionDrafts = mysqlTable("aperture_mission_drafts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  version: int("version").notNull(),
  values: json("draft_values").$type<MissionDraftValues>().notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => [uniqueIndex("aperture_mission_drafts_owner_uq").on(table.userId)]);

/** Append-only raw drafts preserve what each accepted device revision contained. */
export const apertureMissionDraftRevisions = mysqlTable("aperture_mission_draft_revisions", {
  id: int("id").autoincrement().primaryKey(),
  draftId: int("draft_id").notNull(),
  userId: int("user_id").notNull(),
  version: int("version").notNull(),
  values: json("draft_values").$type<MissionDraftValues>().notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  uniqueIndex("aperture_mission_draft_revision_uq").on(table.draftId, table.version),
  index("aperture_mission_draft_revision_owner_idx").on(table.userId, table.createdAt),
]);
