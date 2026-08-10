/**
 * Point the duplicate Jim account at the canonical one.
 *
 * Decision (2026-08-10): canonical is 690001 "Jimmy Butler"
 * (lifecalendarai@gmail.com) — it owns the only real data, an investor_dna row
 * and an invite token it created. 7470015 "Jim Butler"
 * (gws@conciergecareerservices.com) owns nothing, so nothing has to move.
 *
 * WHAT THIS DOES: sets users.merged_into_user_id on the non-canonical row.
 * WHAT IT DOES NOT DO: delete a row, move a foreign key, or touch any other
 * table. createContext (server/_core/context.ts) resolves the pointer at request
 * time, so either OAuth identity lands in the same account. Reversible by
 * setting the column back to NULL.
 *
 * ⚠️ REQUIRES migration 0028 to have been applied — the column does not exist
 * until then, and 0028 ships on the next Manus deploy.
 *
 *     export PATH="/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH"
 *     npx tsx scripts/merge-jim-accounts.ts           # dry run, writes nothing
 *     npx tsx scripts/merge-jim-accounts.ts --apply   # performs the update
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

const CANONICAL_ID = 690001;   // Jimmy Butler · lifecalendarai@gmail.com
const DUPLICATE_ID = 7470015;  // Jim Butler   · gws@conciergecareerservices.com

const APPLY = process.argv.includes("--apply");

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

  // Fail loudly if the column is missing rather than half-applying.
  try {
    await db.execute(sql`SELECT merged_into_user_id FROM users LIMIT 1`);
  } catch {
    console.error(
      "users.merged_into_user_id does not exist yet.\n" +
        "Migration 0028 has not been applied to this database — deploy it first.",
    );
    process.exit(1);
  }

  const before = unwrap(
    await db.execute(
      sql`SELECT id, name, email, role, merged_into_user_id
          FROM users WHERE id IN (${CANONICAL_ID}, ${DUPLICATE_ID})`,
    ),
  );

  if (before.length !== 2) {
    console.error(`Expected both user rows; found ${before.length}. Refusing to act.`);
    process.exit(1);
  }

  const canonical = before.find((u: any) => Number(u.id) === CANONICAL_ID);
  const duplicate = before.find((u: any) => Number(u.id) === DUPLICATE_ID);

  console.log("BEFORE");
  for (const u of before) {
    console.log(`  ${u.id}  ${String(u.name).padEnd(14)} ${String(u.email).padEnd(38)} merged_into=${u.merged_into_user_id ?? "—"}`);
  }

  // Guard: the canonical row must not itself be a pointer, or requests would
  // need to follow a chain — which createContext deliberately refuses to do.
  if (canonical.merged_into_user_id != null) {
    console.error(`\nCanonical row ${CANONICAL_ID} is itself merged into ${canonical.merged_into_user_id}. Refusing to create a chain.`);
    process.exit(1);
  }

  if (Number(duplicate.merged_into_user_id) === CANONICAL_ID) {
    console.log("\nAlready merged. Nothing to do.");
    process.exit(0);
  }

  if (!APPLY) {
    console.log(
      `\nDRY RUN — would set users.merged_into_user_id = ${CANONICAL_ID} on row ${DUPLICATE_ID}.` +
        `\nNothing was written. Re-run with --apply to perform it.`,
    );
    process.exit(0);
  }

  await db.execute(
    sql`UPDATE users SET merged_into_user_id = ${CANONICAL_ID} WHERE id = ${DUPLICATE_ID}`,
  );

  const after = unwrap(
    await db.execute(
      sql`SELECT id, name, email, merged_into_user_id FROM users WHERE id IN (${CANONICAL_ID}, ${DUPLICATE_ID})`,
    ),
  );
  console.log("\nAFTER");
  for (const u of after) {
    console.log(`  ${u.id}  ${String(u.name).padEnd(14)} merged_into=${u.merged_into_user_id ?? "—"}`);
  }
  console.log(`\nDone. Reverse with: UPDATE users SET merged_into_user_id = NULL WHERE id = ${DUPLICATE_ID};`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Merge failed:", e);
  process.exit(1);
});
