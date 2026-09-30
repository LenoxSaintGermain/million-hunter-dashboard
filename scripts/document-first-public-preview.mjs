/** Isolated public-copy UAT. No API, database, access requests or document processing. */
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { mkdtempSync } from "node:fs";
if (process.env.DATABASE_URL !== "") throw Error("Explicit empty DATABASE_URL required");
const root = path.resolve(import.meta.dirname, "..");
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {Route,Switch} from 'wouter';import Landing from '/src/pages/LandingPage.tsx';import Walkthrough from '/src/pages/HunterWalkthrough.tsx';import DemoTour from '/src/pages/DemoTour.tsx';import Brief from '/src/pages/InvestorBrief.tsx';import JimsFile from '/src/pages/JimsFile.tsx';import Pricing from '/src/pages/Pricing.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(<><p style={{padding:8,fontSize:12,borderBottom:'1px solid currentColor'}}>Local framing preview · illustrative demos · requests disabled · no document processing</p><Switch><Route path='/' component={Landing}/><Route path='/walkthrough' component={Walkthrough}/><Route path='/demo-tour' component={DemoTour}/><Route path='/brief' component={Brief}/><Route path='/jims-file' component={JimsFile}/><Route path='/pricing' component={Pricing}/><Route><main style={{padding:32}}>Preview only. Authentication and other application routes are not connected. <a href='/'>Return to the preview</a></main></Route></Switch></>);`;
const mock = `export const trpc={publicAccess:{requestAccess:{useMutation:opts=>({isPending:false,mutate:()=>opts.onError({message:'Preview only — no request sent.'})})}}};`;
const server = await createServer({configFile:false,root:path.join(root,"client"),envDir:path.join(root,"__absent_uat_environment__"),publicDir:false,cacheDir:mkdtempSync('/tmp/document-first-preview.'),plugins:[react(),tailwindcss(),{
  name:'document-first-preview',
  configureServer(app){app.middlewares.use(async(req,res,next)=>{if(req.url.includes('.') || req.url.startsWith('/@') || req.url.startsWith('/src/') || req.url.startsWith('/node_modules/'))return next();res.setHeader('Content-Type','text/html');res.end(await app.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Document-first positioning preview</title></head><body><div id="root"></div><script type="module" src="/src/__document-preview.tsx"></script></body></html>'));});},
  resolveId(id){if(id==='\0document-preview-trpc')return id;if(id==='/src/__document-preview.tsx')return '\0document-preview.tsx';},
  async load(id){if(id==='\0document-preview-trpc')return mock;if(id==='\0document-preview.tsx')return(await transformWithEsbuild(entry,'document-preview.tsx',{loader:'tsx',jsx:'transform'})).code;}
}],resolve:{alias:{'@/lib/trpc':'\0document-preview-trpc','@':path.join(root,'client/src'),'@shared':path.join(root,'shared')}},server:{host:'127.0.0.1',port:3137,strictPort:true,fs:{allow:[root]}}});
await server.listen();console.log('DOCUMENT_FIRST_PREVIEW http://127.0.0.1:3137/');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});
