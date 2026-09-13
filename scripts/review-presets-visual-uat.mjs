/** Offline interaction harness: real Today/review components, in-memory RPC stub. */
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { mkdtempSync } from "node:fs";
if (process.env.DATABASE_URL !== "") throw Error("Explicit empty DATABASE_URL required");
const root = path.resolve(import.meta.dirname, "..");
const mock = `import {useState,useSyncExternalStore} from 'react';
let state={receipts:[],attempts:[],failNext:false}; const listeners=new Set();
const update=(next)=>{state={...state,...next};for(const f of listeners)f()};
export const useFixture=()=>useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>state);
export const failNext=()=>update({failNext:true});
const matches=(a,b)=>['runId','candidateId','orderId','findingId','findingVersion'].every(k=>a[k]===b[k]);
function useList(target){const value=useFixture();return {data:{receipts:value.receipts.filter(r=>matches(r,target))},refetch:async()=>({data:{receipts:state.receipts.filter(r=>matches(r,target))}})}}
function useRecord(options){const [error,setError]=useState(false);return {isError:error,isPending:false,reset:()=>setError(false),mutate:(input)=>{
const attempts=[...state.attempts,{...input}];if(state.failNext){update({attempts,failNext:false});setError(true);return}
const existing=state.receipts.find(r=>r.requestId===input.requestId);const receipt=existing??{...input,reviewedAt:Date.UTC(2026,8,13,17)};
update({attempts,receipts:existing?state.receipts:[...state.receipts,receipt]});setError(false);options?.onSuccess?.({receipt});
}}}
export const trpc={aperture:{desk:{markSeen:{useMutation:()=>({mutate:(_,options)=>{options?.onSuccess?.();options?.onSettled?.()}})}},monitor:{reviews:{list:{useQuery:useList},record:{useMutation:useRecord}}}}};`;
const entry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{TodayAttentionBriefing}from'/src/components/aperture/TodayAttentionBriefing.tsx';
import{useFixture,failNext}from'virtual:review-rpc';import'/src/index.css';
const time=Date.UTC(2026,8,13,16);
function App(){const data=useFixture();const [version,setVersion]=useState(1);
const item={key:'finding-4',kind:'monitoring_finding',critical:true,title:'Review FIX · $20 Put',reason:'The recorded catalyst needs review.',consequence:'This uncertainty affects the selected put.',stateLabel:'Unresolved · stale evidence',deadlineAt:null,actionLabel:'Review what changed',
href:'/aperture/run/1/execute?candidate=2&lifecycle=monitoring&order=3&finding=4&findingVersion=v1-'+version.toString(16).padStart(8,'0'),
evidence:{finding:'Illustrative evidence only: the recorded catalyst has not been confirmed.',rationale:'Illustrative protective put.',checkedAt:time,citations:['https://example.test/illustrative-source']}};
const attention={entryState:'returning',primary:item,otherCritical:[],otherAttention:[],inMotion:[],changed:[],readState:'complete',nextCheckpoint:null,changeHeading:'Current status',scopeNote:'Illustrative fixture only.',monitoringNote:'Checks run on demand.',quiet:false,quietMessage:null,baseline:{capturedAt:time,items:[{key:item.key,fingerprint:'fixture-'+version}]},baselineToken:'fixture'};
return <main className='aperture-editorial mx-auto max-w-4xl p-4'>
<p className='mb-3 font-semibold'>Illustrative UAT · in-memory only · no API or broker</p>
<div className='mb-3 flex flex-wrap gap-2'><button className='min-h-11 border px-3' onClick={failNext}>Simulate save timeout</button><button className='min-h-11 border px-3' onClick={()=>setVersion(v=>v+1)}>Show a newer finding</button></div>
<p role='status' className='mb-3'>Review attempts: {data.attempts.length} · Unique requests: {new Set(data.attempts.map(a=>a.requestId)).size} · Saved reviews: {data.receipts.length} · Broker orders: 0 · Version: {version}</p>
<TodayAttentionBriefing key={version} attention={attention} accountLabel='Illustrative Paper' modeLabel='Paper' loading={false} failed={null} onOpen={()=>{}} onRetry={()=>{}} onNewMission={()=>{}}/>
</main>};createRoot(document.getElementById('root')).render(<App/>);`;
const app = await createServer({ configFile: false, root: path.join(root,"client"), envDir: path.join(root,"__absent_uat_environment__"), publicDir:false,
  cacheDir:mkdtempSync("/tmp/aperture-review-vite."),
  resolve:{alias:[{find:"@/lib/trpc",replacement:"virtual:review-rpc"},{find:"@",replacement:path.join(root,"client/src")},{find:"@shared",replacement:path.join(root,"shared")}]},
  plugins:[react(),tailwindcss(),{name:"review-presets-uat",
    configureServer(server){server.middlewares.use(async(req,res,next)=>{
      if(req.url!=="/__review-uat")return next();
      res.setHeader("Content-Type","text/html; charset=utf-8");res.end(await server.transformIndexHtml(req.url,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review presets UAT</title></head><body><div id="root"></div><script type="module" src="/src/__review_fixture.tsx"></script></body></html>'));
    });},
    resolveId(id){if(id==="virtual:review-rpc")return "\0review-rpc";if(id==="/src/__review_fixture.tsx")return "\0review-fixture.tsx";},
    async load(id){if(id==="\0review-rpc")return mock;if(id==="\0review-fixture.tsx")return (await transformWithEsbuild(entry,"review-fixture.tsx",{loader:"tsx",jsx:"transform"})).code;},
  }],server:{host:"127.0.0.1",port:3116,strictPort:true,fs:{allow:[root]}},
});
await app.listen();console.log("REVIEW_UAT_READY http://localhost:3116/__review-uat");
for(const signal of ["SIGINT","SIGTERM"])process.once(signal,async()=>{await app.close();process.exit(0)});
