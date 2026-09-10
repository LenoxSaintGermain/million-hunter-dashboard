/** Exact release inputs. Pure planning only: no database, dotenv or DDL execution. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

export const releaseMigrations = Object.freeze([
  ['0065_aperture_capital_ledger.sql', 'd6566591dde81ca68665622f9aebc3ddec92ce1088cf0b41279ed70b01f4b03e'],
  ['0066_aperture_objective_mission.sql', '001102be1a7dcdcaa6a6c36fb4f4c8f98904f0df3e792b7de10491e7b4df1cca'],
  ['0067_aperture_strategy_discovery.sql', '9e2472d3e3cb7e232f2fe7efba3d66b440cf5073f6440f528879a9e1b806c075'],
  ['0068_aperture_discovery_selection.sql', '51b5fbb93e555469b187731e7fe67fdf298e381128cd471368cab141736f4e75'],
  ['0069_aperture_execution_evidence.sql', 'b6f8d5a68c05c8f67573edc56557788e4e5576064f4c721afba04ecb489db274'],
].map(([file, sha256]) => Object.freeze({ file, sha256 })));

export function buildReleasePlan(readSource) {
  // Validate every byte before producing a runnable statement list. A later
  // mismatched file must not leave a partially approved plan.
  const sources = releaseMigrations.map(({ file, sha256 }) => {
    const source = readSource(file);
    if (createHash('sha256').update(source).digest('hex') !== sha256) throw Error(`Unreviewed migration bytes: ${file}`);
    return { file, sha256, source: String(source) };
  });
  const steps = sources.flatMap(({ file, sha256, source }) => source
    .split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
    .split(';').map(sql => sql.trim()).filter(Boolean)
    .map((sql, index) => {
      if (!/^(CREATE TABLE|ALTER TABLE)\s/i.test(sql)) throw Error(`Unexpected operation in ${file}`);
      return Object.freeze({ id: `${file}:${index + 1}`, sourceSha256: sha256, sql,
        statementSha256: createHash('sha256').update(sql).digest('hex') });
    }));
  const planSha256 = createHash('sha256').update(JSON.stringify(steps)).digest('hex');
  return { planSha256, steps };
}

/** A journal alone is not schema proof; interrupted DDL must be reconciled. */
export function reconcileReleaseStep(step, journal, observed) {
  if (!observed || !['before', 'after', 'conflict'].includes(observed.state)) return 'inspect_required';
  if (journal && (journal.stepId !== step.id || journal.statementSha256 !== step.statementSha256)) return 'conflict';
  if (journal && !['started', 'failed', 'complete'].includes(journal.state)) return 'conflict';
  if (observed.state === 'conflict') return 'conflict';
  if (observed.state === 'after') return 'verify_and_record';
  if (journal?.state === 'complete') return 'conflict';
  if (journal && !['started', 'failed'].includes(journal.state)) return 'conflict';
  return 'ready';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--plan-only') throw Error('Use --plan-only. This tool cannot apply migrations.');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  console.log(JSON.stringify({ appliesChanges: false, ...buildReleasePlan(file => readFileSync(resolve(root, 'drizzle', file))) }, null, 2));
}
