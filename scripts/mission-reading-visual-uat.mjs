/** Isolated presentation preview; no auth, RPC, database or orders. */
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { mkdtempSync } from "node:fs";
if (process.env.DATABASE_URL !== "")
  throw Error("Explicit empty DATABASE_URL required");
const root = path.resolve(import.meta.dirname, "..");
const sample =
  "Paper-only short-term thesis for Friday, August 28, 2026: research a long TLT share play only after the scheduled payroll revision at 10:00 a.m. ET. Do not predict the release and do not enter before 10:15. Evidence basis: Illustrative saved context, not current research. Historical figures and release dates must be checked again before this mission. All eligibility gates are required: the revision lowers the reported payroll level by at least 0.25%; the 10-year yield is at least 5 basis points below its 9:55 level; after 10:15 TLT is above VWAP and the 10:00–10:15 range high; and volume is at least 1.5 times normal. Use shares only, at most $5,000 notional and $50 maximum planned loss. Size from entry-to-stop distance plus slippage. Stop below the release-range low or 0.60% below entry, whichever is tighter. Preserve cash if evidence is missing, stale, contradictory, or the price gaps more than 0.75% past the qualifying range. Invalidate if the yield reclaims its 9:55 level or TLT loses VWAP twice. Close by 3:45 p.m. ET and record the outcome after the close. Desired ending value $5,075 is an aspiration, not a forecast.";
const entry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{MissionReadingBrief}from'/src/components/aperture/MissionReadingBrief.tsx';import'/src/index.css';function App(){const[text,setText]=useState(${JSON.stringify(sample)});const[edit,setEdit]=useState(false);return <main style={{maxWidth:1060,margin:'auto',padding:24}}><p style={{fontSize:12,marginBottom:24}}>ISOLATED UAT · illustrative wording · no research or orders</p><div className="mission-thesis-assignment"><div><p>Assigned thesis · saved wording unchanged</p><select aria-label="Assigned thesis"><option>TLT payroll confirmation / illustrative</option></select></div></div><button onClick={()=>setEdit(!edit)} style={{minHeight:44,textDecoration:'underline'}}>{edit?'Done editing':'Edit mission'}</button>{edit?<textarea aria-label="Mission research instruction" value={text} onChange={e=>setText(e.target.value)} style={{display:'block',width:'100%',minHeight:320,fontSize:15,lineHeight:1.8}}/>:<MissionReadingBrief title="TLT payroll confirmation" text={text} horizon="Today / by close" edited={text!==${JSON.stringify(sample)}}/>}</main>}createRoot(document.getElementById('root')).render(<App/>);`;
const server = await createServer({
  configFile: false,
  root: path.join(root, "client"),
  envDir: mkdtempSync("/tmp/mission-empty-env."),
  publicDir: false,
  cacheDir: mkdtempSync("/tmp/mission-reading."),
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "mission-reading-uat",
      configureServer(app) {
        app.middlewares.use(async (req, res, next) => {
          if (req.url != "/__mission-reading") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await app.transformIndexHtml(
              req.url,
              '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mission reading preview</title></head><body><div id="root"></div><script type="module" src="/src/__mission-reading.tsx"></script></body></html>'
            )
          );
        });
      },
      resolveId(id) {
        if (id === "/src/__mission-reading.tsx") return "\0mission-reading.tsx";
      },
      async load(id) {
        if (id === "\0mission-reading.tsx")
          return (
            await transformWithEsbuild(entry, "mission-reading.tsx", {
              loader: "tsx",
              jsx: "transform",
            })
          ).code;
      },
    },
  ],
  resolve: { alias: { "@": path.join(root, "client/src"), "@shared": path.join(root, "shared") } },
  server: {
    host: "127.0.0.1",
    port: 3134,
    strictPort: true,
    fs: { allow: [root] },
  },
});
await server.listen();
console.log("MISSION_READING_READY http://127.0.0.1:3134/__mission-reading");
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
