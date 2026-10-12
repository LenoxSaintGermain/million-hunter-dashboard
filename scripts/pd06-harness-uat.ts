/** Full DealDetail UAT. Fixed loopback/local SQL, synthetic legacy reads and
 * model responses. No product router import, dotenv, production DB or providers.
 * DATABASE_URL= NODE_ENV=development pnpm exec tsx scripts/pd06-harness-uat.ts
 */
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { initTRPC, TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { z } from "zod";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createDealEvidenceRouter } from "../server/routers/dealEvidenceRouter";
import { createPublicEvidenceRouter } from "../server/routers/publicEvidenceRouter";
import { createDealEvidenceRepository } from "../server/dealEvidenceRepository";
import { createDealEvidenceService } from "../server/dealEvidenceService";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { createEvidenceService, evidencePayloadHash } from "../server/evidenceService";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";
import type { TrpcContext } from "../server/_core/context";
import type { SecSubmissionsResult } from "../shared/secEvidence";
import type { EvidenceFinding } from "../shared/dealEvidence";
import { prepareCapitalUatFixture, createCapitalUatQueryAdapter } from "./pd06-capital-uat-fixture";
import { createCapitalEvidenceRouter } from "../server/aperture/capitalEvidenceRouter";
import { createCapitalEvidenceReader, createCapitalEvidenceBindingService } from "../server/aperture/capitalEvidenceRepository";

if (process.env.DATABASE_URL !== "" || process.env.NODE_ENV !== "development") throw new Error("Explicit isolated UAT environment required");
const { pool, db } = openEvidenceUatDatabase();
const counters = { queries: 0, mutations: 0, modelCalls: 0, blockedLegacyMutations: 0, blockedOutboundFetches: 0, paths: {} as Record<string, number>, unknownPaths: {} as Record<string, number> };
// A fail-closed backstop even if an unanticipated provider path is introduced.
globalThis.fetch = async () => { counters.blockedOutboundFetches++; throw new Error("External fetch disabled in synthetic UAT"); };
const scenarios = ["success", "failure", "stale", "missing", "contradictory"] as const;
const receiptRepo = createEvidenceRepository(async () => db);
const repo = createDealEvidenceRepository(async () => db);
const app = express();
const server = createServer(app);
const manifest: Record<string, { dealId: number; receiptId: string | null; cik: string; description: string; capital?: Awaited<ReturnType<typeof prepareCapitalUatFixture>> }> = {};
const capital = await prepareCapitalUatFixture({ pool, db });
// Protect the loopback harness against cross-site writes; no remote binding.
app.use((req, res, next) => {
  if (req.headers.host !== "127.0.0.1:3150" || (req.headers.origin && req.headers.origin !== "http://127.0.0.1:3150")) {
    res.status(403).send("Loopback UAT origin required"); return;
  }
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:3150; frame-src 'none'; object-src 'none'");
  next();
});

for (const [i, scenario] of scenarios.entries()) {
  const ownerId = 987653100 + i;
  const dealId = ownerId;
  const user = { id: ownerId, openId: `synthetic-full-deal-${scenario}`, name: "Synthetic UAT capital operator", email: null, role: "capital_operator" };
  const name = `Illustrative — composite deal, not a real customer · ${scenario}`;
  // Reserved local fixture rows only. Never overwrite a conflicting record.
  const [existing] = await pool.execute<any[]>("SELECT owner_user_id,name,is_synthetic FROM deals WHERE id=?", [dealId]);
  if (existing.length && (existing[0].owner_user_id !== ownerId || existing[0].name !== name || !existing[0].is_synthetic)) throw new Error("Reserved UAT deal conflict");
  if (!existing.length) await pool.execute("INSERT INTO deals (id,owner_user_id,name,description,isArchived,stage,is_synthetic) VALUES (?,?,?, ?,false,'new',true)",
    [dealId, ownerId, name, "Synthetic full-page UAT fixture. No verified financials or real investment recommendation."]);
  const sqlDeal = await repo.getDeal(ownerId, dealId);
  if (!sqlDeal) throw new Error("Synthetic deal readback failed");
  let receiptId: string | null = null;
  if (scenario !== "missing") {
    const retrievedAt = scenario === "stale" ? "2020-01-01T00:00:00.000Z" : "2026-10-12T00:00:00.000Z";
    const payload: SecSubmissionsResult = { status: "empty", sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json", retrievedAt,
      company: { cik: "0000000001", name: "Synthetic full-page issuer" }, filings: [], failureCode: null, message: "Synthetic UAT receipt; no SEC call." };
    const receipt = await receiptRepo.append({ ownerId, requestId: randomUUID(), subjectKey: "sec:CIK0000000001", provider: "sec-submissions", schemaVersion: 1,
      sourceUrl: payload.sourceUrl, status: payload.status, payload, payloadHash: evidencePayloadHash(payload), retrievedAt: new Date(retrievedAt),
      expiresAt: new Date(scenario === "stale" ? "2020-01-02T00:00:00Z" : "2099-01-01T00:00:00Z"), failureCode: null, message: payload.message });
    receiptId = receipt.id;
  }
  const description = scenario === "contradictory" ? "Legacy score 0.95 versus legacy committee 0.10; controlled evidence response 0.50. No state is reconciled automatically."
    : scenario === "missing" ? "No saved source receipt for this owner."
    : scenario === "stale" ? "Saved receipt expired in 2020; inspect the stale disclosure."
    : scenario === "failure" ? "Explicit analysis action throws a synthetic provider failure and persists it."
    : "Explicit analysis actions produce controlled successful responses.";
  manifest[scenario] = { dealId, receiptId, cik: "0000000001", description, ...(scenario === "success" ? { capital } : {}) };
  const service = createDealEvidenceService({ repository: repo, evidence: receiptRepo,
    resolveModels: async mode => mode === "ic" ? ["synthetic-one", "synthetic-two", "synthetic-three"] : ["synthetic-one"],
    engine: async (mode, snapshot, models) => {
      counters.modelCalls++;
      if (scenario === "failure") throw new Error("Synthetic provider failure");
      const citations = [{ citationId: snapshot.citations[0].id, quote: snapshot.citations[0].fact }];
      const insights: EvidenceFinding[] = [{ id: "I1", kind: "interpretation",
        interpretation: "Synthetic UAT interpretation: this receipt does not establish financial performance.",
        rationale: "The cited receipt reports filing metadata coverage, not financial statements or verified operating results.",
        uncertainty: "Synthetic fixture only. Missing financial evidence is not evidence of poor performance or an all-clear.",
        criterion: "financial_verification", action: "inspect_documents", citations },
      { id: "I2", kind: "hypothesis",
        interpretation: "Synthetic UAT diligence question: confirm that the selected issuer receipt is relevant to this deal.",
        rationale: "The citation identifies the metadata issuer, while the deal relationship remains owner-confirmed.",
        uncertainty: "No independent entity-match verification was performed; no mismatch is asserted.",
        criterion: "entity_identity", action: "inspect_evidence", citations }];
      return mode === "red_team" ? { outputVersion: 2, insights, killProbability: 0.5, redFlags: ["Synthetic hypothesis only; financial evidence missing."], summary: "Controlled UAT response, not a live assessment.", citations }
        : { outputVersion: 2, scores: models.map(model => ({ model, score: 0.5, rationale: "Synthetic fixture, no model provider ran.", citations, insights })),
          consensusScore: 0.5, divergenceScore: 0, divergenceFlag: false, summary: "Controlled synthetic committee response." };
    } });
  // Only these legacy reads exist. All legacy mutations explicitly fail closed.
  const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });
  const read = (value: unknown) => t.procedure.input(z.unknown().optional()).query(() => structuredClone(value));
  const blocked = t.procedure.input(z.unknown().optional()).mutation(() => {
    counters.blockedLegacyMutations++;
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Synthetic UAT: legacy mutations and providers are disabled. Use the evidence desk." });
  });
  const consensus = scenario === "contradictory" ? { consensusScore: 0.1, divergenceScore: 0, divergenceFlag: false,
    model1Name: "Synthetic legacy A", model1Score: 0.1, model1Rationale: "Frozen contradictory legacy fixture.",
    model2Name: "Synthetic legacy B", model2Score: 0.1, model2Rationale: "Frozen contradictory legacy fixture.",
    model3Name: "Synthetic legacy C", model3Score: 0.1, model3Rationale: "Frozen contradictory legacy fixture.", summary: "Synthetic historical panel disagrees with the 0.95 legacy score." } : null;
  const uatRouter = t.router({
    aperture: t.router({
      account: t.router({ list: read([]), sync: blocked }),
      cockpit: t.procedure.input(z.unknown().optional()).query(() => {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Synthetic UAT: account limits and broker snapshots are deliberately unavailable. No risk authority is implied." });
      }),
      cockpitPreference: t.router({ get: read({ expanded: false }), set: blocked }),
      desk: t.router({ summary: read(null) }),
      capitalEvidence: createCapitalEvidenceRouter(createCapitalEvidenceReader({ database: async () => db }), createCapitalEvidenceBindingService({ database: async () => db })),
      run: t.router({ get: t.procedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => createCapitalUatQueryAdapter(db, ownerId)(input.id)),
        retry: blocked, followUp: blocked, evidence: t.router({ factDraft: read({ available: false }), refreshFinancialFacts: blocked, review: blocked, batchClearStandardGates: blocked }) }),
      macro: t.router({ refresh: blocked }), generateMemo: blocked,
    }),
    dealEvidence: createDealEvidenceRouter(service),
    publicEvidence: createPublicEvidenceRouter(createEvidenceService({ repository: receiptRepo, enabled: () => false })),
    auth: t.router({ me: read(user), logout: blocked }),
    // Product demo guard would disable the very workflow under test. SQL remains
    // synthetic; only this explicitly labeled harness read exercises active mode.
    deals: t.router({
      list: t.procedure.input(z.object({ limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().nonnegative().optional() }).optional())
        .query(({ ctx, input }) => ctx.user?.id === sqlDeal.ownerUserId
          ? [structuredClone(sqlDeal)].slice(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 100)) : []),
      getById: read({ deal: { ...sqlDeal, isSynthetic: false, score: scenario === "contradictory" ? 0.95 : null }, signal: null, memo: null }), score: blocked }),
    agents: t.router({ getTrajectory: read([]), getConsensusScore: read(consensus), getSellerSimulation: read(null), getRuns: read([]),
      runPipeline: blocked, consensusScore: blocked, sellerSimulation: blocked, runDealArchitect: blocked, runRedTeam: blocked, runRemediation: blocked }),
    agent: t.router({ getLatestRuns: read([]), triggerRun: blocked }),
    research: t.router({ getForDeal: read(null), refreshForDeal: blocked }),
    dealDocument: t.router({ listDossiers: read([]), getDossier: read(null), createDossier: blocked, uploadDocument: blocked,
      confirmProposal: blocked, revokeFact: blocked, reviewMandate: blocked, evaluate: blocked, deleteDocument: blocked }),
    outreach: t.router({ getByDealId: read([]), create: blocked, updateStatus: blocked }),
    signals: t.router({ analyze: blocked }), memos: t.router({ generate: blocked }),
    dealShare: t.router({ createToken: blocked }), loi: t.router({ generate: blocked }),
    investor: t.router({ getDnaStatus: read(null) }), publicDeals: t.router({ search: read({ deals: [], total: 0 }) }),
  });
  app.use(`/api/trpc/${scenario}`, (req, _res, next) => {
    for (const procedure of req.path.slice(1).split(",")) {
      const key = `${scenario}:${req.method}:${procedure}`;
      counters.paths[key] = (counters.paths[key] ?? 0) + 1;
      if (req.method === "POST") counters.mutations++; else counters.queries++;
    }
    next();
  }, createExpressMiddleware({ router: uatRouter, createContext: ({ req, res }) => ({ req, res, user: user as any }),
    onError: ({ error, path: procedure }) => {
      if (error.code === "NOT_FOUND") {
        const key = `${scenario}:${procedure ?? "unknown"}`;
        counters.unknownPaths[key] = (counters.unknownPaths[key] ?? 0) + 1;
      }
    } }));
}
app.get("/__uat/state", (_req, res) => res.json({ synthetic: true, manifest, counters }));
app.use("/api", (_req, res) => res.status(404).json({ error: "Unconfigured synthetic endpoint; no product fallback" }));
const root = path.resolve(import.meta.dirname, "..");
const vite = await createViteServer({ configFile: false, envFile: false, root, plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.join(root, "client/src"), "@shared": path.join(root, "shared"), "@assets": path.join(root, "attached_assets") } },
  server: { middlewareMode: true, hmr: { server }, fs: { strict: true, deny: ["**/.*"] } }, appType: "custom" });
app.use(vite.middlewares);
app.get("*", async (req, res, next) => { try {
  res.type("html").send(await vite.transformIndexHtml(req.originalUrl, `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Synthetic full DealDetail UAT</title></head><body><div id="root"></div><script type="module" src="/scripts/pd06-harness-uat-client.tsx"></script></body></html>`));
} catch (error) { next(error); } });
server.listen(3150, "127.0.0.1", () => console.log("Synthetic full DealDetail UAT http://127.0.0.1:3150 — counters /__uat/state; zero live providers"));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, async () => { await vite.close(); await pool.end(); server.close(); process.exit(0); });
