/** Freeze only tracked runtime/build inputs; never upload workspace history. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, copyFileSync, writeFileSync, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
const roots = new Set(['Dockerfile','.dockerignore','package.json','pnpm-lock.yaml',
  'tsconfig.json','tsconfig.node.json','vite.config.ts','components.json','cloudbuild.capital-aperture.yaml']);
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const files=tracked.filter(f=>roots.has(f)||/^(client|server|shared|drizzle|patches|attached_assets)\//.test(f)).sort();
const output=mkdtempSync('/tmp/aperture-release-source.');
const source=join(output,'source');mkdirSync(source);
const hashes={};
for(const file of files){
  if(file.split('/').some(p=>p.startsWith('.env'))||/\.(pem|key|p12)$/i.test(file)||!lstatSync(file).isFile()) throw Error('Disallowed release input');
  const bytes=readFileSync(file);
  if(bytes.includes(Buffer.from('-----BEGIN PRIVATE KEY-----'))) throw Error('Private key in release input');
  hashes[file]=createHash('sha256').update(bytes).digest('hex');
  mkdirSync(dirname(join(source,file)),{recursive:true});copyFileSync(file,join(source,file));
}
const sourceSha256=createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const release=`${head.slice(0,7)}-uat-${sourceSha256.slice(0,8)}`;
const manifest={source,sourceSha256,release,head,containsWorkingTreeChanges:true,files:hashes};
writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({output,source,sourceSha256,release,files:files.length,containsWorkingTreeChanges:true}));
