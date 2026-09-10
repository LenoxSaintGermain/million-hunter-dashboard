import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openReleaseJournal } from './aperture-release-journal.mjs';
test('persists receipts across reopen and blocks a concurrent same-target runner', async () => {
  const root = mkdtempSync(join(tmpdir(),'aperture-release-journal-test-'));
  const options = {root,target:'owned-fixture',planSha256:'reviewed-plan'};
  try {
    const first=openReleaseJournal(options);
    assert.throws(()=>openReleaseJournal(options),/EEXIST/);
    assert.throws(()=>openReleaseJournal({...options,planSha256:'next-plan'}),/EEXIST/);
    const entry={target:options.target,planSha256:options.planSha256,stepId:'step1',state:'started'};
    await first.writeJournal(entry); await first.close();
    assert.equal(await first.verifyLease(),false);
    const second=openReleaseJournal(options);
    assert.deepEqual(await second.readJournal('step1'),entry);
    await second.writeJournal({...entry,state:'complete'});
    assert.equal((await second.readJournal('step1')).state,'complete');
    await second.close();
    const revised=openReleaseJournal({...options,planSha256:'next-plan'});
    assert.equal(await revised.readJournal('step1'),null);
    await revised.close();
    const original=openReleaseJournal(options);
    assert.equal((await original.readJournal('step1')).state,'complete');
    await original.close();
  } finally { rmSync(root,{recursive:true,force:true}); }
});
test('refuses non-private storage before creating a lock', () => {
  const root=mkdtempSync(join(tmpdir(),'aperture-release-journal-test-'));
  try { chmodSync(root,0o755); assert.throws(()=>openReleaseJournal({root,target:'test',planSha256:'test'}),/owner-only/); }
  finally { rmSync(root,{recursive:true,force:true}); }
});
