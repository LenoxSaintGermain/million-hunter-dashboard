import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectReleaseSchema, requiredTables, requiredUniqueKeys } from './check-aperture-release-schema.mjs';

const indexes = requiredUniqueKeys.flatMap(([TABLE_NAME, names], index) => names.map((COLUMN_NAME, i) => ({
  TABLE_NAME, INDEX_NAME: `fixture_unique_${index}`, COLUMN_NAME, NON_UNIQUE: 0, SEQ_IN_INDEX: i + 1, SUB_PART: null,
})));

const columns = [
  { TABLE_NAME: 'aperture_decision_runs', COLUMN_NAME: 'context_kind', COLUMN_TYPE: "enum('thesis','objective','discovery')", IS_NULLABLE: 'NO' },
  { TABLE_NAME: 'aperture_decision_runs', COLUMN_NAME: 'client_request_id', COLUMN_TYPE: 'varchar(36)', IS_NULLABLE: 'YES' },
  ...['canonical_thesis_id', 'capital_thesis_id'].map(COLUMN_NAME => ({ TABLE_NAME: 'aperture_decision_runs', COLUMN_NAME, COLUMN_TYPE: 'int', IS_NULLABLE: 'YES' })),
  { TABLE_NAME: 'aperture_decision_revisions', COLUMN_NAME: 'invalidation_rule', COLUMN_TYPE: 'text', IS_NULLABLE: 'YES' },
];
test('accepts the required objective/discovery schema shape', () => {
  assert.equal(inspectReleaseSchema(requiredTables, columns, indexes).compatible, true);
});
test('rejects a schema with the columns but no deduplication indexes', () => {
  assert.equal(inspectReleaseSchema(requiredTables, columns, []).compatible, false);
});
test('rejects the observed pre-objective production shape', () => {
  const result = inspectReleaseSchema([], columns.filter(c => /thesis_id/.test(c.COLUMN_NAME)).map(c => ({ ...c, IS_NULLABLE: 'NO' })));
  assert.equal(result.compatible, false);
  assert.equal(result.missing.length, 20);
});
for (const [label, change] of [
  ['nonunique', row => ({ ...row, NON_UNIQUE: 1 })],
  ['prefix-only', row => ({ ...row, SUB_PART: 8 })],
  ['wrong column', row => ({ ...row, COLUMN_NAME: 'other_column' })],
]) test(`rejects ${label} deduplication keys`, () => {
  assert.equal(inspectReleaseSchema(requiredTables, columns, indexes.map(change)).compatible, false);
});
test('index metadata ordering does not affect the verdict', () => {
  assert.equal(inspectReleaseSchema(requiredTables, columns, [...indexes].reverse()).compatible, true);
});
for (const name of requiredTables) test(`rejects missing ${name}`, () => {
  assert.equal(inspectReleaseSchema(requiredTables.filter(t => t !== name), columns, indexes).compatible, false);
});
test('rejects objective enum without discovery', () => {
  assert.equal(inspectReleaseSchema(requiredTables, columns.map(c => c.COLUMN_NAME === 'context_kind' ? { ...c, COLUMN_TYPE: "enum('thesis','objective')" } : c), indexes).compatible, false);
});
