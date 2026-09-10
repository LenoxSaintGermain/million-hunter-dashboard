/** Read-only deployment gate. No dotenv loading, DDL, or customer-row reads. */
import { pathToFileURL } from 'node:url';

export const requiredTables = [
  'aperture_capital_events', 'aperture_capital_claims',
  'aperture_strategy_discoveries', 'aperture_discovery_selections',
  'aperture_execution_evidence',
];

export const requiredUniqueKeys = [
  ['aperture_decision_runs', ['user_id', 'client_request_id']],
  ['aperture_capital_events', ['user_id', 'source_key']],
  ['aperture_capital_events', ['user_id', 'source_id']],
  ['aperture_capital_events', ['user_id', 'capital_event_id']],
  ['aperture_capital_claims', ['user_id', 'allocation_id']],
  ['aperture_strategy_discoveries', ['job_id', 'attempt']],
  ['aperture_discovery_selections', ['user_id', 'discovery_receipt_id', 'hypothesis_id']],
  ['aperture_discovery_selections', ['research_decision_run_id']],
  ['aperture_discovery_selections', ['capital_thesis_id']],
  ['aperture_execution_evidence', ['user_id', 'request_id']],
];

export function inspectReleaseSchema(tables, columns, statistics = []) {
  const missing = requiredTables.filter(name => !tables.includes(name))
    .map(name => `Missing table: ${name}`);
  function column(table, name, valid, description) {
    const found = columns.find(c => c.TABLE_NAME === table && c.COLUMN_NAME === name);
    if (!found || !valid(found)) missing.push(`${table}.${name}: ${description}`);
  }
  column('aperture_decision_runs', 'context_kind', c =>
    c.COLUMN_TYPE === "enum('thesis','objective','discovery')" && c.IS_NULLABLE === 'NO',
  'requires non-null thesis/objective/discovery enum');
  column('aperture_decision_runs', 'client_request_id', c =>
    c.COLUMN_TYPE === 'varchar(36)' && c.IS_NULLABLE === 'YES', 'requires nullable varchar(36)');
  for (const name of ['canonical_thesis_id', 'capital_thesis_id']) {
    column('aperture_decision_runs', name, c => c.IS_NULLABLE === 'YES', 'must permit objective-led missions without an invented thesis');
  }
  column('aperture_decision_revisions', 'invalidation_rule', c => c.IS_NULLABLE === 'YES',
    'must permit unresolved objective-led invalidation');
  const groups = new Map();
  for (const row of statistics) {
    const key = JSON.stringify([row.TABLE_NAME, row.INDEX_NAME]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const [table, names] of requiredUniqueKeys) {
    const found = [...groups.values()].some(rows => {
      const ordered = [...rows].sort((a, b) => Number(a.SEQ_IN_INDEX) - Number(b.SEQ_IN_INDEX));
      return ordered.length === names.length && ordered.every((row, i) =>
        row.TABLE_NAME === table && Number(row.NON_UNIQUE) === 0 && row.SUB_PART == null
        && Number(row.SEQ_IN_INDEX) === i + 1 && row.COLUMN_NAME === names[i]);
    });
    if (!found) missing.push(`${table}: requires full-column UNIQUE (${names.join(', ')})`);
  }
  return { compatible: missing.length === 0, missing,
    scope: '0065–0069 table presence, objective-context columns and deduplication keys; not exhaustive schema or migration-history verification' };
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--read-only' || !process.env.DATABASE_URL) {
    throw new Error('Provide DATABASE_URL explicitly and use --read-only. This script does not load .env or apply migrations.');
  }
  const { default: mysql } = await import('mysql2/promise');
  let connection;
  try {
    connection = await mysql.createConnection(process.env.DATABASE_URL);
    const [tables] = await connection.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
    const [columns] = await connection.execute("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('aperture_decision_runs','aperture_decision_revisions')");
    const [statistics] = await connection.execute('SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()');
    const report = inspectReleaseSchema(tables.map(t => t.TABLE_NAME), columns, statistics);
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), readOnly: true, ...report }, null, 2));
    if (!report.compatible) process.exitCode = 1;
  } finally { await connection?.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Connection errors can contain addresses or credentials; never print them.
    console.error(JSON.stringify({ readOnly: true, compatible: false, error: error.code ?? 'schema_check_failed' }));
    process.exitCode = 1;
  });
}
