/** Deterministic, disconnected opportunity report. All mutations fail closed. */
import { createServer, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
if (process.env.DATABASE_URL !== '') throw Error('Explicit empty DATABASE_URL required');
const root = path.resolve(import.meta.dirname, '..');
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import DealDetail from '/src/pages/DealDetail.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(<><p>Illustrative UAT — no APIs or saved changes</p><DealDetail/></>);`;
const data = {deal:{id:1,name:'Illustrative HVAC | $1.7M Revenue | Long listing title for responsive testing',industry:'HVAC',location:'Illustrative location',askingPrice:1770000,cashFlow:506000,revenue:1700000,score:0.732,stage:'new',isSynthetic:true,listingUrl:'https://example.org/illustrative',description:'Illustrative discovery record; not a real business.'},signal:null,memo:null};
const aliases = {'@/lib/trpc':'\0report-trpc','@/_core/hooks/useAuth':'\0report-auth','@/components/EditorialTopNav':'\0report-layout','@/components/CoPilot':'\0report-empty','@':path.join(root,'client/src'),'@shared':path.join(root,'shared')};
const server = await createServer({configFile:false,root:path.join(root,'client'),envDir:path.join(root,'__absent_uat_environment__'),publicDir:false,cacheDir:mkdtempSync('/tmp/report-vite.'),plugins:[react(),tailwindcss(),{name:'report-fixture',configureServer(app){app.middlewares.use(async(req,res,next)=>{if(req.url!=='/__report-uat')return next();res.setHeader('Content-Type','text/html');res.end(await app.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report UAT</title></head><body><div id="root"></div><script type="module" src="/src/__report-fixture.tsx"></script></body></html>'));});},resolveId(id){if(id.startsWith('\0report-'))return id;if(id==='/src/__report-fixture.tsx')return '\0report-entry';},async load(id){
if(id==='\0report-entry')return (await transformWithEsbuild(entry,'fixture.tsx',{loader:'tsx',jsx:'transform'})).code;
if(id==='\0report-layout')return 'export default function Layout({children}){return children}';
if(id==='\0report-auth')return 'export const useAuth=()=>({user:{id:1,role:"admin"},isAuthenticated:true});';
if(id==='\0report-empty')return 'export default function Empty(){return null}';
if(id==='\0report-trpc')return `const fail=()=>{throw Error('Mutations disabled in fixture')};export const trpc=new Proxy({}, {get:(_,ns)=>new Proxy({}, {get:(_,p)=>({useQuery:()=>({data:ns==='deals'&&p==='getById'?${JSON.stringify(data)}:undefined,isLoading:false,refetch:fail}),useMutation:()=>({mutate:fail,mutateAsync:fail,isPending:false})})})});`;
}}],resolve:{alias:aliases},server:{host:'127.0.0.1',port:3117,strictPort:true,fs:{allow:[root]}}});
await server.listen();console.log('REPORT_UAT_READY http://localhost:3117/__report-uat');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0)});
