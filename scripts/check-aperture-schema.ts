/**
 * Is migration 0028 (Capital Aperture) actually present on this database?
 *
 * Worth having as its own check because a Manus deploy ships CODE; it does not
 * necessarily run migrations. "Deployed" and "migrated" are separate facts, and
 * assuming the first implies the second is how you get a router that 500s on
 * every call against a table that was never created.
 *
 * READ-ONLY. Every statement is a catalogue lookup.
 *
 *     export PATH="/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH"
 *     npx tsx scripts/check-aperture-schema.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

const TABLES = [
  "capital_theses",
  "portfolio_accounts",
  "positions",
  "securities",
  "security_facts",
  "aperture_runs",
  "aperture_candidates",
  "aperture_strategies",
  "exposure_nodes",
  "exposure_coverage",
];

const COLUMNS: Array<[string, string]> = [["users", "merged_into_user_id"]];

function unwrap(rows: any): any[] {
  if (!Array.isArray(rows)) return rows ? [rows] : [];
  return Array.isArray(rows[0]) ? rows[0] : rows;
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Could not connect to the database.");
    process.exit(1);
  }

  console.log("Migration 0028 — Capital Aperture · schema presence check\n");

  const present: string[] = [];
  const missing: string[] = [];

  for (const t of TABLES) {
    const rows = unwrap(
      await db.execute(
        sql`SELECT COUNT(*) AS n FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = ${t}`,
      ),
    );
    (Number(rows[0]?.n ?? 0) > 0 ? present : missing).push(t);
  }

  for (const [table, column] of COLUMNS) {
    const rows = unwrap(
      await db.execute(
        sql`SELECT COUNT(*) AS n FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column}`,
      ),
    );
    (Number(rows[0]?.n ?? 0) > 0 ? present : missing).push(`${table}.${column}`);
  }

  console.log(`PRESENT (${present.length})`);
  for (const p of present) console.log(`  ✓ ${p}`);
  console.log(`\nMISSING (${missing.length})`);
  for (const m of missing) console.log(`  ✗ ${m}`);

  if (!missing.length) {
    console.log("\n0028 is fully applied. The merge script and the Aperture router can run.");
    process.exit(0);
  }
  if (present.length === 0) {
    console.log("\n0028 has NOT been applied at all — the deploy shipped code without running migrations.");
    console.log("Apply it with:  npx tsx scripts/apply-0028.ts --apply");
    console.log("");
    console.log("Do NOT reach for `pnpm db:push` on this database. drizzle-kit push diffs the");
    console.log("WHOLE of schema.ts against the live schema and will happily propose dropping or");
    console.log("altering unrelated columns wherever prod has drifted from the file. 0028 is");
    console.log("purely additive; apply exactly it and nothing else.");
  } else {
    console.log("\n0028 is PARTIALLY applied. Do not re-run the whole file blindly —");
    console.log("apply only the missing objects, or the CREATE TABLEs that already exist will error.");
  }
  process.exit(1);
}

main().catch((e) => {
  console.error("Check failed:", e);
  process.exit(1);
});
