/** Isolated UI fixture: no backend, no credentials, no research or orders. */
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { mkdtempSync } from "node:fs";
if (process.env.DATABASE_URL !== "") throw Error("Explicit empty DATABASE_URL required");
const root = path.resolve(import.meta.dirname, "..");
const modules = {
  entry: `import React from 'react';import{createRoot}from'react-dom/client';import Runs from '/src/pages/aperture/ApertureRuns.tsx';import Theses from '/src/pages/aperture/ApertureTheses.tsx';import '/src/index.css';function Preview(){return <><p style={{padding:16,fontSize:12}}>ILLUSTRATIVE UI FIXTURES · No API · No research or orders</p>{location.pathname.includes('theses')?<Theses/>:<Runs/>}</>}createRoot(document.getElementById('root')).render(<Preview/>);`,
  shell: `import React from 'react';export default function Shell({children}){return <main style={{padding:20,maxWidth:1160,margin:'auto'}}>{children}</main>}`,
  rpc: `const now=Date.now();const runs=['completed','researching','failed'].map((status,i)=>({id:i+1,thesisId:i+1,thesisName:['Illustrative infrastructure demand','Illustrative macro hedge','Illustrative consumer recovery'][i],status,createdAt:now-86400000,candidateCount:i===0?2:0,universeCount:8}));const theses=runs.map((r,i)=>({id:r.id,name:r.thesisName,sourceCompilationId:i===0?4:null,isPrimary:false,status:['active','review','archived'][i],rawText:'Illustrative saved argument. Evidence needs to establish whether durable demand supports the thesis; this fixture is not a recommendation.',updatedAt:now,missionDefaults:{maxPlannedLossCents:i===0?0:null},readDiagnostics:{confidenceNotes:{status:'unknown',code:'FIXTURE'}},confidenceNotes:[]}));const read=data=>({useQuery:()=>({data,isLoading:false,refetch:()=>{}})});export const trpc={useUtils:()=>({aperture:{invalidate:async()=>{}},thesis:{invalidate:async()=>{}}}),thesis:{activeCapital:read({thesis:{id:4,name:theses[0].name}})},aperture:{run:{list:read(runs)},runway:{pending:read([])},thesis:{list:read(theses),activate:{useMutation:()=>({isPending:false,mutate:()=>alert('Fixture only — no context changed')})}}}};`,
};
const server = await createServer({
  configFile: false, root: path.join(root, "client"),
  envDir: mkdtempSync("/tmp/research-library-env."),
  cacheDir: mkdtempSync("/tmp/research-library-cache."), publicDir: false,
  plugins: [react(), tailwindcss(), {
    name: "research-library-fixtures",
    enforce: "pre",
    resolveId(id) {
      if (id === "/__research-entry") return "\0entry";
      if (id === "@/lib/trpc" || id === path.join(root, "client/src/lib/trpc")) return "\0rpc";
      if (id === "@/components/DashboardLayout" || id === path.join(root, "client/src/components/DashboardLayout")) return "\0shell";
    },
    async load(id) { if (id.startsWith("\0") && modules[id.slice(1)]) return (await transformWithEsbuild(modules[id.slice(1)], id.slice(1)+".tsx", {loader:"tsx",jsx:"automatic"})).code; },
    configureServer(app) { app.middlewares.use(async (req,res,next) => {
      if (!req.url?.startsWith("/__research") && !req.url?.startsWith("/aperture/")) return next();
      if (req.url === "/__research-entry") return next();
      res.setHeader("Content-Type","text/html");
      res.end(await app.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__research-entry"></script></body></html>'));
    }); },
  }],
  resolve: { alias: { "@": path.join(root,"client/src"), "@shared": path.join(root,"shared") } },
  server: {host:"127.0.0.1",port:3147,strictPort:true,fs:{allow:[root]}},
});
await server.listen();
console.log("Fixture preview: http://127.0.0.1:3147/__research and /aperture/theses");
