/** Isolated visual test fixture. No API, account reads, research, or orders. */
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { mkdtempSync } from "node:fs";
if (process.env.DATABASE_URL !== "") throw Error("Explicit empty DATABASE_URL required");
const root = path.resolve(import.meta.dirname, "..");
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{MissionRiskPortrait,ThesisRiskComparison}from'/src/components/aperture/MandateRiskPortrait.tsx';import'/src/index.css';const theses=[{id:1,name:'Illustrative infrastructure demand',isPrimary:true,missionDefaults:{holdingPeriod:'position',maxPlannedLossCents:50000}},{id:2,name:'Illustrative rate reaction',missionDefaults:{holdingPeriod:'intraday',maxPlannedLossCents:15000}},{id:3,name:'Illustrative catalyst scenario',missionDefaults:{holdingPeriod:'catalyst_window',maxPlannedLossCents:null}},{id:4,name:'Illustrative paused mandate',missionDefaults:{holdingPeriod:null,maxPlannedLossCents:0}}];function Fixture(){const[review,setReview]=React.useState(null);return <main style={{maxWidth:1000,margin:'auto',padding:20}}><p>ILLUSTRATIVE FIXTURE · zero API · no orders</p><MissionRiskPortrait limitCents={50000} effectiveCents={12500}/><ThesisRiskComparison theses={theses} onReview={setReview}/>{review&&<p role="status">Fixture context {review} selected; no action taken.</p>}</main>}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const server = await createServer({configFile:false,root:path.join(root,"client"),envDir:mkdtempSync("/tmp/mandate-viz-env."),cacheDir:mkdtempSync("/tmp/mandate-viz-cache."),publicDir:false,
  plugins:[react(),tailwindcss(),{name:"mandate-risk-fixture",resolveId(id){if(id==="/__mandate-risk-entry")return "\0mandate-risk-entry";},async load(id){if(id==="\0mandate-risk-entry")return (await transformWithEsbuild(entry,"entry.tsx",{loader:"tsx",jsx:"automatic"})).code;},configureServer(app){app.middlewares.use(async(req,res,next)=>{if(req.url!=="/__mandate-risk")return next();res.setHeader("Content-Type","text/html");res.end(await app.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__mandate-risk-entry"></script></body></html>'));});}}],
  resolve:{alias:{"@":path.join(root,"client/src"),"@shared":path.join(root,"shared")}},server:{host:"127.0.0.1",port:3158,strictPort:true,fs:{allow:[root]}}});
await server.listen();
console.log("Isolated fixture: http://127.0.0.1:3158/__mandate-risk");
