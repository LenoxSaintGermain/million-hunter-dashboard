/**
 * Apply migration 0028 (Capital Aperture) — and nothing else.
 *
 * WHY NOT `pnpm db:push`: drizzle-kit push diffs the entire schema.ts against
 * the live database and proposes whatever it takes to reconcile them. On a
 * production database that has drifted — and this one has, it is shared with a
 * Manus sandbox — that can mean dropping or altering columns nobody asked it to
 * touch. This script executes exactly the statements in 0028 and stops.
 *
 * SAFETY:
 *   • Every statement is additive: CREATE TABLE / CREATE INDEX / ADD COLUMN.
 *     Nothing here drops, renames, or rewrites an existing object.
 *   • Idempotent: each object is checked first, so a partial application can be
 *     completed by re-running rather than by hand-editing SQL.
 *   • Dry run by default. --apply performs the writes.
 *   • Refuses to touch any table outside the 0028 set.
 *
 *     export PATH="/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH"
 *     npx tsx scripts/apply-0028.ts            # dry run — shows what it would do
 *     npx tsx scripts/apply-0028.ts --apply
 *
 * Reversal (all additive, so a full undo is clean):
 *   ALTER TABLE users DROP COLUMN merged_into_user_id;
 *   DROP TABLE exposure_coverage, exposure_nodes, aperture_strategies,
 *              aperture_candidates, aperture_runs, security_facts, securities,
 *              positions, portfolio_accounts, capital_theses;
 */
import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

const APPLY = process.argv.includes("--apply");
const MIGRATION = path.resolve(import.meta.dirname, "..", "drizzle", "0028_capital_aperture.sql");

/** The only objects this script is allowed to create. */
const OWNED_TABLES = new Set([
  "capital_theses", "portfolio_accounts", "positions", "securities", "security_facts",
  "aperture_runs", "aperture_candidates", "aperture_strategies", "exposure_nodes", "exposure_coverage",
]);

function unwrap(rows: any): any[] {
  if (!Array.isArray(rows)) return rows ? [rows] : [];
  return Array.isArray(rows[0]) ? rows[0] : rows;
}

/** Split on semicolons at end-of-line, dropping comment-only lines. */
function statements(sqlText: string): string[] {
  return sqlText
    .split(/;\s*$/m)
    .map((s) =>
      s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim(),
    )
    .filter(Boolean);
}

type Kind =
  | { kind: "create_table"; name: string }
  | { kind: "create_index"; name: string; table: string }
  | { kind: "add_column"; table: string; column: string }
  | { kind: "unknown" };

function classify(stmt: string): Kind {
  const t = stmt.match(/CREATE TABLE\s+`?(\w+)`?/i);
  if (t) return { kind: "create_table", name: t[1] };
  const i = stmt.match(/CREATE INDEX\s+`?(\w+)`?\s+ON\s+`?(\w+)`?/i);
  if (i) return { kind: "create_index", name: i[1], table: i[2] };
  const c = stmt.match(/ALTER TABLE\s+`?(\w+)`?\s+ADD COLUMN\s+`?(\w+)`?/i);
  if (c) return { kind: "add_column", table: c[1], column: c[2] };
  return { kind: "unknown" };
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Could not connect to the database.");
    process.exit(1);
  }

  const stmts = statements(readFileSync(MIGRATION, "utf8"));
  console.log(`Migration 0028 — ${stmts.length} statement(s)\n`);

  const exists = {
    table: async (name: string) =>
      Number(unwrap(await db.execute(
        sql`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ${name}`,
      ))[0]?.n ?? 0) > 0,
    index: async (table: string, name: string) =>
      Number(unwrap(await db.execute(
        sql`SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ${table} AND index_name = ${name}`,
      ))[0]?.n ?? 0) > 0,
    column: async (table: string, column: string) =>
      Number(unwrap(await db.execute(
        sql`SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column}`,
      ))[0]?.n ?? 0) > 0,
  };

  let toRun = 0;
  let skipped = 0;

  for (const stmt of stmts) {
    const k = classify(stmt);

    // Refuse anything that is not one of the additive shapes 0028 should contain.
    if (k.kind === "unknown") {
      console.error(`✗ REFUSING an unrecognised statement:\n${stmt.slice(0, 160)}`);
      console.error("  This script only applies CREATE TABLE / CREATE INDEX / ADD COLUMN.");
      process.exit(1);
    }
    const target = k.kind === "create_table" ? k.name : k.table;
    if (target !== "users" && !OWNED_TABLES.has(target)) {
      console.error(`✗ REFUSING to touch "${target}" — outside the 0028 object set.`);
      process.exit(1);
    }
    if (k.kind === "add_column" && !(target === "users" && k.column === "merged_into_user_id")) {
      console.error(`✗ REFUSING an unexpected column add: ${target}.${k.column}`);
      process.exit(1);
    }

    let already = false;
    let label = "";
    if (k.kind === "create_table") {
      already = await exists.table(k.name);
      label = `table ${k.name}`;
    } else if (k.kind === "create_index") {
      already = !(await exists.table(k.table)) ? false : await exists.index(k.table, k.name);
      label = `index ${k.table}.${k.name}`;
    } else {
      already = await exists.column(k.table, k.column);
      label = `column ${k.table}.${k.column}`;
    }

    if (already) {
      console.log(`  · ${label} — already present, skipping`);
      skipped++;
      continue;
    }

    toRun++;
    if (!APPLY) {
      console.log(`  + ${label} — WOULD CREATE`);
      continue;
    }
    try {
      await db.execute(sql.raw(stmt));
      console.log(`  ✓ ${label}`);
    } catch (e: any) {
      console.error(`  ✗ ${label} failed: ${e?.message ?? e}`);
      console.error("\nStopped. Nothing after this point was applied; re-run to continue.");
      process.exit(1);
    }
  }

  console.log(`\n${skipped} already present · ${toRun} ${APPLY ? "applied" : "pending"}`);
  if (!APPLY) {
    console.log("\nDRY RUN — nothing was written. Re-run with --apply.");
  } else {
    console.log("\nDone. Verify with:  npx tsx scripts/check-aperture-schema.ts");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Apply failed:", e);
  process.exit(1);
});
