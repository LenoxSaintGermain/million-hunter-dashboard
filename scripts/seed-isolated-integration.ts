/** Current schema plus hash-checked legacy SQL receipts, in the disposable DB only. */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { generateMySQLDrizzleJson, generateMySQLMigration } from "drizzle-kit/api";
import * as schema from "../drizzle/schema";
import { requireIsolatedIntegrationDatabase } from "./isolated-integration-identity.mjs";

requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
const db = await mysql.createConnection(process.env.DATABASE_URL!);
function archivedQuery(file: string, sha256: string): string {
  // Deliberately ignore the historical command/connection and result fields.
  const { query } = JSON.parse(readFileSync(file, "utf8"));
  if (typeof query !== "string" || createHash("sha256").update(query).digest("hex") !== sha256) {
    throw new Error(`Legacy SQL source differs from reviewed receipt: ${file}`);
  }
  console.log(JSON.stringify({ phase: "archived-fixture-authority", file, querySha256: sha256, historicalOnly: true }));
  return query;
}
try {
  const [visibleBrowserDatabases] = await db.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'capital_aperture_uat_9c18799'");
  if ((visibleBrowserDatabases as unknown[]).length) throw new Error("Scoped worker account can see the browser database; refusing tests.");
  const [jsonProbe, jsonFields] = await db.query<any[]>("SELECT JSON_ARRAY('bizbuysell', 'dealstream') AS sources");
  console.log(JSON.stringify({ phase: "driver-json-probe", isArray: Array.isArray(jsonProbe[0].sources), driverValueType: typeof jsonProbe[0].sources, wireColumnType: jsonFields[0].columnType }));
  const [tables] = await db.query("SHOW TABLES");
  if ((tables as unknown[]).length) throw new Error("Refusing schema setup on a nonempty database.");
  const empty = await generateMySQLDrizzleJson({});
  const current = await generateMySQLDrizzleJson(schema, empty.id);
  const statements = await generateMySQLMigration(empty, current);
  for (const statement of statements) await db.query(statement);
  console.log(JSON.stringify({ phase: "schema", tables: Object.keys(current.tables).length, statements: statements.length, source: "drizzle/schema.ts", copiedBrowserRows: 0 }));
  // Exercise the real source seed helper; do not invent missing legacy STACK
  // seed rows to satisfy its six-signal assertion. These existing seeds are
  // illustrative test data, not verified current market information.
  const { seedMacroSignals } = await import("../server/db");
  const seeded = await seedMacroSignals();
  console.log(JSON.stringify({ phase: "seed", source: "server/db.ts:seedMacroSignals", illustrativeOnly: true, ...seeded }));
  // These are exact historical deployment SQL payloads, not guessed tables or
  // new market assertions. The archived macro rows are fixture history only;
  // nothing here validates their factual claims, URLs, rates, or current law.
  // STACK tables now come from the verified source schema; don't mask missing
  // mappings by replaying CREATE TABLE IF NOT EXISTS over this fresh database.
  archivedQuery(".manus/db/db-query-1778509049216.json", "7bad35933f0ad1fbd7801ea7ee4006637439bde7d713bb4c1d9bf4b0c6d1e6ed");
  await db.query(archivedQuery(".manus/db/db-query-1778509076639.json", "689e981585759bbd45637623b5b3f24f46788128ad3c4efdb2a87f29699507be"));
  await db.query(archivedQuery(".manus/db/db-query-1778508917973.json", "6e4cb1b05a163aa00b4076acd578bf604eb8b61e4fdc6d278ebe342efcf4f3b7"));
  await db.query(archivedQuery(".manus/db/db-query-1778508961210.json", "761c04d4f34d842fa0f784f83a8340291bf298a9314cd4aa2f4858a1a0b65972"));
  // Current deals are global: no owner column and public list/get routes.
  // The verified existing index is now mirrored in source schema. Assert its
  // fresh-schema presence; NEVER replay the archived DELETE or production DDL.
  const dealReceipt = archivedQuery(".manus/db/db-query-1774537071003.json", "88c531dd2d964619c74064123729749a4c2bd54e3131025d646fe3b9f8d9ebb8");
  const indexStatement = "ALTER TABLE deals ADD UNIQUE KEY uq_deals_name_source (name, source);";
  if (!dealReceipt.includes(indexStatement)) throw new Error("Reviewed deal index missing from historical receipt.");
  const [dealIndexes] = await db.query<any[]>("SHOW INDEX FROM deals WHERE Key_name = 'uq_deals_name_source'");
  if (dealIndexes.length !== 2 || dealIndexes.some(index => Number(index.Non_unique) !== 0) || dealIndexes.sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index)).map(index => index.Column_name).join(",") !== "name,source") throw new Error("Fresh source schema is missing the verified deal identity index.");
  console.log(JSON.stringify({ phase: "legacy-fixture-restored", stackTablesFromSourceSchema: 3, historicalTemplates: 7, additionalHistoricalSignals: 6, dealIndexFromSourceSchema: "uq_deals_name_source", destructiveReceiptStatementsReplayed: 0, productionDdl: false }));
  const [[seedCounts]] = await db.query<any[]>("SELECT COUNT(*) AS total, SUM(confidence_score >= 0.85) AS highConfidence FROM macro_signals WHERE archived = 0");
  console.log(JSON.stringify({ phase: "seed-readback", ...seedCounts }));
} finally {
  await db.end();
}
// getDb owns a pool without a close API. All awaited setup/readback is complete.
process.exit(0);
