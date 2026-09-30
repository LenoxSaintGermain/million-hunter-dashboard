/** Offline visual harness. Actual route components, inert RPCs, no production auth/data. */
import { createServer, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
if (process.env.DATABASE_URL !== '') throw Error('Explicit empty DATABASE_URL required');
const root = path.resolve(import.meta.dirname, '..');
const rpc = `import {CURATED_QUICK_HITS} from '@shared/../server/aperture/quickHitCatalog';
const none=()=>{throw Error('Mutation blocked in offline visual UAT')};
const candidate={runId:1,candidateId:1,symbol:'DEMO',holdingPeriod:'swing',role:'Illustrative research',playSide:'long',checks:['Sample evidence'],reviews:{'Sample evidence':'confirmed'}};
function fixture(key,input){
 if(key==='thesis.list')return [];
 if(key==='aperture.account.list')return [{id:1,isPaper:true,label:'Illustrative paper account',buyingPowerCents:null}];
 if(key==='aperture.quickHit.catalog')return CURATED_QUICK_HITS;
 if(key==='aperture.play.ready')return {best:input?.horizon==='intraday'?null:candidate,alternatives:[],withheld:{unresolvedEvidence:2,declined:1},directionalMix:null};
 if(key==='aperture.quickPlay.list')return {items:[],session:'closed',withheld:2,disclosure:'Illustrative fixture. No current market or account data.'};
 return null;
}
const build=(keys=[])=>new Proxy(()=>{}, {get:(_,key)=>key==='useQuery'?(input)=>({data:fixture(keys.join('.'),input),isLoading:false,isFetching:false,isError:false,refetch:async()=>({data:fixture(keys.join('.'),input)})}):key==='useMutation'?()=>({mutate:none,mutateAsync:none,isPending:false,reset:()=>{}}):key==='useUtils'?()=>build():build([...keys,key])});
export const trpc=build();`;
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{useLocation}from'wouter';
import ThesisEngine from '/src/pages/ThesisEngine.tsx';import ApertureDeploy from '/src/pages/aperture/ApertureDeploy.tsx';import '/src/index.css';import '/src/styles/hunter-harness.css';
function App(){const[location,navigate]=useLocation();return <><div style={{padding:12,borderBottom:'1px solid',fontSize:12}}>OFFLINE VISUAL UAT · illustrative fixture · API mutations blocked <button style={{marginLeft:20}} onClick={()=>navigate('/thesis?scope=acquisition')}>Thesis</button><button style={{marginLeft:20}} onClick={()=>navigate('/aperture/deploy')}>Deployment</button></div>{location.includes('/thesis')?<ThesisEngine/>:<ApertureDeploy/>}</>};createRoot(document.getElementById('root')).render(<App/>);`;
const app = await createServer({configFile:false,root:path.join(root,'client'),envDir:mkdtempSync('/tmp/hunter-empty-env.'),publicDir:false,cacheDir:mkdtempSync('/tmp/hunter-thesis-vite.'),
 resolve:{alias:[{find:'@/lib/trpc',replacement:'virtual:uat-rpc'},{find:'@/_core/hooks/useAuth',replacement:'virtual:uat-auth'},{find:'@/components/EditorialTopNav',replacement:'virtual:uat-layout'},{find:'@/components/DashboardLayout',replacement:'virtual:uat-layout'},{find:'@',replacement:path.join(root,'client/src')},{find:'@shared',replacement:path.join(root,'shared')}]},
 plugins:[react(),tailwindcss(),{name:'thesis-uat',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(!['/thesis','/aperture/deploy'].includes(req.url?.split('?')[0]))return next();res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline thesis & deployment UAT</title></head><body><div id="root"></div><script type="module" src="/src/__thesis_uat.tsx"></script></body></html>'));});},
 resolveId(id){if(id.endsWith('/lib/trpc'))return '\0virtual:uat-rpc';if(id.startsWith('virtual:uat-'))return '\0'+id;if(id==='/src/__thesis_uat.tsx')return '\0thesis-uat.tsx';},
 async load(id){if(id==='\0virtual:uat-rpc')return rpc;if(id==='\0virtual:uat-auth')return 'export const useAuth=()=>({user:{role:"admin"},isAuthenticated:true,loading:false});';if(id==='\0virtual:uat-layout')return 'import React from "react";export default function Layout({children}){return React.createElement("main",{className:"hunter-workspace",style:{padding:"24px",minHeight:"100vh"}},children)}';if(id==='\0thesis-uat.tsx')return(await transformWithEsbuild(entry,'thesis-uat.tsx',{loader:'tsx',jsx:'transform'})).code;}
 }],server:{host:'127.0.0.1',port:3131,strictPort:true,fs:{allow:[root]}}});
await app.listen();console.log('OFFLINE_UAT_READY http://127.0.0.1:3131/thesis?scope=acquisition');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0)});
