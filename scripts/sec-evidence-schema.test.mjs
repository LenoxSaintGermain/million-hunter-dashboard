import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expectedSchema, tableNames, inspectSecEvidenceSchema, reviewedStatements, runSchemaGate, sanitizedError } from './sec-evidence-schema.mjs';

const source = readFileSync(new URL('../drizzle/0072_public_evidence_receipts.sql', import.meta.url));
const databaseUrl = 'mysql://unit:never-used@localhost/fixture';
function fixture(names = tableNames) {
  return {
    tables: names.map(TABLE_NAME => ({ TABLE_NAME, TABLE_TYPE: 'BASE TABLE', ENGINE: 'InnoDB' })),
    columns: names.flatMap(TABLE_NAME => Object.entries(expectedSchema[TABLE_NAME].columns).map(([COLUMN_NAME, c]) => ({
      TABLE_NAME, COLUMN_NAME, COLUMN_TYPE: c.type, IS_NULLABLE: c.nullable ? 'YES' : 'NO',
      COLUMN_DEFAULT: c.defaultValue, EXTRA: '', COLLATION_NAME: null,
    }))),
    statistics: names.flatMap(TABLE_NAME => Object.entries(expectedSchema[TABLE_NAME].indexes).flatMap(([INDEX_NAME, idx]) => idx.columns.map((COLUMN_NAME, i) => ({
      TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX: i + 1, NON_UNIQUE: idx.unique ? 0 : 1, SUB_PART: null, INDEX_TYPE: 'BTREE', COLLATION: 'A',
    })))),
    checks: [],
  };
}
test('pins the exact reviewed file and three additive statements', () => {
  const statements = reviewedStatements(source);
  assert.equal(statements.length, 3);
  assert.deepEqual(statements.map(s => s.match(/^CREATE TABLE (\w+)/)[1]), tableNames);
  assert.throws(() => reviewedStatements(Buffer.concat([source, Buffer.from('\n')])), /MIGRATION_HASH_MISMATCH/);
});
test('reports fully absent, partial, and compatible schemas', () => {
  assert.equal(inspectSecEvidenceSchema(fixture([])).state, 'absent');
  assert.equal(inspectSecEvidenceSchema(fixture([tableNames[0]])).state, 'partial');
  const full = inspectSecEvidenceSchema(fixture());
  assert.equal(full.state, 'compatible');
  assert.equal(full.tables[0].columns.length, 15);
});
test('accepts MariaDB display widths and checked JSON alias only', () => {
  const data = fixture();
  data.columns.forEach(c => {
    if (c.COLUMN_TYPE === 'int') c.COLUMN_TYPE = 'int(11)';
    if (c.COLUMN_TYPE === 'bigint') c.COLUMN_TYPE = 'bigint(20)';
    if (c.IS_NULLABLE === 'YES') c.COLUMN_DEFAULT = 'NULL';
  });
  const payload = data.columns.find(c => c.COLUMN_NAME === 'payload');
  payload.COLUMN_TYPE = 'longtext'; payload.COLLATION_NAME = 'utf8mb4_bin';
  assert.equal(inspectSecEvidenceSchema(data).state, 'conflict');
  data.checks.push({ TABLE_NAME: tableNames[0], CHECK_CLAUSE: 'json_valid(`payload`)' });
  assert.equal(inspectSecEvidenceSchema(data).state, 'compatible');
  data.checks[0].CHECK_CLAUSE = 'json_valid(`payload`) OR 1';
  assert.equal(inspectSecEvidenceSchema(data).state, 'conflict');
});
for (const [label, mutate] of [
  ['missing column', d => d.columns.pop()],
  ['wrong type', d => { d.columns[0].COLUMN_TYPE = 'varchar(35)'; }],
  ['unsigned integer', d => { d.columns[1].COLUMN_TYPE = 'int unsigned'; }],
  ['wrong nullability', d => { d.columns[0].IS_NULLABLE = 'YES'; }],
  ['wrong default', d => { d.columns.find(c => c.COLUMN_NAME === 'cooldown_until').COLUMN_DEFAULT = null; }],
  ['generated column', d => { d.columns[0].EXTRA = 'STORED GENERATED'; }],
  ['unexpected column', d => d.columns.push({ ...d.columns[0], COLUMN_NAME: 'extra' })],
  ['view', d => { d.tables[0].TABLE_TYPE = 'VIEW'; }],
  ['wrong engine', d => { d.tables[0].ENGINE = 'MyISAM'; }],
  ['missing index', d => d.statistics.pop()],
  ['nonunique primary', d => { d.statistics[0].NON_UNIQUE = 1; }],
  ['unknown index uniqueness', d => { d.statistics[0].NON_UNIQUE = null; }],
  ['prefix index', d => { d.statistics[0].SUB_PART = 8; }],
  ['wrong index order', d => { d.statistics[1].SEQ_IN_INDEX = 2; }],
  ['descending index', d => { d.statistics[0].COLLATION = 'D'; }],
  ['unexpected index', d => d.statistics.push({ ...d.statistics[0], INDEX_NAME: 'extra' })],
]) test(`fails closed on ${label}`, () => {
  const data = fixture(); mutate(data);
  assert.equal(inspectSecEvidenceSchema(data).state, 'conflict');
});
test('ignores unrelated tables; refuses orphan metadata', () => {
  const data = fixture();
  data.tables.push({ TABLE_NAME: 'users' }); data.columns.push({ TABLE_NAME: 'users' });
  assert.equal(inspectSecEvidenceSchema(data).state, 'compatible');
  data.tables = [];
  assert.equal(inspectSecEvidenceSchema(data).state, 'conflict');
});
function harness(initial = [], { failCreate = 0, corruptAfter = false, corruptBefore = false } = {}) {
  const names = [...initial]; const calls = []; let closed = false; let creates = 0;
  const connect = async () => ({
    execute: async (sql, params) => {
      calls.push(sql);
      if (sql === 'SELECT DATABASE() AS databaseName') return [[{ databaseName: 'fixture' }]];
      if (sql.startsWith('CREATE TABLE')) {
        creates++;
        if (creates === failCreate) throw new Error('mysql://unit:secret@host/private');
        names.push(sql.match(/^CREATE TABLE (\w+)/)[1]); return [{}];
      }
      assert.deepEqual(params, tableNames);
      const data = fixture(names);
      if (corruptBefore || (corruptAfter && creates === 3)) data.columns.pop();
      if (sql.includes('information_schema.TABLES')) return [data.tables];
      if (sql.includes('information_schema.COLUMNS')) return [data.columns];
      if (sql.includes('information_schema.STATISTICS')) return [data.statistics];
      throw Error('Unexpected SQL');
    },
    end: async () => { closed = true; },
  });
  return { calls, names, connect, closed: () => closed };
}
test('read-only never executes DDL, even when absent', async () => {
  const h = harness();
  const report = await runSchemaGate({ mode: '--read-only', databaseUrl, source, connect: h.connect });
  assert.equal(report.state, 'absent'); assert.equal(report.applied, false);
  assert.ok(h.calls.every(s => s.startsWith('SELECT '))); assert.equal(h.closed(), true);
});
test('apply executes only reviewed CREATEs and verifies afterward', async () => {
  const h = harness();
  const report = await runSchemaGate({ mode: '--apply', databaseUrl, source, connect: h.connect });
  assert.equal(report.applied, true); assert.equal(report.compatible, true);
  assert.deepEqual(h.calls.filter(s => !s.startsWith('SELECT ')), reviewedStatements(source));
  assert.equal(h.calls.filter(s => s.includes('information_schema.TABLES')).length, 2);
  assert.equal(h.closed(), true);
});
test('compatible apply is idempotent and never writes', async () => {
  const h = harness(tableNames);
  assert.equal((await runSchemaGate({ mode: '--apply', databaseUrl, source, connect: h.connect })).applied, false);
  assert.ok(h.calls.every(s => s.startsWith('SELECT ')));
});
test('partial state refuses any creation', async () => {
  const h = harness([tableNames[0]]);
  await assert.rejects(runSchemaGate({ mode: '--apply', databaseUrl, source, connect: h.connect }), /EXISTING_SCHEMA_REQUIRES_REVIEW/);
  assert.ok(h.calls.every(s => s.startsWith('SELECT '))); assert.equal(h.closed(), true);
});
test('fully present conflicting schema refuses any writes', async () => {
  const h = harness(tableNames, { corruptBefore: true });
  await assert.rejects(runSchemaGate({ mode: '--apply', databaseUrl, source, connect: h.connect }), /EXISTING_SCHEMA_REQUIRES_REVIEW/);
  assert.ok(h.calls.every(s => s.startsWith('SELECT '))); assert.equal(h.closed(), true);
});
test('interrupted DDL stops with no cleanup or retry; sanitizes driver details', async () => {
  const h = harness([], { failCreate: 2 });
  let failure;
  try { await runSchemaGate({ mode: '--apply', databaseUrl, source, connect: h.connect }); } catch (error) { failure = error; }
  assert.ok(failure); assert.deepEqual(h.names, [tableNames[0]]);
  assert.equal(h.calls.filter(s => s.startsWith('CREATE TABLE')).length, 2);
  assert.ok(!JSON.stringify(sanitizedError(failure)).includes('secret'));
  assert.equal(h.closed(), true);
});
test('post-apply mismatch is failure, not reported success', async () => {
  const h = harness([], { corruptAfter: true });
  await assert.rejects(runSchemaGate({ mode: '--apply', databaseUrl, source, connect: h.connect }), /POST_APPLY_VERIFICATION_FAILED/);
  assert.equal(h.closed(), true);
});
test('invalid mode, missing explicit URL, and hash drift fail before connection', async () => {
  let connected = false;
  for (const patch of [{ mode: '--force' }, { databaseUrl: '' }, { databaseUrl: 'https://host/db' }, { source: Buffer.from('DROP TABLE users;') }]) {
    await assert.rejects(runSchemaGate({ mode: '--apply', databaseUrl, source, connect: async () => { connected = true; }, ...patch }));
  }
  assert.equal(connected, false);
});
test('connected database identity mismatch fails before metadata or DDL', async () => {
  let closed = false;
  await assert.rejects(runSchemaGate({ mode: '--apply', databaseUrl, source, connect: async () => ({
    execute: async sql => { assert.equal(sql, 'SELECT DATABASE() AS databaseName'); return [[{ databaseName: 'wrong' }]]; },
    end: async () => { closed = true; },
  }) }), /DATABASE_IDENTITY_MISMATCH/);
  assert.equal(closed, true);
});
