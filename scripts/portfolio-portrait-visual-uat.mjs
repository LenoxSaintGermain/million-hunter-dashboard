/** Isolated component UAT. Fixtures only, no RPC or account mutations. */
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { mkdtempSync } from "node:fs";
if (process.env.DATABASE_URL !== "")
  throw Error("Explicit empty DATABASE_URL required");
const root = path.resolve(import.meta.dirname, "..");
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{PortfolioPortrait}from'/src/components/aperture/PortfolioPortrait.tsx';import'/src/index.css';const now=Date.now();createRoot(document.getElementById('root')).render(<main style={{maxWidth:1200,margin:'auto',padding:24}}><p style={{fontSize:12,marginBottom:24}}>ILLUSTRATIVE PORTFOLIO · synthetic holdings · zero API · no orders</p><PortfolioPortrait now={now} holdings={[{symbol:'NVDA',marketValueCents:1900000,priceAsOf:now-10800000},{symbol:'TLT',marketValueCents:1500000,priceAsOf:now-10800000},{symbol:'CSCO',marketValueCents:800000,priceAsOf:now-10800000},{symbol:'MGM',marketValueCents:400000,priceAsOf:now-10800000},{symbol:'DKNG',marketValueCents:300000,priceAsOf:now-10800000}]} loading={false} failed={false} account={{label:'Illustrative practice account',equityValueCents:9774300,cashCents:4874300,buyingPowerCents:34205573,lastSyncedAt:now-10800000,isPaper:true}} thesis="Infrastructure investment / illustrative lens" binding={{key:'single_name',label:'Single name',subject:'NVDA',usedCents:1900000,ceilingCents:1900000,remainingCents:0,usedPct:100,ceilingPct:20,basis:'measured',reason:null}}/><details className="portrait-machinery"><summary>Account controls, market clock & all constraints</summary><p>Production account controls remain available here. No controls are connected in this isolated preview.</p></details></main>);`;
const edition = `import {TodayAccountMargin,TodayOrderRows} from '/src/components/aperture/TodayExecutionSnapshot.tsx';
import {AttentionDecisionCard} from '/src/components/aperture/AttentionDecisionCard.tsx';
import '/src/styles/hunter-harness.css';
import '/src/styles/capital-today-edition.css';
function Edition(){const [notice,setNotice]=React.useState('');const orders=['SAMPLE-A','SAMPLE-B','SAMPLE-C'].map((symbol,i)=>({id:i+1,accountId:1,accountLabel:'Illustrative paper',symbol,instrumentType:'equity',status:'filled',qty:10,filledQty:10,plannedRiskCents:5000,latestMark:{qty:10,avgCostCents:10000,lastPriceCents:[9600,10300,9800][i],marketValueCents:[96000,103000,98000][i],priceAsOf:now-10800000,priceSource:'Synthetic fixture'}}));const data={account:{id:1,label:'Illustrative paper',cashCents:4874300,buyingPowerCents:34205573,lastSyncedAt:now-10800000,syncSource:'Synthetic fixture'},orders};const open=()=>setNotice('Illustrative review opened. No evidence refreshed, approval recorded or order created.');return <section className="capital-briefing"><header><p className="capital-edition-kicker">The decision desk / Today</p><h1>What needs your judgment.</h1><p>Illustrative paper account · frozen sample</p></header><div className="capital-briefing-spread"><div className="capital-lead-story"><AttentionDecisionCard prominent item={{key:'example',kind:'evidence_missing',priority:1,critical:true,title:'The price moved. The thesis needs a second look.',stateLabel:'Evidence review required',reason:'A saved price is below its recorded cost. That alone does not establish whether the demand thesis still holds.',consequence:'Inspect the missing evidence before preparing a paper proposal.',actionLabel:'Inspect the thesis gap',href:'#sample-review',updatedAt:now}} onOpen={open}/>{notice&&<p role="status" style={{padding:28}}>{notice}</p>}</div><aside className="capital-account-strip"><p className="capital-edition-kicker">The margin / Order-linked exposure</p><TodayAccountMargin data={data} loading={false} failed={false} now={now}/></aside></div><section className="capital-motion"><h2 style={{padding:'12px 28px',fontFamily:'var(--font-display)',fontSize:26}}>The position stories.</h2><TodayOrderRows items={orders.map(o=>({key:'order:'+o.id,symbol:o.symbol,stateLabel:'Open sample position',detail:'Ten synthetic shares',href:'#sample-review',updatedAt:now}))} data={data} fingerprints={new Map()} changedKeys={new Set(['order:1'])} onOpen={open} now={now}/></section></section>}
`;
const previewEntry = edition + entry.replace('</details></main>', '</details><Edition/></main>');
const server = await createServer({
  configFile: false,
  root: path.join(root, "client"),
  envDir: mkdtempSync("/tmp/portrait-env."),
  publicDir: false,
  cacheDir: mkdtempSync("/tmp/portrait-cache."),
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "portrait-preview",
      configureServer(app) {
        app.middlewares.use(async (req, res, next) => {
          if (req.url !== "/__portfolio-portrait") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await app.transformIndexHtml(
              req.url,
              '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio portrait preview</title></head><body><div id="root"></div><script type="module" src="/src/__portrait.tsx"></script></body></html>'
            )
          );
        });
      },
      resolveId(id) {
        if (id === "/src/__portrait.tsx") return "\0portrait.tsx";
      },
      async load(id) {
        if (id === "\0portrait.tsx")
          return (
            await transformWithEsbuild(previewEntry, "portrait.tsx", {
              loader: "tsx",
              jsx: "transform",
            })
          ).code;
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.join(root, "client/src"),
      "@shared": path.join(root, "shared"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3135,
    strictPort: true,
    fs: { allow: [root] },
  },
});
await server.listen();
console.log(
  "PORTFOLIO_PORTRAIT_READY http://127.0.0.1:3135/__portfolio-portrait"
);
