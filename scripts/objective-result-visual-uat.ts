/** Zero-API visual fixture. Never mounted in the product router. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { parseStrategyDiscovery } from "../server/aperture/strategyDiscovery";
import { emptyMissionDraftValues } from "../shared/apertureMissionDraft";
import { ObjectiveDiscoveryResult, type ObjectiveDiscoverySnapshot } from "../client/src/components/aperture/ObjectiveDiscoveryResult";

if (process.env.DATABASE_URL !== "") throw new Error("Explicit empty DATABASE_URL required");
const root = path.resolve(import.meta.dirname, "..");
const at = Date.UTC(2026, 8, 10, 14);
const requestId = "11111111-1111-4111-8111-111111111111";
function fixture(failed: boolean): ObjectiveDiscoverySnapshot {
  const result = parseStrategyDiscovery({ schemaVersion: 1, searchScope: "broader_permitted_universe",
    reviewedUniverse: [], hypotheses: [], coverageGaps: ["Illustrative fixture: activity evidence is missing; not a live market search."] },
  { requestId, provider: "illustrative-visual-fixture", asOf: at, receivedAt: at,
    searchScope: "broader_permitted_universe", universePolicy: "cited_us_security_leads", permittedUniverse: [], citations: [], sources: [],
    providerState: { status: "available", failures: [] }, classifierState: { status: "available", failures: [] } });
  const receipt = { id: 1, jobId: 1, attempt: 1, createdAt: at, result,
    request: { schemaVersion: 1 as const, requestId, missionHash: "illustrative", searchScope: "broader_permitted_universe" as const,
      universePolicy: "cited_us_security_leads" as const, permittedUniverse: [], mission: "Illustrative excess-capital comparison.",
      holdingPeriods: ["swing" as const], instrumentPreference: "shares" as const } };
  return { decisionRunId: 1, decisionRevisionId: 1, sourceDraftVersion: 1,
    acceptedValues: emptyMissionDraftValues(), account: { id: 1, label: "Illustrative Paper account", isPaper: true, asOf: at },
    job: { state: failed ? "failed" : "complete", jobId: 1, updatedAt: at, canRetry: false,
      message: failed ? "Illustrative provider failure. Inspect the saved result before retrying." : "Analysis recorded." },
    receipt, latestAttempt: receipt, history: [{ id: 1, attempt: 1, createdAt: at, status: result.status }],
    usingPreviousResult: failed, mutations: { analysisStarted: false, allocationCreated: false, orderCreated: false } };
}
const app = await createServer({ configFile: false, envDir: path.join(root, "__absent_uat_environment__"),
  cacheDir: mkdtempSync("/tmp/aperture-result-vite."), optimizeDeps: { entries: [], noDiscovery: true },
  root: path.join(root, "client"), publicDir: false, plugins: [tailwindcss(), {
    name: "objective-result-visual-fixture",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__objective-result")) return next();
        const failed = new URL(req.url, "http://localhost").searchParams.get("state") === "failed";
        const html = renderToStaticMarkup(React.createElement(ObjectiveDiscoveryResult, {
          snapshot: fixture(failed), busy: false, onRefresh() {}, onRetry() {}, onStart() {},
        }));
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Illustrative research result UAT</title><link rel="stylesheet" href="/src/index.css?direct"></head><body><main class="aperture-editorial mx-auto max-w-3xl p-4"><h1 class="mb-4 text-base font-semibold">Illustrative layout fixture · no API or order actions</h1>${html}<p class="mt-4 text-sm">Static fixture: buttons are non-operational. Native evidence disclosures and keyboard navigation remain available.</p></main></body></html>`);
      });
    },
  }], server: { host: "127.0.0.1", port: 3113, strictPort: true, fs: { allow: [root] } } });
await app.listen();
console.log("OBJECTIVE_RESULT_VISUAL_UAT http://localhost:3113/__objective-result");
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, async () => { await app.close(); process.exit(0); });
