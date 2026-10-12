import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expectedSchema, tableNames, inspectPd06Schema, runSchemaGate, REVIEWED_SHA256 } from './pd06-evidence-schema.mjs';
const source = readFileSync(new URL('../drizzle/0073_deal_evidence_analysis.sql', import.meta.url));

function fixture(names = tableNames) {
  return {
    tables: names.map(TABLE_NAME => ({ TABLE_NAME, TABLE_TYPE: 'BASE TABLE', ENGINE: 'InnoDB' })),
    columns: names.flatMap(TABLE_NAME => Object.entries(expectedSchema[TABLE_NAME].columns).map(([COLUMN_NAME, c]) => ({
      TABLE_NAME, COLUMN_NAME, COLUMN_TYPE: c.type, IS_NULLABLE: c.nullable ? 'YES' : 'NO', COLUMN_DEFAULT: null, EXTRA: '',
    }))),
    statistics: names.flatMap(TABLE_NAME => Object.entries(expectedSchema[TABLE_NAME].indexes).flatMap(([INDEX_NAME, idx]) => idx.columns.map((COLUMN_NAME, i) => ({
      TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX: i + 1, NON_UNIQUE: idx.unique ? 0 : 1,
      SUB_PART: null, INDEX_TYPE: 'BTREE', COLLATION: 'A',
    })))), checks: [],
  };
}
test('metadata distinguishes absent, partial, and compatible', () => {
  assert.equal(inspectPd06Schema(fixture([])).state, 'absent');
  assert.equal(inspectPd06Schema(fixture([tableNames[0]])).state, 'partial');
  assert.equal(inspectPd06Schema(fixture()).state, 'compatible');
});
test('MariaDB JSON aliases require exact checks for both JSON columns', () => {
  const data = fixture();
  for (const c of data.columns.filter(c => c.COLUMN_TYPE === 'json')) {
    c.COLUMN_TYPE = 'longtext'; c.COLLATION_NAME = 'utf8mb4_bin';
    data.checks.push({ TABLE_NAME: c.TABLE_NAME, CHECK_CLAUSE: `json_valid(\`${c.COLUMN_NAME}\`)` });
  }
  assert.equal(inspectPd06Schema(data).state, 'compatible');
  data.checks[0].CHECK_CLAUSE += ' OR 1';
  assert.equal(inspectPd06Schema(data).state, 'conflict');
});
for (const [name, mutate] of [
  ['mode drift', d => { d.columns.find(c => c.COLUMN_NAME === 'mode').COLUMN_TYPE = "enum('red_team')"; }],
  ['missing column', d => d.columns.pop()],
  ['nullable owner', d => { d.columns[1].IS_NULLABLE = 'YES'; }],
  ['default drift', d => { d.columns[0].COLUMN_DEFAULT = 'invented'; }],
  ['nonunique key', d => { d.statistics[0].NON_UNIQUE = 1; }],
  ['prefix key', d => { d.statistics[0].SUB_PART = 8; }],
  ['extra index', d => d.statistics.push({ ...d.statistics[0], INDEX_NAME: 'extra' })],
  ['wrong engine', d => { d.tables[0].ENGINE = 'MyISAM'; }],
  ['orphan metadata', d => { d.tables = []; }],
]) test(`fails closed on ${name}`, () => {
  const data = fixture(); mutate(data); assert.equal(inspectPd06Schema(data).state, 'conflict');
});
test('hash drift rejected before connecting', async () => {
  let connected = false;
  await assert.rejects(runSchemaGate({ mode: '--apply', source: 'CREATE TABLE anything ();', connect: async () => { connected = true; } }), /HASH_MISMATCH/);
  assert.equal(connected, false);
});
test('read-only inspects only 0073 metadata and never authorizes release', async () => {
  let closed = false;
  const report = await runSchemaGate({ mode: '--read-only', source, connect: async () => ({
    execute: async (sql, params) => {
      assert.ok(sql.startsWith('SELECT '));
      if (sql === 'SELECT DATABASE() AS databaseName') return [[{ databaseName: 'signal_evidence_uat' }]];
      assert.deepEqual(params, tableNames);
      assert.ok(sql.includes('information_schema.'));
      return [[]];
    }, end: async () => { closed = true; },
  }) });
  assert.equal(report.applied, false); assert.equal(report.releaseReady, false);
  assert.equal(report.reviewedMigrationSha256, REVIEWED_SHA256); assert.equal(report.state, 'absent'); assert.equal(closed, true);
});
test('wrong database is refused before metadata reads and connection closes', async () => {
  let closed = false;
  await assert.rejects(runSchemaGate({ mode: '--read-only', source, connect: async () => ({
    execute: async sql => { assert.equal(sql, 'SELECT DATABASE() AS databaseName'); return [[{ databaseName: 'wrong' }]]; },
    end: async () => { closed = true; },
  }) }), /DATABASE_IDENTITY_MISMATCH/);
  assert.equal(closed, true);
});

function harness(initial = [], failCreate = 0) {
  const names = [...initial]; const calls = []; let closed = false; let creates = 0;
  return { names, calls, closed: () => closed, connect: async () => ({
    execute: async (sql, params) => {
      calls.push(sql);
      if (sql === 'SELECT DATABASE() AS databaseName') return [[{ databaseName: 'signal_evidence_uat' }]];
      if (sql.startsWith('CREATE TABLE')) {
        if (++creates === failCreate) throw new Error('Synthetic interrupted DDL');
        names.push(sql.match(/^CREATE TABLE (\w+)/)[1]); return [{}];
      }
      assert.deepEqual(params, tableNames);
      const data = fixture(names);
      if (sql.includes('information_schema.TABLES')) return [data.tables];
      if (sql.includes('information_schema.COLUMNS')) return [data.columns];
      if (sql.includes('information_schema.STATISTICS')) return [data.statistics];
      if (sql.includes('information_schema.TABLE_CONSTRAINTS')) return [data.checks];
      throw new Error('Unexpected query');
    }, end: async () => { closed = true; },
  }) };
}
test('apply creates only pinned 0073 tables and verifies afterward', async () => {
  const h = harness();
  const result = await runSchemaGate({ mode: '--apply', source, connect: h.connect });
  assert.equal(result.applied, true); assert.equal(result.compatible, true);
  assert.deepEqual(h.names, tableNames); assert.equal(h.closed(), true);
  assert.equal(h.calls.filter(s => s.startsWith('CREATE TABLE')).length, 3);
  assert.ok(h.calls.every(s => s.startsWith('SELECT ') || s.startsWith('CREATE TABLE deal_evidence_')));
});
test('compatible apply is a read-only no-op', async () => {
  const h = harness(tableNames);
  assert.equal((await runSchemaGate({ mode: '--apply', source, connect: h.connect })).applied, false);
  assert.ok(h.calls.every(s => s.startsWith('SELECT ')));
});
test('partial schema refuses apply with no repairs', async () => {
  const h = harness([tableNames[0]]);
  await assert.rejects(runSchemaGate({ mode: '--apply', source, connect: h.connect }), /EXISTING_SCHEMA_REQUIRES_REVIEW/);
  assert.ok(h.calls.every(s => s.startsWith('SELECT '))); assert.equal(h.closed(), true);
});
test('interrupted apply stops without retry or destructive cleanup', async () => {
  const h = harness([], 2);
  await assert.rejects(runSchemaGate({ mode: '--apply', source, connect: h.connect }), /interrupted/);
  assert.deepEqual(h.names, [tableNames[0]]);
  assert.equal(h.calls.filter(s => s.startsWith('CREATE TABLE')).length, 2);
  assert.ok(h.calls.every(s => s.startsWith('SELECT ') || s.startsWith('CREATE TABLE deal_evidence_')));
  assert.equal(h.closed(), true);
});
