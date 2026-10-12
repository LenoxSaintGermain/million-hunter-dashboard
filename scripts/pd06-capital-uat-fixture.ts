/** Local projection tables/fixtures only, NOT a production migration verifier.
 * Existing tables/rows are never dropped, altered, or overwritten. New tables
 * retain column types and indexes, but allow null/default-free projection fields.
 * Run standalone to prepare without restarting the interactive harness.
 */
import { pathToFileURL } from "node:url";
import { randomInt, createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/mysql-core";
import * as schema from "../drizzle/schema";
import { parsePersistedJson } from "../shared/persistedJson";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";

export async function prepareCapitalUatFixture(connection: ReturnType<typeof openEvidenceUatDatabase>, ownerId = 987653100) {
  if (process.env.DATABASE_URL !== "" || process.env.NODE_ENV !== "development") throw new Error("Local UAT only");
  const { pool, db } = connection;
  const [[identity]] = await pool.query<any[]>("SELECT DATABASE() AS name");
  if (identity.name !== "signal_evidence_uat") throw new Error("Wrong database");
  const tables = [schema.thesisCompilations, schema.capitalTheses, schema.portfolioAccounts, schema.securities,
    schema.apertureRuns, schema.apertureCandidates, schema.apertureDecisionRuns, schema.apertureDecisionRevisions,
    schema.aperturePendingOutcomes, schema.brokerOrders];
  const quote = (value: string) => { if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new Error("Invalid schema identifier"); return `\`${value}\``; };
  for (const table of tables) {
    const config = getTableConfig(table);
    const [exists] = await pool.execute<any[]>("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [config.name]);
    if (exists.length) continue;
    const definitions = config.columns.map(column => `${quote(column.name)} ${column.getSQLType()} ${column.primary ? "NOT NULL AUTO_INCREMENT PRIMARY KEY" : "NULL"}${column.isUnique ? " UNIQUE" : ""}`);
    for (const idx of config.indexes) {
      const { name, unique, columns } = idx.config;
      definitions.push(`${unique ? "UNIQUE " : ""}KEY ${quote(name)} (${columns.map(c => quote((c as { name: string }).name)).join(",")})`);
    }
    await pool.query(`CREATE TABLE ${quote(config.name)} (${definitions.join(",")}) ENGINE=InnoDB`);
  }
  // Fresh fixture identity on every preparation. No pre-bound context and no
  // reuse of another test's decision head; all source analysis remains separate.
  const id = randomInt(100_000_000, 800_000_000);
  const now = Date.now();
  const symbol = `UAT${id}`;
  const mission = "Synthetic UAT: inspect source-supported research, never authorize a trade.";
  await db.transaction(async tx => {
    await tx.insert(schema.thesisCompilations).values({ id, userId: ownerId, name: "Synthetic evidence-binding thesis", thesisText: mission,
      templateUsed: "capital_trade", status: "approved", createdAt: new Date(now), updatedAt: new Date(now) });
    await tx.insert(schema.capitalTheses).values({ id, userId: ownerId, name: "Synthetic evidence-binding thesis", rawText: mission, sourceCompilationId: id,
      graph: { beliefs: ["Synthetic issuer claims require source review."], seek: ["Source-supported research"], avoid: ["Unverified inference treated as fact"],
        evidenceRequirements: ["Inspect financial documents before drawing financial conclusions"], invalidationConditions: ["Issuer identity cannot be confirmed"] },
      status: "active", createdAt: now, updatedAt: now });
    await tx.insert(schema.portfolioAccounts).values({ id, userId: ownerId, label: "Synthetic manual UAT — not a broker account", brokerId: "manual", isPaper: true,
      cashCents: 0, buyingPowerCents: 0, createdAt: now, updatedAt: now });
    await tx.insert(schema.securities).values({ id, symbol, name: "Synthetic issuer — not a tradable security", cik: "0000000001", assetType: "equity", createdAt: now, updatedAt: now });
    await tx.insert(schema.apertureRuns).values({ id, userId: ownerId, thesisId: id, accountId: id, deployableCapitalCents: 0, status: "completed",
      candidateCount: 1, universeCount: 1, providerAvailability: {}, droppedNote: "Synthetic fixture; no market research or providers ran.", createdAt: now, completedAt: now });
    await tx.insert(schema.apertureCandidates).values({ id, runId: id, symbol, role: "core", verifyFields: [], memoStatus: "skipped", createdAt: now });
    await tx.insert(schema.apertureDecisionRuns).values({ id, userId: ownerId, contextKind: "thesis", canonicalThesisId: id, capitalThesisId: id, accountId: id,
      researchRunId: id, currentRevisionId: id, lifecycle: "researching", lockVersion: 0, createdAt: now, updatedAt: now });
    await tx.insert(schema.apertureDecisionRevisions).values({ id, decisionRunId: id, version: 1, missionText: mission,
      missionHash: createHash("sha256").update(mission).digest("hex"), missionSource: "assigned", effectiveBranch: "research",
      contextSnapshot: { contextKind: "thesis", canonicalThesisId: id, capitalThesisId: id, accountId: id },
      gateSnapshot: { mandateVersion: "synthetic-uat", paperOnly: true, humanApprovalRequired: true },
      rankingSnapshot: {}, createdByUserId: ownerId, createdAt: now });
  });
  return { ownerId, runId: id, candidateId: id, decisionRunId: id, revisionId: id, securityId: id, symbol };
}

/** Actual local head is reread on every query so a writer's new revision is visible. */
export function createCapitalUatQueryAdapter(db: ReturnType<typeof openEvidenceUatDatabase>["db"], ownerId: number) {
  return async (id: number) => {
    const [run] = await db.select().from(schema.apertureRuns).where(and(eq(schema.apertureRuns.id, id), eq(schema.apertureRuns.userId, ownerId))).limit(1);
    if (!run) return null;
    const candidates = await db.select().from(schema.apertureCandidates).where(eq(schema.apertureCandidates.runId, id));
    const [decision] = await db.select().from(schema.apertureDecisionRuns).where(and(eq(schema.apertureDecisionRuns.researchRunId, id), eq(schema.apertureDecisionRuns.userId, ownerId))).limit(1);
    const [revision] = decision?.currentRevisionId ? await db.select().from(schema.apertureDecisionRevisions).where(eq(schema.apertureDecisionRevisions.id, decision.currentRevisionId)).limit(1) : [];
    return { run, candidates: candidates.map(c => ({ ...c, verifyFields: parsePersistedJson(c.verifyFields) ?? [], citations: parsePersistedJson(c.citations) ?? [] })),
      decisionAuthority: decision && revision ? { decisionRunId: decision.id, revisionId: revision.id, branch: revision.effectiveBranch, blocker: revision.blocker } : null,
      stale: false, macroFacts: [], brief: null, thesisContext: null, evidenceReviews: [], setAside: [], setAsideNote: "Synthetic local fixture",
      paperContext: { positions: [] } };
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const connection = openEvidenceUatDatabase();
  try { console.log(JSON.stringify({ synthetic: true, bound: false, ...await prepareCapitalUatFixture(connection) })); }
  finally { await connection.pool.end(); }
}
