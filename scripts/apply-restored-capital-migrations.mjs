/**
 * Reconciles a database restored before the Capital Aperture migrations landed.
 *
 * Safety contract:
 * - DDL only; no INSERT, UPDATE, DELETE, or backfill.
 * - Runs additive migrations in dependency order.
 * - 0029 contributes only its nullable bridge column; 0030's final composite
 *   unique key supersedes 0029's transient single-column index.
 * - 0030 is included because Jim's fixture requires thesis_shares.
 * - 0031 is included because the restored backup lacks its required
 *   users.default_workspace prerequisite for 0041.
 * - 0032's broker-order portion is intentionally skipped because 0034 is the
 *   canonical replacement. Its aperture_runs preset columns still apply.
 * - 0046 is intentionally skipped: the current 0045 table definition already
 *   contains window_key, snapshot_basis, and the final unique key.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPlan = [
  { file: "0029_canonical_thesis_bridge.sql", filter: (sql) => sql.includes("ALTER TABLE `capital_theses`") },
  { file: "0030_thesis_workspace_sharing.sql" },
  { file: "0031_default_workspace.sql" },
  { file: "0032_aperture_risk_gates.sql", filter: (sql) => sql.includes("ALTER TABLE `aperture_runs`") },
  { file: "0033_aperture_evidence_reviews.sql" },
  { file: "0034_broker_order_risk_gate_repair.sql" },
  { file: "0035_intraday_play_recipe.sql" },
  { file: "0036_pilot_scorecard.sql" },
  { file: "0037_aperture_cockpit.sql" },
  { file: "0038_aperture_play_decisions.sql" },
  { file: "0039_play_defer_resume.sql" },
  { file: "0040_candidate_play_side.sql" },
  { file: "0041_trader_default_workspace.sql" },
  { file: "0042_cockpit_rail_preference.sql" },
  { file: "0043_cockpit_constraint_acknowledgement.sql" },
  { file: "0044_active_capital_thesis.sql" },
  { file: "0045_play_outcome_ledger.sql" },
  { file: "0047_daily_outcome_refresh_schedule.sql" },
  { file: "0048_one_time_glp1_research_schedule.sql" },
  { file: "0049_paper_account_sync_schedule.sql" },
  { file: "0050_order_intent.sql" },
];

function statementsFrom(file) {
  const source = fs.readFileSync(path.join(projectRoot, "drizzle", file), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return source
    .split(/;\s*(?:--\> statement-breakpoint)?/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isAlreadyApplied(error) {
  return ["ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_TABLE_EXISTS_ERROR", "ER_CANT_DROP_FIELD_OR_KEY"].includes(error?.code)
    || /duplicate column|duplicate key|already exists|check that column\/key exists/i.test(error?.message ?? "");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const report = [];

try {
  for (const step of migrationPlan) {
    const statements = statementsFrom(step.file).filter((sql) => step.filter?.(sql) ?? true);
    let applied = 0;
    let skipped = 0;
    for (const statement of statements) {
      try {
        await connection.execute(statement);
        applied += 1;
      } catch (error) {
        if (!isAlreadyApplied(error)) throw error;
        skipped += 1;
      }
    }
    report.push({ migration: step.file, applied, skipped });
  }
  report.push({
    migration: "0046_play_slate_window_and_reconstruction.sql",
    applied: 0,
    skipped: 1,
    note: "Superseded by the final 0045 table definition; no DDL required.",
  });
  console.table(report);
} finally {
  await connection.end();
}

// mysql2 may retain an idle handle briefly after end(); this runner is a
// one-shot operational script, so exit deterministically after its report.
process.exit(0);
