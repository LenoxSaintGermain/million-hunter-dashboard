/** 0072 only. No dotenv, customer reads, repair, DROP, or unrelated DDL.
 * Usage: DATABASE_URL=<explicit target> node scripts/sec-evidence-schema.mjs --read-only|--apply
 * DDL is not transactional: an interrupted apply requires manual review, never auto-cleanup.
 * Exit 0 means compatible; absent/partial/conflict read-only reports exit 1.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REVIEWED_SHA256 = '3109bf4165e0e0151d2300f4bd383d4b14cd4309bd22ea30615591b77c0dfd66';
const column = (type, nullable = false, defaultValue = null) => ({ type, nullable, defaultValue });
export const expectedSchema = {
  public_evidence_receipts: {
    columns: {
      id: column('varchar(36)'), owner_id: column('int'), subject_key: column('varchar(17)'),
      request_id: column('varchar(36)'), provider: column("enum('sec-submissions')"),
      schema_version: column('int'), source_url: column('varchar(512)'),
      status: column("enum('ok','empty','unavailable')"), payload: column('json'),
      payload_hash: column('varchar(64)'), recorded_at: column('datetime(3)'),
      retrieved_at: column('datetime(3)', true), expires_at: column('datetime(3)', true),
      message: column('text', true), failure_code: column('varchar(64)', true),
    },
    indexes: {
      PRIMARY: { unique: true, columns: ['id'] },
      public_evidence_owner_request_uq: { unique: true, columns: ['owner_id', 'request_id'] },
      public_evidence_owner_subject_time_idx: { unique: false, columns: ['owner_id', 'subject_key', 'recorded_at', 'id'] },
    },
  },
  public_evidence_budgets: {
    columns: {
      budget_key: column('varchar(64)'), window_start: column('bigint'), request_count: column('int'),
      second_start: column('bigint'), second_count: column('int'), cooldown_until: column('bigint', false, '0'),
    },
    indexes: { PRIMARY: { unique: true, columns: ['budget_key'] } },
  },
  public_evidence_capture_claims: {
    columns: { owner_id: column('int'), request_id: column('varchar(36)'), subject_key: column('varchar(17)'), started_at: column('datetime(3)') },
    indexes: { PRIMARY: { unique: true, columns: ['owner_id', 'request_id'] } },
  },
};
export const tableNames = Object.keys(expectedSchema);
class GateError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new GateError(code); };
const normalizeType = type => String(type).toLowerCase().replace(/^(int|bigint)\(\d+\)$/, '$1');
const normalizeDefault = value => value == null || value === 'NULL' ? null : String(value).replace(/^'(.*)'$/, '$1');

export function inspectSecEvidenceSchema({ tables = [], columns = [], statistics = [], checks = [] }) {
  const report = tableNames.map(name => {
    const spec = expectedSchema[name];
    const table = tables.find(t => t.TABLE_NAME === name);
    const issues = [];
    const actualColumns = columns.filter(c => c.TABLE_NAME === name);
    const actualIndexes = statistics.filter(i => i.TABLE_NAME === name);
    if (!table) issues.push('table_absent');
    else if (table.TABLE_TYPE !== 'BASE TABLE' || String(table.ENGINE).toLowerCase() !== 'innodb') issues.push('requires_innodb_base_table');
    const columnReport = Object.entries(spec.columns).map(([key, expected]) => {
      const matches = actualColumns.filter(c => c.COLUMN_NAME === key);
      const actual = matches[0];
      const jsonAlias = expected.type === 'json' && actual?.COLUMN_TYPE === 'longtext'
        && actual.COLLATION_NAME === 'utf8mb4_bin' && checks.some(c => c.TABLE_NAME === name
          && String(c.CHECK_CLAUSE).replace(/[`\s()]/g, '').toLowerCase() === 'json_validpayload');
      const compatible = matches.length === 1 && (normalizeType(actual.COLUMN_TYPE) === expected.type || jsonAlias)
        && actual.IS_NULLABLE === (expected.nullable ? 'YES' : 'NO')
        && normalizeDefault(actual.COLUMN_DEFAULT) === expected.defaultValue
        && !actual.EXTRA;
      if (!compatible) issues.push(`column_mismatch:${key}`);
      return { name: key, expected, present: !!actual, type: actual?.COLUMN_TYPE ?? null, compatible: !!compatible };
    });
    for (const c of actualColumns) if (!Object.hasOwn(spec.columns, c.COLUMN_NAME)) issues.push(`unexpected_column:${c.COLUMN_NAME}`);
    const indexReport = Object.entries(spec.indexes).map(([key, expected]) => {
      const rows = actualIndexes.filter(i => i.INDEX_NAME === key).sort((a, b) => Number(a.SEQ_IN_INDEX) - Number(b.SEQ_IN_INDEX));
      const compatible = rows.length === expected.columns.length && rows.every((r, i) =>
        r.COLUMN_NAME === expected.columns[i] && Number(r.SEQ_IN_INDEX) === i + 1
        && r.NON_UNIQUE != null && Number(r.NON_UNIQUE) === (expected.unique ? 0 : 1) && r.SUB_PART == null
        && r.INDEX_TYPE === 'BTREE' && r.COLLATION === 'A');
      if (!compatible) issues.push(`index_mismatch:${key}`);
      return { name: key, ...expected, fullColumns: compatible, compatible };
    });
    for (const i of actualIndexes) if (!Object.hasOwn(spec.indexes, i.INDEX_NAME)) issues.push(`unexpected_index:${i.INDEX_NAME}`);
    return { name, present: !!table, compatible: issues.length === 0, columns: columnReport, indexes: indexReport, issues: [...new Set(issues)] };
  });
  const present = report.filter(t => t.present).length;
  // Orphan metadata must not authorize writes even if TABLES is inconsistent.
  const orphan = !present && (columns.some(c => tableNames.includes(c.TABLE_NAME)) || statistics.some(i => tableNames.includes(i.TABLE_NAME)));
  const state = !present && !orphan ? 'absent' : report.every(t => t.compatible) ? 'compatible' : present < 3 && !orphan ? 'partial' : 'conflict';
  return { state, compatible: state === 'compatible', tables: report };
}

export function reviewedStatements(source) {
  if (createHash('sha256').update(source).digest('hex') !== REVIEWED_SHA256) fail('MIGRATION_HASH_MISMATCH');
  const statements = String(source).split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';').map(s => s.trim()).filter(Boolean);
  if (statements.length !== 3 || statements.some((s, i) => !s.startsWith(`CREATE TABLE ${tableNames[i]} (`))) fail('MIGRATION_SCOPE_INVALID');
  return statements;
}

export async function readMetadata(connection) {
  const placeholders = tableNames.map(() => '?').join(',');
  const query = async sql => (await connection.execute(sql, tableNames))[0];
  const tables = await query(`SELECT TABLE_NAME,TABLE_TYPE,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${placeholders})`);
  const columns = await query(`SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${placeholders})`);
  const statistics = await query(`SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,SEQ_IN_INDEX,NON_UNIQUE,SUB_PART,INDEX_TYPE,COLLATION FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${placeholders})`);
  const checks = columns.some(c => c.COLUMN_NAME === 'payload' && c.COLUMN_TYPE === 'longtext')
    ? await query(`SELECT tc.TABLE_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME WHERE tc.TABLE_SCHEMA=DATABASE() AND tc.TABLE_NAME IN (${placeholders}) AND tc.CONSTRAINT_TYPE='CHECK'`)
    : [];
  return { tables, columns, statistics, checks };
}

export async function runSchemaGate({ mode, databaseUrl, source, connect }) {
  if (!['--read-only', '--apply'].includes(mode) || !databaseUrl) fail('EXPLICIT_MODE_AND_DATABASE_URL_REQUIRED');
  let target;
  try { target = new URL(databaseUrl); } catch { fail('INVALID_DATABASE_URL'); }
  if (target.protocol !== 'mysql:' || !target.hostname || !target.username || !/^\/[A-Za-z0-9_-]+$/.test(target.pathname)) fail('INVALID_DATABASE_URL');
  const statements = reviewedStatements(source); // Verify before connecting, including read-only mode.
  let connection;
  try {
    connection = await connect(databaseUrl);
    const assertTarget = async () => {
      const [[row]] = await connection.execute('SELECT DATABASE() AS databaseName');
      if (row?.databaseName !== target.pathname.slice(1)) fail('DATABASE_IDENTITY_MISMATCH');
    };
    await assertTarget();
    const before = inspectSecEvidenceSchema(await readMetadata(connection));
    if (mode === '--read-only' || before.compatible) return { mode, applied: false, migrationSha256: REVIEWED_SHA256, ...before };
    if (before.state !== 'absent') fail('EXISTING_SCHEMA_REQUIRES_REVIEW');
    // No IF NOT EXISTS: a competing migration must cause an error, not be adopted.
    for (const statement of statements) {
      await assertTarget();
      await connection.execute(statement);
    }
    const after = inspectSecEvidenceSchema(await readMetadata(connection));
    if (!after.compatible) fail('POST_APPLY_VERIFICATION_FAILED');
    return { mode, applied: true, migrationSha256: REVIEWED_SHA256, ...after };
  } finally { await connection?.end(); }
}

export function sanitizedError(error) {
  return { ok: false, error: error instanceof GateError ? error.code : 'SCHEMA_OPERATION_FAILED',
    action: 'Inspect metadata before retrying. DDL may have partially completed; no automatic repair or rollback is performed.' };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--read-only', '--apply'].includes(args[0]) || !process.env.DATABASE_URL) fail('EXPLICIT_MODE_AND_DATABASE_URL_REQUIRED');
  const source = readFileSync(new URL('../drizzle/0072_public_evidence_receipts.sql', import.meta.url));
  const { default: mysql } = await import('mysql2/promise');
  const report = await runSchemaGate({ mode: args[0], databaseUrl: process.env.DATABASE_URL, source,
    connect: url => mysql.createConnection(url) });
  console.log(JSON.stringify(report, null, 2));
  if (!report.compatible) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(JSON.stringify(sanitizedError(error))); process.exitCode = 1; });
}
