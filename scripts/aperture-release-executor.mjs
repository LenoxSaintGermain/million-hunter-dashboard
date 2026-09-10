/** Adapter-driven release executor. No implicit DB connection or dotenv loading. */
import { createHash } from 'node:crypto';
import { reconcileReleaseStep } from './aperture-release-plan.mjs';
import { inspectMigrationStep } from './aperture-release-schema-state.mjs';

export const REVIEWED_PLAN_SHA256 = '4612cba395cb8340d370c62335f2d86d1a2bf21c9401acf7cfeefdbfd47d88d2';
const digest = value => createHash('sha256').update(value).digest('hex');

/** Caller must hold an exclusive target lease and provide a verified recovery
 * adapter. Journal writes must be durable before execute() is allowed to run. */
export async function executeReleasePlan({ plan, approvedPlanSha256, expectedTarget,
  readTarget, verifyLease, verifyRecovery, readSchema, readJournal, writeJournal, execute }) {
  if (approvedPlanSha256 !== REVIEWED_PLAN_SHA256 || plan.planSha256 !== REVIEWED_PLAN_SHA256
    || digest(JSON.stringify(plan.steps)) !== REVIEWED_PLAN_SHA256) throw Error('Unapproved release plan');
  if (!expectedTarget || typeof expectedTarget !== 'string') throw Error('Explicit target required');
  const assertTarget = async () => {
    if (await verifyLease() !== true) throw Error('Exclusive release lease is not held');
    if (await readTarget() !== expectedTarget) throw Error('Release target changed');
  };
  await assertTarget();
  if (await verifyRecovery({ expectedTarget, planSha256: plan.planSha256 }) !== true) throw Error('Recovery evidence is not verified');
  const result = { applied: [], reconciled: [], complete: false };
  for (const step of plan.steps) {
    await assertTarget();
    const journal = await readJournal(step.id);
    if (journal && (journal.target !== expectedTarget || journal.planSha256 !== plan.planSha256)) throw Error('Journal belongs to another release target');
    const observed = inspectMigrationStep(step, await readSchema());
    const action = reconcileReleaseStep(step, journal, observed);
    if (action !== 'ready' && action !== 'verify_and_record') throw Error(`Inspect schema before continuing: ${step.id}`);
    const record = state => writeJournal({ target: expectedTarget, planSha256: plan.planSha256,
      stepId: step.id, statementSha256: step.statementSha256, state });
    if (action === 'ready') {
      // A failed or lost DDL response leaves 'started'. The next invocation
      // observes the schema before deciding whether execution is still needed.
      await record('started');
      await assertTarget();
      await execute(step.sql, step.id);
      await assertTarget();
      if (inspectMigrationStep(step, await readSchema()).state !== 'after') throw Error(`Migration postcondition failed: ${step.id}`);
      result.applied.push(step.id);
    } else result.reconciled.push(step.id);
    await record('complete');
  }
  await assertTarget();
  const finalSchema = await readSchema();
  for (const step of plan.steps) if (inspectMigrationStep(step, finalSchema).state !== 'after') throw Error(`Final schema drift: ${step.id}`);
  result.complete = true;
  return result;
}
