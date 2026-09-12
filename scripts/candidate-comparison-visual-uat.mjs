/** Interactive, zero-API fixture; never mounted in the product router. */
import { createServer, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { mkdtempSync } from "node:fs";

if (process.env.DATABASE_URL !== "") throw new Error("Explicit empty DATABASE_URL required");
const root = path.resolve(import.meta.dirname, "..");
const entry = `import React, {useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {CandidateComparison,CandidateInspection} from '/src/components/aperture/CandidateComparison.tsx';
import '/src/index.css';
const candidates=Array.from({length:12},(_,i)=>({id:i+1,symbol:'FIX'+(i+1),role:i===0?'core':'complementary',compositeScore:70,confidenceScore:0.7,verifyFields:['C: Price / earnings']}));
function App(){const [id,setId]=useState(null);const trigger=useRef(null);const [task,setTask]=useState(null);
return <main className='aperture-editorial mx-auto max-w-6xl p-4'>
<p className='mb-4 text-sm'>Illustrative interaction fixture · no API, account, or order actions</p>
<CandidateComparison candidates={candidates} reviews={[{candidateId:2,checkLabel:'C: Price / earnings',status:'not_confirmed'}]} leadId={1} inspectedId={id} onInspect={(next,button)=>{trigger.current=button;setId(next)}}/>
<CandidateInspection open={id!==null} symbol={'FIX'+id} onClose={()=>setId(null)} onRestoreFocus={()=>trigger.current?.focus({preventScroll:true})}>
<p>Illustrative evidence task for candidate {id}. Prices and risk are not measured in this fixture.</p>
<button className='my-4 min-h-11 border px-4' onClick={()=>{setTask(id);setId(null)}}>Review FIX{id} evidence</button>
</CandidateInspection>
{task&&<p role='status' className='mt-4'>Selected evidence task: FIX{task}. No review recorded or ticket created.</p>}
</main>};createRoot(document.getElementById('root')).render(<App/>);`;
const app=await createServer({configFile:false,root:path.join(root,"client"),envDir:path.join(root,"__absent_uat_environment__"),publicDir:false,
 cacheDir:mkdtempSync("/tmp/aperture-candidate-vite."),plugins:[react(),tailwindcss(),{name:"candidate-uat",
 configureServer(server){server.middlewares.use(async(req,res,next)=>{
 if(!req.url?.startsWith("/__candidate-uat"))return next();
 const url=new URL(req.url,"http://localhost");const mobile=url.searchParams.has("mobile");
 const body=mobile?'<p>390 CSS pixel viewport · illustrative mobile fixture</p><iframe title="Mobile candidate comparison" style="width:390px;height:844px;border:1px solid #888" src="/__candidate-uat"></iframe>':'<div id="root"></div><script type="module" src="/src/__candidate_fixture.tsx"></script>';
 res.setHeader("Content-Type","text/html; charset=utf-8");res.end(await server.transformIndexHtml(req.url,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Candidate comparison UAT</title></head><body>'+body+'</body></html>'));
 });},resolveId(id){if(id==='/src/__candidate_fixture.tsx')return '\0candidate-fixture.tsx';},async load(id){if(id==='\0candidate-fixture.tsx')return (await transformWithEsbuild(entry,'candidate-fixture.tsx',{loader:'tsx',jsx:'transform'})).code;}}],
 resolve:{alias:{'@':path.join(root,'client/src'),'@shared':path.join(root,'shared')}},
 server:{host:"127.0.0.1",port:3115,strictPort:true,fs:{allow:[root]}}});
await app.listen();console.log("CANDIDATE_UAT_READY http://localhost:3115/__candidate-uat");
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0)});
