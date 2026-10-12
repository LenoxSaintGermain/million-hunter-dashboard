/** Opt-in live model verification using an existing real SEC capture in the
 * isolated UAT database. No production deal or decision is touched. */
import { randomUUID } from "node:crypto";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { createDealEvidenceRepository } from "../server/dealEvidenceRepository";
import { createDealEvidenceService } from "../server/dealEvidenceService";
import type { Deal } from "../drizzle/schema";
import { ensurePd06UatDeal } from "./pd06-uat-deal";
import { executeEvidenceEngine } from "../server/dealEvidenceEngine";

if (!process.argv.includes("--live")) throw new Error("Explicit --live required; this calls configured analysis providers.");
const { pool, db } = openEvidenceUatDatabase();
try {
  const ownerId = 987654321;
  const evidence = createEvidenceRepository(async () => db);
  const candidates = await evidence.list(ownerId, "sec:CIK0000320193");
  const receipt = candidates.find(row => row.status === "ok" && row.payload.company?.name === "Apple Inc.");
  if (!receipt) throw new Error("Real saved Apple SEC capture absent in isolated UAT database. No synthetic source substituted.");
  const deal = { id: 987654320, ownerUserId: ownerId, name: "Apple Inc.", description: "LOCAL UAT ONLY: issuer identity used to test evidence plumbing. This is not an acquisition opportunity or investment recommendation; no seller financials supplied.",
    industry: null, location: null, revenue: null, cashFlow: null, askingPrice: null, multiple: null, employees: null, yearEstablished: null, isArchived: false } as Deal;
  const repository = createDealEvidenceRepository(async () => db);
  await ensurePd06UatDeal(pool, 987654320, deal.name, deal.description!);
  const service = createDealEvidenceService({ evidence, repository, engine: async (...args) => {
    try { return await executeEvidenceEngine(...args); }
    catch (error) {
      // Only this application-generated panel summary is safe to print. Never
      // print raw provider responses, request headers, or credential errors.
      const message = error instanceof Error ? error.message : "";
      console.log(JSON.stringify({ mode: args[0], diagnostic: /^Consensus panel unavailable; no score was recorded \([a-zA-Z0-9., _-]+\)$/.test(message) ? message : "Provider execution failed; raw error withheld." }));
      throw error;
    }
  } });
  const attachment = await service.attach(ownerId, { dealId: deal.id, receiptId: receipt.id, requestId: randomUUID(), confirmedCik: "0000320193", relation: "same_legal_entity", confirmed: true });
  for (const mode of ["red_team", "ic"] as const) {
    if (process.argv.includes("--ic-only") && mode !== "ic") continue;
    const input = { dealId: deal.id, requestId: randomUUID(), attachmentIds: [attachment.id] };
    const run = await (mode === "red_team" ? service.runRedTeam(ownerId, input) : service.runIC(ownerId, input));
    const readBack = await service.getRun(ownerId, { dealId: deal.id, id: run.id });
    console.log(JSON.stringify({ mode, status: run.status, runId: run.id, receiptId: receipt.id, sourceRetrievedAt: receipt.retrievedAt,
      models: run.models, failureCode: run.failureCode, message: run.message, persistedReadBack: readBack.id === run.id && readBack.status === run.status,
      context: "Isolated UAT deal identity, real saved SEC metadata, live analysis providers; not investment advice or production data." }));
    if (run.status !== "complete") process.exitCode = 1;
  }
} finally { await pool.end(); }
