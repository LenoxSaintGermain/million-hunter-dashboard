/** Isolated interactive UAT. No dotenv, production DB, or live model calls. */
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { router } from "../server/_core/trpc";
import { createPublicEvidenceRouter } from "../server/routers/publicEvidenceRouter";
import { createDealEvidenceRouter } from "../server/routers/dealEvidenceRouter";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { createEvidenceService, evidencePayloadHash } from "../server/evidenceService";
import { createDealEvidenceRepository } from "../server/dealEvidenceRepository";
import { createDealEvidenceService } from "../server/dealEvidenceService";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";
import type { Deal } from "../drizzle/schema";
import type { SecSubmissionsResult } from "../shared/secEvidence";
import type { DealEvidenceSnapshot, EvidenceAnalysisOutput, EvidenceFinding } from "../shared/dealEvidence";
import { ensurePd06UatDeal } from "./pd06-uat-deal";

const { pool, db } = openEvidenceUatDatabase();
const ownerId = 987654321;
const user = { id: ownerId, openId: "illustrative-pd06-uat", name: "Illustrative PD06 UAT", email: null, role: "user" };
const receiptRepository = createEvidenceRepository(async () => db);
const analysisRepository = createDealEvidenceRepository(async () => db);
const deal = { id: ownerId, ownerUserId: ownerId, name: "Illustrative SEC issuer", description: "Synthetic deal for interface acceptance only.", industry: null, location: null,
  revenue: null, cashFlow: null, askingPrice: null, multiple: null, employees: null, yearEstablished: null, isArchived: false } as Deal;
await ensurePd06UatDeal(pool, 987654321, deal.name, deal.description!);
const retrievedAt = "2026-10-11T12:00:00.000Z";
const payload: SecSubmissionsResult = { status: "ok", sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json", retrievedAt,
  company: { cik: "0000000001", name: "Illustrative SEC issuer" }, message: "Synthetic UAT fixture; no SEC request made.", failureCode: null,
  filings: [{ accessionNumber: "0000000001-26-000001", form: "10-K", filingDate: "2026-10-01", reportDate: "2026-06-30", primaryDocument: "illustrative.htm", url: "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/illustrative.htm" }] };
const receipt = await receiptRepository.append({ ownerId, requestId: "11111111-1111-4111-8111-111111111106", subjectKey: "sec:CIK0000000001", provider: "sec-submissions", schemaVersion: 1,
  sourceUrl: payload.sourceUrl, status: payload.status, payload, payloadHash: evidencePayloadHash(payload), retrievedAt: new Date(retrievedAt), expiresAt: new Date("2026-10-12T12:00:00Z"), message: payload.message, failureCode: null });
const engine = async (mode: "red_team" | "ic", snapshot: DealEvidenceSnapshot, models: string[]): Promise<EvidenceAnalysisOutput> => {
  if (process.env.PD06_UAT_FAILURE === "true") throw new Error("Injected UAT provider failure");
  const citations = [{ citationId: snapshot.citations[0].id, quote: snapshot.citations[0].fact }];
  const insights: EvidenceFinding[] = [{ id: "I1", kind: "hypothesis",
    interpretation: "Illustrative test response: financial diligence remains unresolved.",
    rationale: "The cited submissions metadata is not financial verification.",
    uncertainty: "Controlled UAT fixture; no live reviewer ran and no financial documents were reviewed.",
    criterion: "financial_verification", action: "inspect_documents", citations }];
  if (mode === "red_team") return { outputVersion: 2, insights, killProbability: 0.5, redFlags: ["Illustrative test response: financial evidence remains missing."], summary: "Controlled UAT response, not a model-generated investment assessment.", citations };
  return { outputVersion: 2, scores: models.map(model => ({ model, score: 0.5, rationale: "Controlled UAT response; no live reviewer ran.", citations, insights })), consensusScore: 0.5, divergenceScore: 0, divergenceFlag: false, summary: "Illustrative panel response for interface verification only." };
};
const service = createDealEvidenceService({ repository: analysisRepository, evidence: receiptRepository, engine,
  resolveModels: async mode => mode === "red_team" ? ["illustrative-red-team"] : ["illustrative-reviewer-1", "illustrative-reviewer-2", "illustrative-reviewer-3"] });
const uatRouter = router({ dealEvidence: createDealEvidenceRouter(service), publicEvidence: createPublicEvidenceRouter(createEvidenceService({ repository: receiptRepository, enabled: () => false })) });
const app = express(); const server = createServer(app);
app.use("/api/trpc", createExpressMiddleware({ router: uatRouter, createContext: ({ req, res }) => ({ req, res, user: user as any }) }));
const root = path.resolve(import.meta.dirname, "..");
const vite = await createViteServer({ configFile: false, envFile: false, plugins: [react(), tailwindcss()], root,
  resolve: { alias: { "@": path.join(root, "client/src"), "@shared": path.join(root, "shared"), "@assets": path.join(root, "attached_assets") } },
  server: { middlewareMode: true, hmr: { server }, fs: { strict: true, deny: ["**/.*"] } }, appType: "custom" });
app.use(vite.middlewares);
app.get("*", async (req, res, next) => { try {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><title>PD06 isolated UAT</title></head><body><p style="padding:12px;font:12px monospace;overflow-wrap:anywhere">SYNTHETIC TEST RECEIPT: ${receipt.id} · CIK 0000000001</p><div id="root"></div><script type="module" src="/scripts/pd06-uat-client.tsx"></script></body></html>`;
  res.type("html").send(await vite.transformIndexHtml(req.originalUrl, html));
} catch (error) { next(error); } });
server.listen(3149, "127.0.0.1", () => console.log("PD06 isolated UAT http://127.0.0.1:3149 — controlled v2 findings, no live model calls"));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, async () => { await vite.close(); await pool.end(); server.close(); process.exit(0); });
