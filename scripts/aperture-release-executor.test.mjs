import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReleasePlan } from './aperture-release-plan.mjs';
import { executeReleasePlan, REVIEWED_PLAN_SHA256 } from './aperture-release-executor.mjs';
const plan = buildReleasePlan(file => readFileSync(new URL(`../drizzle/${file}`, import.meta.url)));
function fixture() {
  const calls = [], journals = new Map();
  return { calls, journals, options: { plan, approvedPlanSha256: REVIEWED_PLAN_SHA256, expectedTarget: 'owned-fixture',
    readTarget: async () => 'owned-fixture', verifyLease: async () => true, verifyRecovery: async () => true,
    readSchema: async () => ({ tables: [], columns: [], statistics: [] }),
    readJournal: async id => journals.get(id), writeJournal: async value => { calls.push(`journal:${value.state}`); journals.set(value.stepId,value); },
    execute: async () => { calls.push('execute'); throw Error('simulated lost response'); },
  } };
}
test('rejects plan or target drift before DDL', async () => {
  for (const change of [
    o => { o.approvedPlanSha256 = 'other'; },
    o => { o.plan = {...plan,steps:plan.steps.slice(1)}; },
    o => { o.readTarget = async () => 'another-database'; },
    o => { o.verifyRecovery = async () => false; },
    o => { o.verifyLease = async () => false; },
  ]) {
    const f=fixture(); change(f.options);
    await assert.rejects(executeReleasePlan(f.options)); assert.deepEqual(f.calls,[]);
  }
});
test('does not execute if durable started receipt fails', async () => {
  const f=fixture(); f.options.writeJournal = async () => { throw Error('disk full'); };
  await assert.rejects(executeReleasePlan(f.options),/disk full/); assert.deepEqual(f.calls,[]);
});
test('records intent first and preserves uncertain state after a lost DDL response', async () => {
  const f=fixture(); await assert.rejects(executeReleasePlan(f.options),/lost response/);
  assert.deepEqual(f.calls,['journal:started','execute']);
  assert.equal(f.journals.get(plan.steps[0].id).state,'started');
});
test('rejects a same-step journal from a different target', async () => {
  const f=fixture(); f.journals.set(plan.steps[0].id,{target:'other',planSha256:plan.planSha256});
  await assert.rejects(executeReleasePlan(f.options),/another release target/); assert.deepEqual(f.calls,[]);
});
