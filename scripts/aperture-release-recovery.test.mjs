import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifiedRecovery } from './aperture-release-recovery.mjs';
import { REVIEWED_PLAN_SHA256 } from './aperture-release-executor.mjs';
test('recovery verification pins private original bytes, restore proof, target and plan', async () => {
  const dir = mkdtempSync('/tmp/aperture-recovery-test.');
  const artifact = {targetFingerprint:'fixture',capturedAt:'fixture-time',tables:
    ['aperture_decision_runs','aperture_decision_revisions'].map(table=>({table,rows:[{id:1}]}))};
  const bytes=JSON.stringify(artifact), hash=value=>createHash('sha256').update(value).digest('hex');
  const proof={targetFingerprint:'fixture',capturedAt:'fixture-time',artifactSha256:hash(bytes),restoreVerified:true,databaseRemoved:true,userRemoved:true,
    tables:artifact.tables.map(t=>({table:t.table,rows:1,matched:true}))};
  const proofBytes=JSON.stringify(proof), artifactPath=dir+'/artifact.json',proofPath=dir+'/proof.json';
  try {
    writeFileSync(artifactPath,bytes,{mode:0o600});writeFileSync(proofPath,proofBytes,{mode:0o600});
    const verify=verifiedRecovery({artifactPath,proofPath,artifactSha256:hash(bytes),proofSha256:hash(proofBytes),expectedTarget:'fixture'});
    const context={expectedTarget:'fixture',planSha256:REVIEWED_PLAN_SHA256};
    assert.equal(await verify(context),true);
    assert.equal(await verify({...context,expectedTarget:'other'}),false);
    assert.equal(await verify({...context,planSha256:'other'}),false);
    writeFileSync(artifactPath,bytes+' ');assert.equal(await verify(context),false);
    writeFileSync(artifactPath,bytes);writeFileSync(proofPath,JSON.stringify({...proof,restoreVerified:false}));
    assert.equal(await verify(context),false);
  } finally {rmSync(dir,{recursive:true});}
});
