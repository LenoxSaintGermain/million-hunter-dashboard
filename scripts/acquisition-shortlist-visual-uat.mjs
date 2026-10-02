/** Local, deterministic visual fixture. No API or database access. */
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { mkdtempSync } from "node:fs";
if (process.env.DATABASE_URL !== "") throw new Error("Explicit empty DATABASE_URL required");
const root = path.resolve(import.meta.dirname, "..");
const rows = ["Recurring revenue", "Operating history", "Owner transition", "Technology", "Staff retention", "Implementation cost"];
const data = { thesisId: 1, createdAt: Date.UTC(2026, 8, 27, 14), stale: false, items: ["Illustrative HVAC services", "Illustrative sheet-metal fabricator", "Illustrative plumbing company"].map((name, i) => ({ dealId: i + 1, name, assessmentFailed: false, comparison: { score: null, coveredWeight: 20, dimensions: rows.map((dimension, n) => ({ dimension, weight: [25,20,20,15,10,10][n], score: n === 1 ? 1 : null, contribution: n === 1 ? 20 : null, explanation: "Illustrative listing reports establishment in 1990; not independently verified.", evidence: n === 1 ? [{ quote: "Illustrative: established in 1990", sourceUrl: "https://example.org/illustrative-listing" }] : [] })) } })) };
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {AcquisitionThesisComparison} from '/src/components/AcquisitionThesisComparison.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(<main className="aperture-editorial mx-auto max-w-6xl p-4"><p className="mb-4 text-sm">Illustrative UAT · no API or order actions</p><AcquisitionThesisComparison jobId={1}/></main>);`;
const server = await createServer({ configFile: false, root: path.join(root, "client"), envDir: path.join(root, "__absent_uat_environment__"), publicDir: false, cacheDir: mkdtempSync("/tmp/shortlist-vite."),
  plugins: [react(), tailwindcss(), { name: "shortlist-fixture", configureServer(app) { app.middlewares.use(async (req, res, next) => {
    if (req.url !== "/__shortlist-uat") return next();
    res.setHeader("Content-Type", "text/html"); res.end(await app.transformIndexHtml(req.url, '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shortlist UAT</title></head><body><div id="root"></div><script type="module" src="/src/__shortlist-fixture.tsx"></script></body></html>'));
  }); }, resolveId(id) { if (id === "\0shortlist-trpc") return id; if (id === "/src/__shortlist-fixture.tsx") return "\0shortlist-fixture.tsx"; }, async load(id) {
    if (id === "\0shortlist-fixture.tsx") return (await transformWithEsbuild(entry, "shortlist-fixture.tsx", { loader: "tsx", jsx: "transform" })).code;
    if (id === "\0shortlist-trpc") return `export const trpc={scan:{getV2Report:{useQuery:()=>({data:[]})},getThesisComparison:{useQuery:()=>({data:${JSON.stringify(data)},refetch:()=>{throw Error('No API in fixture')}})}}};`;
  } }], resolve: { alias: { "@/lib/trpc": "\0shortlist-trpc", "@": path.join(root, "client/src"), "@shared": path.join(root, "shared") } }, server: { host: "127.0.0.1", port: 3116, strictPort: true, fs: { allow: [root] } } });
await server.listen(); console.log("SHORTLIST_UAT_READY http://localhost:3116/__shortlist-uat");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await server.close(); process.exit(0); });
