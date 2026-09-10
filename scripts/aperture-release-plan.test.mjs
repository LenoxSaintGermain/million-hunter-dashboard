import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReleasePlan, releaseMigrations, reconcileReleaseStep } from './aperture-release-plan.mjs';
import { createdTableShape, inspectMigrationStep } from './aperture-release-schema-state.mjs';
const read = file => readFileSync(new URL(`../drizzle/${file}`, import.meta.url));
const plan = buildReleasePlan(read);
test('TiDB column creation precedes the dependent index in a separate inspected step', () => {
  const steps = plan.steps.filter(s=>s.id.startsWith('0066'));
  assert.equal(steps.length,3);
  assert.match(steps[0].sql,/ADD COLUMN client_request_id/);
  assert.doesNotMatch(steps[0].sql,/ADD UNIQUE KEY/);
  assert.match(steps[1].sql,/ADD UNIQUE KEY/);
  assert.doesNotMatch(steps[1].sql,/ADD COLUMN/);
  const table='aperture_decision_runs';
  const schema={tables:[table],columns:[{TABLE_NAME:table,COLUMN_NAME:'client_request_id',COLUMN_TYPE:'varchar(36)',IS_NULLABLE:'YES'}],statistics:[]};
  assert.equal(inspectMigrationStep(steps[1],schema).state,'before');
  assert.equal(inspectMigrationStep(steps[1],{...schema,columns:[]}).state,'conflict');
  schema.statistics=['user_id','client_request_id'].map((COLUMN_NAME,i)=>({TABLE_NAME:table,INDEX_NAME:'aperture_decision_runs_owner_request_uq',COLUMN_NAME,SEQ_IN_INDEX:i+1,NON_UNIQUE:0,SUB_PART:null}));
  assert.equal(inspectMigrationStep(steps[1],schema).state,'after');
  schema.statistics[1].SUB_PART=5;
  assert.equal(inspectMigrationStep(steps[1],schema).state,'conflict');
});
test('pins all five actual migrations and nine dependency-ordered statements', () => {
  assert.equal(releaseMigrations.length, 5);
  assert.equal(plan.steps.length, 9);
  assert.equal(plan.steps[0].id, '0065_aperture_capital_ledger.sql:1');
  assert.equal(plan.steps.at(-1).id, '0069_aperture_execution_evidence.sql:1');
  assert.deepEqual(buildReleasePlan(read), plan);
});
test('rejects changed bytes even in the last file before returning a plan', () => {
  assert.throws(() => buildReleasePlan(file => file.startsWith('0069') ? Buffer.concat([read(file), Buffer.from('\n')]) : read(file)), /Unreviewed migration bytes/);
});
const step = plan.steps[0];
test('all pinned CREATE statements have a complete inspectable shape', () => {
  for (const step of plan.steps.filter(s => s.sql.startsWith('CREATE TABLE'))) {
    const shape = createdTableShape(step.sql);
    assert(shape.columns.length > 5); assert(shape.indexes.length >= 2);
    const schema = { tables: [shape.table], columns: shape.columns.map(c => ({ TABLE_NAME: shape.table, COLUMN_NAME: c.name, COLUMN_TYPE: c.type, IS_NULLABLE: c.nullable ? 'YES' : 'NO', EXTRA: c.auto ? 'auto_increment' : '', COLUMN_DEFAULT: null })),
      statistics: shape.indexes.flatMap((k,i) => k.columns.map((COLUMN_NAME,n) => ({ TABLE_NAME: shape.table, INDEX_NAME: `key${i}`, COLUMN_NAME, SEQ_IN_INDEX: n+1, NON_UNIQUE: k.unique ? 0 : 1, SUB_PART: null }))) };
    assert.equal(inspectMigrationStep(step,schema).state,'after');
    assert.equal(inspectMigrationStep(step,{tables:[],columns:[],statistics:[]}).state,'before');
    assert.equal(inspectMigrationStep(step,{...schema,columns:schema.columns.slice(1)}).state,'conflict');
    assert.equal(inspectMigrationStep(step,{...schema,statistics:[]}).state,'conflict');
    assert.equal(inspectMigrationStep(step,{...schema,columns:schema.columns.map(c=>({...c,COLUMN_DEFAULT:'NULL'}))}).state,'after');
    assert.equal(inspectMigrationStep(step,{...schema,columns:schema.columns.map(c=>({...c,COLUMN_DEFAULT:"'NULL'"}))}).state,'conflict');
    const jsonColumns = shape.columns.filter(c=>c.type === 'json');
    if (jsonColumns.length) {
      const alias = {...schema, columns:schema.columns.map(c=>({...c,COLUMN_TYPE:c.COLUMN_TYPE==='json'?'longtext':c.COLUMN_TYPE}))};
      assert.equal(inspectMigrationStep(step,alias).state,'conflict');
      assert.equal(inspectMigrationStep(step,{...alias,checks:jsonColumns.map(c=>({TABLE_NAME:shape.table,CHECK_CLAUSE:`json_valid(\`${c.name}\`)`}))}).state,'after');
    }
  }
});
const journal = state => ({ stepId: step.id, statementSha256: step.statementSha256, state });
test('a timeout after committed DDL requires postcondition verification, not duplicate execution', () => {
  assert.equal(reconcileReleaseStep(step, journal('started'), { state: 'after' }), 'verify_and_record');
  assert.equal(reconcileReleaseStep(step, journal('started'), null), 'inspect_required');
  assert.equal(reconcileReleaseStep(step, journal('started'), { state: 'before' }), 'ready');
});
test('never trusts a completed journal over conflicting schema or different statement identity', () => {
  assert.equal(reconcileReleaseStep(step, journal('complete'), { state: 'before' }), 'conflict');
  assert.equal(reconcileReleaseStep(step, { ...journal('started'), statementSha256: 'wrong' }, { state: 'after' }), 'conflict');
  assert.equal(reconcileReleaseStep(step, null, { state: 'conflict' }), 'conflict');
  assert.equal(reconcileReleaseStep(step, journal('unrecognized'), { state: 'after' }), 'conflict');
});
