/** Frozen 0073 metadata verifier. No dotenv or receipt reads.
 * Apply accepts only the pinned three additive CREATEs on a fully absent schema.
 * CLI accepts only the fixed disposable UAT database, never DATABASE_URL targets.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REVIEWED_SHA256 = 'd4b3eb09c96a375948f89f16618c78e91e77c18ea72e4438f06773936ae31581';
const column = (type, nullable = false) => ({ type, nullable });
const common = { id: column('varchar(36)'), owner_id: column('int'), deal_id: column('int') };
const index = (columns, unique = false) => ({ columns, unique });
// Frozen 0073 contract. Prompt version belongs inside input_snapshot JSON.
export const expectedSchema = {
  deal_evidence_attachments: {
    columns: { ...common, request_id: column('varchar(36)'), receipt_id: column('varchar(36)'),
      payload_hash: column('varchar(64)'), confirmed_cik: column('varchar(10)'),
      relation: column("enum('same_legal_entity')"), identity_basis: column('varchar(64)'), created_at: column('datetime(3)') },
    indexes: { PRIMARY: index(['id'], true), deal_evidence_attachment_request_uq: index(['owner_id', 'request_id'], true),
      deal_evidence_attachment_deal_idx: index(['owner_id', 'deal_id', 'created_at', 'id']) },
  },
  deal_evidence_analysis_requests: {
    columns: { ...common, request_id: column('varchar(36)'), request_hash: column('varchar(64)'),
      mode: column("enum('red_team','ic')"), models: column('json'), input_snapshot: column('json'), started_at: column('datetime(3)') },
    indexes: { PRIMARY: index(['id'], true), deal_evidence_analysis_request_uq: index(['owner_id', 'request_id'], true),
      deal_evidence_analysis_deal_idx: index(['owner_id', 'deal_id', 'started_at', 'id']) },
  },
  deal_evidence_analysis_results: {
    columns: { ...common, status: column("enum('complete','failed')"), output: column('json', true),
      failure_code: column('varchar(64)', true), message: column('varchar(1000)', true), completed_at: column('datetime(3)') },
    indexes: { PRIMARY: index(['id'], true) },
  },
};
export const tableNames = Object.keys(expectedSchema);
const normalizeType = value => String(value).toLowerCase().replace(/^int\(\d+\)$/, 'int');
export function inspectPd06Schema({ tables = [], columns = [], statistics = [], checks = [] }) {
  const report = tableNames.map(name => {
    const spec = expectedSchema[name];
    const matches = tables.filter(t => t.TABLE_NAME === name);
    const issues = [];
    if (!matches.length) issues.push('table_absent');
    else if (matches.length !== 1 || matches[0].TABLE_TYPE !== 'BASE TABLE' || String(matches[0].ENGINE).toLowerCase() !== 'innodb') issues.push('requires_innodb_base_table');
    const cols = columns.filter(c => c.TABLE_NAME === name);
    for (const [key, expected] of Object.entries(spec.columns)) {
      const found = cols.filter(c => c.COLUMN_NAME === key);
      const actual = found[0];
      const jsonAlias = expected.type === 'json' && actual?.COLUMN_TYPE === 'longtext'
        && actual.COLLATION_NAME === 'utf8mb4_bin' && checks.some(c => c.TABLE_NAME === name
          && String(c.CHECK_CLAUSE).replace(/[`\s()]/g, '').toLowerCase() === `json_valid${key}`);
      if (found.length !== 1 || !(normalizeType(actual?.COLUMN_TYPE) === expected.type || jsonAlias)
        || actual.IS_NULLABLE !== (expected.nullable ? 'YES' : 'NO')
        || ![null, 'NULL'].includes(actual.COLUMN_DEFAULT) || actual.EXTRA) issues.push(`column_mismatch:${key}`);
    }
    for (const c of cols) if (!Object.hasOwn(spec.columns, c.COLUMN_NAME)) issues.push(`unexpected_column:${c.COLUMN_NAME}`);
    const indexes = statistics.filter(i => i.TABLE_NAME === name);
    for (const [key, expected] of Object.entries(spec.indexes)) {
      const rows = indexes.filter(i => i.INDEX_NAME === key).sort((a, b) => Number(a.SEQ_IN_INDEX) - Number(b.SEQ_IN_INDEX));
      if (rows.length !== expected.columns.length || !rows.every((r, i) => r.COLUMN_NAME === expected.columns[i]
        && Number(r.SEQ_IN_INDEX) === i + 1 && r.NON_UNIQUE != null && Number(r.NON_UNIQUE) === (expected.unique ? 0 : 1)
        && r.SUB_PART == null && r.INDEX_TYPE === 'BTREE' && r.COLLATION === 'A')) issues.push(`index_mismatch:${key}`);
    }
    for (const i of indexes) if (!Object.hasOwn(spec.indexes, i.INDEX_NAME)) issues.push(`unexpected_index:${i.INDEX_NAME}`);
    return { name, present: matches.length > 0, issues: [...new Set(issues)] };
  });
  const present = report.filter(t => t.present).length;
  const orphan = !present && [columns, statistics, checks].some(rows => rows.some(r => tableNames.includes(r.TABLE_NAME)));
  const state = !present && !orphan ? 'absent' : report.every(t => !t.issues.length) ? 'compatible' : present < tableNames.length && !orphan ? 'partial' : 'conflict';
  return { state, compatible: state === 'compatible', tables: report };
}

export async function readMetadata(connection) {
  const placeholders = tableNames.map(() => '?').join(',');
  const query = async sql => (await connection.execute(sql, tableNames))[0];
  const tables = await query(`SELECT TABLE_NAME,TABLE_TYPE,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${placeholders})`);
  const columns = await query(`SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${placeholders})`);
  const statistics = await query(`SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,SEQ_IN_INDEX,NON_UNIQUE,SUB_PART,INDEX_TYPE,COLLATION FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${placeholders})`);
  const checks = await query(`SELECT tc.TABLE_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME WHERE tc.TABLE_SCHEMA=DATABASE() AND tc.TABLE_NAME IN (${placeholders}) AND tc.CONSTRAINT_TYPE='CHECK'`);
  return { tables, columns, statistics, checks };
}
export async function runSchemaGate({ mode, source, connect }) {
  if (!['--read-only', '--apply'].includes(mode)) throw new Error('INVALID_MODE');
  const observedMigrationSha256 = createHash('sha256').update(source).digest('hex');
  if (observedMigrationSha256 !== REVIEWED_SHA256) throw new Error('MIGRATION_HASH_MISMATCH');
  const statements = String(source).split('\n').filter(line => !line.trim().startsWith('--')).join('\n').split(';').map(s => s.trim()).filter(Boolean);
  if (statements.length !== tableNames.length || statements.some((s, i) => !s.startsWith(`CREATE TABLE ${tableNames[i]} (`))) throw new Error('MIGRATION_SCOPE_INVALID');
  let connection;
  try {
    connection = await connect();
    const assertTarget = async () => {
      const [[row]] = await connection.execute('SELECT DATABASE() AS databaseName');
      if (row?.databaseName !== 'signal_evidence_uat') throw new Error('DATABASE_IDENTITY_MISMATCH');
    };
    await assertTarget();
    let report = inspectPd06Schema(await readMetadata(connection));
    let applied = false;
    if (mode === '--apply' && !report.compatible) {
      if (report.state !== 'absent') throw new Error('EXISTING_SCHEMA_REQUIRES_REVIEW');
      for (const statement of statements) { await assertTarget(); await connection.execute(statement); }
      report = inspectPd06Schema(await readMetadata(connection));
      if (!report.compatible) throw new Error('POST_APPLY_VERIFICATION_FAILED');
      applied = true;
    }
    return { mode, applied, releaseReady: false, reviewedMigrationSha256: REVIEWED_SHA256,
      observedMigrationSha256, ...report };
  } finally { await connection?.end(); }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--read-only', '--apply'].includes(args[0])) throw new Error('INVALID_MODE');
  if (process.env.DATABASE_URL !== '' || process.env.NODE_ENV !== 'development') throw new Error('EXPLICIT_LOCAL_UAT_ENV_REQUIRED');
  const { default: mysql } = await import('mysql2/promise');
  const source = readFileSync(new URL('../drizzle/0073_deal_evidence_analysis.sql', import.meta.url));
  const report = await runSchemaGate({ mode: args[0], source, connect: () => mysql.createConnection({
    host: '127.0.0.1', port: 13372, user: 'root', password: 'isolated-uat-only', database: 'signal_evidence_uat', timezone: 'Z',
  }) });
  console.log(JSON.stringify(report, null, 2));
  if (!report.compatible) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('PD06_SCHEMA_CHECK_FAILED: DDL may be partial; inspect metadata. No automatic repair or cleanup performed.'); process.exitCode = 1; });
}
