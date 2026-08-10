/**
 * Account reconciliation audit — the two "Jim" rows.
 *
 *   Jim Butler   gws@conciergecareerservices.com   id 7470015
 *   Jimmy Butler lifecalendarai@gmail.com          id 690001
 *
 * Confirmed to be the same person. Before either row is retired we need to know
 * which one actually owns data, because the loser's rows have to keep resolving
 * (investor_dna.user_id is UNIQUE — a naive merge throws) and because deleting a
 * user row is not reversible.
 *
 * ⚠️ THIS READS THE PRODUCTION DATABASE. It is deliberately SELECT-only: every
 * statement below is a COUNT. It writes nothing, creates nothing, drops nothing.
 * Run it from the repo root so `../server/...` resolves:
 *
 *     export PATH="/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH"
 *     npx tsx scripts/audit-jim-accounts.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

const JIMS = [
  { id: 7470015, name: "Jim Butler", email: "gws@conciergecareerservices.com" },
  { id: 690001, name: "Jimmy Butler", email: "lifecalendarai@gmail.com" },
];

/**
 * table.column → what value the column actually holds. This codebase links users
 * three different ways and getting it wrong would silently report zeros:
 *   "id"     — int users.id
 *   "openId" — varchar users.openId (freedom_goals, strategy_blueprints,
 *              investor_dossiers all use a varchar column confusingly named userId)
 *   "email"  — access_requests has no user FK at all, only an email
 * Tables with no user link whatsoever (memos, activity_log, agent_runs) are
 * omitted rather than counted as zero.
 */
type KeyKind = "id" | "openId" | "email";
const OWNERSHIP: Array<{ table: string; column: string; key: KeyKind }> = [
  { table: "investor_dna", column: "user_id", key: "id" },
  { table: "thesis_compilations", column: "user_id", key: "id" },
  { table: "thesis_variants", column: "owner_user_id", key: "id" },
  { table: "thesis_variants", column: "assigned_user_id", key: "id" },
  { table: "investor_interest", column: "user_id", key: "id" },
  { table: "commercial_assets", column: "assigned_user_id", key: "id" },
  { table: "deal_agent_runs", column: "triggered_by_user_id", key: "id" },
  { table: "invite_tokens", column: "created_by_user_id", key: "id" },
  { table: "invite_tokens", column: "consumed_by_user_id", key: "id" },
  { table: "ripple_favorites", column: "user_id", key: "id" },
  { table: "ripple_pipeline_jobs", column: "user_id", key: "id" },
  { table: "freedom_goals", column: "userId", key: "openId" },
  { table: "strategy_blueprints", column: "userId", key: "openId" },
  { table: "investor_dossiers", column: "userId", key: "openId" },
  { table: "access_requests", column: "email", key: "email" },
];

type Cell = number | "n/a";

function unwrap(rows: any): any[] {
  if (!Array.isArray(rows)) return rows ? [rows] : [];
  return Array.isArray(rows[0]) ? rows[0] : rows;
}

async function countRows(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  table: string,
  column: string,
  value: string | number | null,
): Promise<Cell> {
  if (value == null) return "n/a";
  try {
    const rows: any = await db.execute(
      sql`SELECT COUNT(*) AS n FROM \`${sql.raw(table)}\` WHERE \`${sql.raw(column)}\` = ${value}`,
    );
    const first = unwrap(rows)[0];
    return Number(first?.n ?? first?.["COUNT(*)"] ?? 0);
  } catch {
    // Table or column doesn't exist on this database — report it, don't crash.
    return "n/a";
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. This audit needs the real database to be useful.");
    process.exit(1);
  }
  const db = await getDb();
  if (!db) {
    console.error("Could not connect to the database.");
    process.exit(1);
  }

  console.log("Signal Hunter — Jim account audit (READ-ONLY)\n");

  // ── The user rows themselves ────────────────────────────────────────────────
  const ids = JIMS.map((j) => j.id);
  const userRows: any = await db.execute(
    sql`SELECT id, openId, name, email, role, onboarding_completed, createdAt, lastSignedIn
        FROM users WHERE id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`,
  );
  const users = unwrap(userRows);
  console.log("USER ROWS");
  if (!users.length) {
    console.log("  none of the expected ids were found — the ids may have changed.");
  }
  for (const u of users) {
    console.log(
      `  ${u.id}  ${String(u.name ?? "").padEnd(14)} ${String(u.email ?? "").padEnd(38)} ` +
        `role=${String(u.role).padEnd(9)} onboarded=${u.onboarding_completed} ` +
        `created=${u.createdAt} lastSignedIn=${u.lastSignedIn}`,
    );
    console.log(`${" ".repeat(11)}openId=${u.openId}`);
  }

  /** Resolve the value each key kind needs, from the live row where possible. */
  const keyFor = (jim: (typeof JIMS)[number], kind: KeyKind): string | number | null => {
    const row = users.find((u: any) => Number(u.id) === jim.id);
    if (kind === "id") return jim.id;
    if (kind === "openId") return row?.openId ?? null;
    return row?.email ?? jim.email;
  };

  // ── Owned rows per table/column ────────────────────────────────────────────
  console.log("\nOWNED ROWS");
  console.log(`  ${"table.column".padEnd(38)} ${JIMS.map((j) => String(j.id).padStart(9)).join("")}`);
  console.log(`  ${"-".repeat(38)} ${JIMS.map(() => "-".repeat(9)).join("")}`);

  const totals: Record<number, number> = Object.fromEntries(JIMS.map((j) => [j.id, 0]));

  for (const { table, column, key } of OWNERSHIP) {
    const counts: Cell[] = [];
    for (const jim of JIMS) {
      const n = await countRows(db, table, column, keyFor(jim, key));
      counts.push(n);
      if (typeof n === "number") totals[jim.id] += n;
    }
    const label = `${table}.${column}${key === "id" ? "" : ` (${key})`}`;
    const nonZero = counts.some((c) => typeof c === "number" && c > 0);
    const line = `  ${label.padEnd(38)} ${counts.map((c) => String(c).padStart(9)).join("")}`;
    console.log(nonZero ? `${line}  ←` : line);
  }

  console.log(`  ${"-".repeat(38)} ${JIMS.map(() => "-".repeat(9)).join("")}`);
  console.log(
    `  ${"TOTAL".padEnd(38)} ${JIMS.map((j) => String(totals[j.id]).padStart(9)).join("")}`,
  );

  // ── The recommendation, stated but NOT acted on ────────────────────────────
  const ranked = [...JIMS].sort((a, b) => totals[b.id] - totals[a.id]);
  const [win, lose] = ranked;
  console.log("\nREAD");
  if (totals[win.id] === totals[lose.id]) {
    console.log(
      `  Both rows own ${totals[win.id]} row(s) — the data does not pick a winner.\n` +
        `  Decide on activity instead (see lastSignedIn / onboarded above).`,
    );
  } else {
    console.log(
      `  ${win.name} (${win.id}) owns ${totals[win.id]} row(s); ` +
        `${lose.name} (${lose.id}) owns ${totals[lose.id]}.\n` +
        `  Canonical row would be ${win.id}; ${lose.id} would get merged_into_user_id = ${win.id}.`,
    );
  }
  console.log("\n  Nothing was written. No row was modified. Awaiting a decision.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
