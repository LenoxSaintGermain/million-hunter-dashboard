/** Local browser UAT: actual router, repository and SEC adapter; isolated DB.
 * Never deployed. Identity is conspicuously illustrative, not production auth.
 */
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { router, publicProcedure } from "../server/_core/trpc";
import { createPublicIntelligenceRouter } from "../server/routers/publicIntelligenceRouter";
import { createPublicEvidenceRouter } from "../server/routers/publicEvidenceRouter";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { createEvidenceService } from "../server/evidenceService";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";
import { fetchSecSubmissions } from "../server/secSubmissions";

const { pool, db } = openEvidenceUatDatabase();
const repository = createEvidenceRepository(async () => db);
const injectFailure = process.env.SEC_UAT_PROVIDER_FAILURE === "true";
const user = { id: 987654321, openId: "illustrative-sec-uat", name: "Illustrative SEC UAT", email: null,
  role: "user", onboardingCompleted: true, defaultWorkspace: "acquisition" };
const uatRouter = router({
  publicIntelligence: createPublicIntelligenceRouter(
    { reserve: () => repository.reserveSecProviderBudget(), cooldown: until => repository.setSecCooldown(until) },
    { reserve: provider => repository.reserveFeedProvider(provider) }, ownerId => repository.reserveFeedCaller(ownerId)),
  publicEvidence: createPublicEvidenceRouter(createEvidenceService({ repository, fetch: injectFailure
    ? async cik => ({ status: "unavailable", sourceUrl: `https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`,
      retrievedAt: null, company: null, filings: [], failureCode: "TIMEOUT",
      message: "LOCAL UAT: deliberately injected provider timeout; no SEC request made by this capture." })
    : fetchSecSubmissions })),
  auth: router({ me: publicProcedure.query(() => user) }),
  user: router({ onboardingStatus: publicProcedure.query(() => ({ completed: true, role: "user" })) }),
});
const app = express(); const server = createServer(app);
let apiRequests = 0;
app.get("/__uat/request-count", (_req, res) => res.json({ localUatOnly: true, apiRequests }));
app.use("/api", (_req, _res, next) => { apiRequests += 1; next(); });
app.use("/api/trpc", createExpressMiddleware({ router: uatRouter,
  createContext: ({ req, res }) => ({ req, res, user: user as any }) }));
const root = path.resolve(import.meta.dirname, "..");
const vite = await createViteServer({ configFile: false, envFile: false,
  plugins: [react(), tailwindcss()], root: path.join(root, "client"),
  resolve: { alias: { "@": path.join(root, "client/src"), "@shared": path.join(root, "shared"), "@assets": path.join(root, "attached_assets") } },
  server: { middlewareMode: true, hmr: { server }, fs: { strict: true, deny: ["**/.*"] } }, appType: "custom" });
app.use(vite.middlewares);
app.get("*", async (req, res, next) => {
  try {
    const html = await fs.readFile(path.join(root, "client/index.html"), "utf8");
    const label = '<body><aside style="padding:8px 16px;background:#0e1520;color:white;font:12px monospace">LOCAL UAT · illustrative identity · isolated database · real SEC captures · no orders</aside>';
    res.type("html").send(await vite.transformIndexHtml(req.originalUrl, html.replace("<body>", injectFailure ? label.replace("real SEC captures", "INJECTED provider failure") : label)));
  } catch (error) { next(error); }
});
server.listen(3148, "127.0.0.1", () => console.log("SEC evidence UAT: http://127.0.0.1:3148/public-intelligence"));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, async () => { await vite.close(); await pool.end(); server.close(); process.exit(0); });
