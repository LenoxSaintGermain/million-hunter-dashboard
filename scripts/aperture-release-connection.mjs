/** Explicit connection adapter. Importing this file never opens a connection. */
import { createHash } from 'node:crypto';
import { REVIEWED_PLAN_SHA256 } from './aperture-release-executor.mjs';

/** Only exact reviewed statements can reach this separate write adapter. */
export async function openReleaseExecutionConnection({ plan, ...options }) {
  if (plan?.planSha256 !== REVIEWED_PLAN_SHA256 ||
      createHash('sha256').update(JSON.stringify(plan.steps)).digest('hex') !== REVIEWED_PLAN_SHA256) throw Error('Unapproved execution plan');
  const statements = new Map(plan.steps.map(step => [step.id, step.sql]));
  let connection;
  const inspector = await openReleaseConnection({ ...options, connect: async url => {
    connection = await options.connect(url); return connection;
  } });
  return { ...inspector, execute: async (sql, stepId) => {
    if (!statements.has(stepId) || statements.get(stepId) !== sql) throw Error('Statement is outside the approved release');
    await inspector.readTarget();
    await connection.query(sql);
  } };
}
export function releaseTargetFromUrl(connectionUrl) {
  const url = new URL(connectionUrl);
  if (url.protocol !== 'mysql:' || !url.hostname || !url.pathname.slice(1) || !url.username) throw Error('Explicit MySQL target required');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (database.includes('/') || !/^[A-Za-z0-9_-]+$/.test(database)) throw Error('Unexpected database identity');
  return { database, fingerprint: createHash('sha256').update(JSON.stringify([
    url.hostname.toLowerCase(), url.port || '3306', database, decodeURIComponent(url.username),
  ])).digest('hex') };
}

export async function openReleaseConnection({ connectionUrl, expectedFingerprint, connect }) {
  const target = releaseTargetFromUrl(connectionUrl);
  if (target.fingerprint !== expectedFingerprint) throw Error('Configured database does not match approved target');
  const connection = await connect(connectionUrl);
  const rows = async sql => (await connection.execute(sql))[0];
  const readTarget = async () => {
    const [actual] = await rows('SELECT DATABASE() AS databaseName');
    if (actual?.databaseName !== target.database) throw Error('Connected database identity mismatch');
    return target.fingerprint;
  };
  try { await readTarget(); } catch (error) { await connection.end(); throw error; }
  return {
    readTarget,
    captureReceiptRecovery: async () => {
      await readTarget();
      await connection.beginTransaction();
      try {
        const tables = [];
        for (const table of ['aperture_decision_runs', 'aperture_decision_revisions']) {
          const [definition] = await rows(`SHOW CREATE TABLE \`${table}\``);
          const data = await rows(`SELECT * FROM \`${table}\` ORDER BY id LIMIT 50001`);
          if (data.length > 50000) throw Error('Recovery snapshot exceeds bounded capture limit');
          tables.push({ table, ddl: definition['Create Table'], rows: data });
        }
        await readTarget();
        return { targetFingerprint: target.fingerprint, capturedAt: new Date().toISOString(),
          restoreVerified: false, scope: 'Original decision runs and revisions only; not a full database backup', tables };
      } finally { await connection.rollback(); }
    },
    readSchema: async () => {
      await readTarget();
      const tables = (await rows('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')).map(r=>r.TABLE_NAME);
      const columns = await rows('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
      const statistics = await rows('SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,SEQ_IN_INDEX,NON_UNIQUE,SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()');
      // Native MySQL/TiDB JSON needs no alias proof. Only MariaDB aliases need
      // CHECK metadata; do not silently treat arbitrary LONGTEXT as JSON.
      const aliases = columns.some(c=>c.TABLE_NAME.startsWith('aperture_') && c.COLUMN_TYPE === 'longtext');
      const checks = aliases ? await rows("SELECT tc.TABLE_NAME,cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc ON tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME WHERE tc.TABLE_SCHEMA=DATABASE() AND tc.CONSTRAINT_TYPE='CHECK'") : [];
      return { tables, columns, statistics, checks };
    },
    // No free-form execution method is exposed by the inspection adapter.
    close: () => connection.end(),
  };
}
