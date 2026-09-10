/** Deliberate 0065–0069 application only; does not deploy or enable features. */
import { readFileSync, openSync, writeFileSync, fsyncSync, closeSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { buildReleasePlan } from './aperture-release-plan.mjs';
import { executeReleasePlan, REVIEWED_PLAN_SHA256 } from './aperture-release-executor.mjs';
import { openReleaseExecutionConnection } from './aperture-release-connection.mjs';
import { openReleaseJournal } from './aperture-release-journal.mjs';
import { verifiedRecovery } from './aperture-release-recovery.mjs';

const [mode, expectedTarget, root, artifactSha256, proofName, proofSha256] = process.argv.slice(2);
if (process.argv.length !== 8 || mode !== '--apply-reviewed-plan' || !process.env.DATABASE_URL ||
    ![expectedTarget,artifactSha256,proofSha256].every(s=>/^[a-f0-9]{64}$/.test(s??'')) ||
    !/^restore-proof-[a-f0-9]+\.json$/.test(proofName??'') || !root?.startsWith('/')) {
  throw Error('Explicit apply mode, target, private directory, recovery hashes and DATABASE_URL required');
}
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plan = buildReleasePlan(file=>readFileSync(join(repo,'drizzle',file)));
const verifyRecovery = verifiedRecovery({artifactPath:join(root,'original-receipts.json'),
  proofPath:join(root,proofName),artifactSha256,proofSha256,expectedTarget});
let journal, adapter;
try {
  journal = openReleaseJournal({root,target:expectedTarget,planSha256:plan.planSha256});
  if (!await verifyRecovery({expectedTarget,planSha256:plan.planSha256})) throw Error('Recovery proof rejected');
  adapter = await openReleaseExecutionConnection({plan,connectionUrl:process.env.DATABASE_URL,expectedFingerprint:expectedTarget,connect:mysql.createConnection});
  const result = await executeReleasePlan({plan,approvedPlanSha256:REVIEWED_PLAN_SHA256,expectedTarget,
    ...adapter,...journal,verifyRecovery});
  const receipt={...result,checkedAt:new Date().toISOString(),target:expectedTarget,planSha256:plan.planSha256,
    artifactSha256,proofSha256,deploysApplication:false,changesBrokerRecords:false};
  const output=join(journal.directory,`verified-${Date.now()}.json`);
  const fd=openSync(output,'wx',0o600);
  try {writeFileSync(fd,JSON.stringify(receipt,null,2));fsyncSync(fd);}finally{closeSync(fd);}
  console.log(JSON.stringify({output,...receipt}));
} catch (error) {
  console.error(JSON.stringify({complete:false,code:error.code??'release_guard',errno:error.errno??null,
    error:'Release stopped. Inspect private step receipts and current schema before retrying; no automatic rollback.'}));
  process.exitCode=1;
} finally {
  await adapter?.close();
  await journal?.close();
}
