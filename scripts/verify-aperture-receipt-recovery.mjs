/** Restore a private, hash-identified capture into an owned loopback DB only. */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, lstatSync, openSync, writeFileSync, fsyncSync, closeSync } from 'node:fs';
import mysql from 'mysql2/promise';

const [path, expectedHash] = process.argv.slice(2);
if (process.argv.length !== 4 || !path?.startsWith('/tmp/aperture-receipt-recovery.') ||
    !path.endsWith('/original-receipts.json') || !/^[a-f0-9]{64}$/.test(expectedHash ?? '')) {
  throw Error('Provide the exact private recovery path and SHA-256. No database URL is accepted.');
}
const file = lstatSync(path);
if (!file.isFile() || file.isSymbolicLink() || file.uid !== process.getuid() || (file.mode & 0o077)) throw Error('Recovery file must be private and owned');
const bytes = readFileSync(path);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== expectedHash) throw Error('Recovery artifact hash mismatch');
const snapshot = JSON.parse(bytes);
const names = ['aperture_decision_runs', 'aperture_decision_revisions'];
if (snapshot.tables?.length !== 2 || snapshot.tables.some((t, i) => t.table !== names[i] ||
    !t.ddl.startsWith(`CREATE TABLE \`${names[i]}\` (`) || t.ddl.includes(';') ||
    !Array.isArray(t.rows) || t.rows.length > 50000)) throw Error('Unexpected recovery scope');
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const sql = statement => docker(['exec', '-i', 'sh-ch-capital-uat-db', 'sh', '-c',
  'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot --batch --skip-column-names'], statement);
const container = JSON.parse(docker(['inspect', 'sh-ch-capital-uat-db', '--format', '{{json .}}']));
const ports = container.NetworkSettings?.Ports?.['3306/tcp'];
if (container.Name !== '/sh-ch-capital-uat-db' || !container.State?.Running || ports?.length !== 1 ||
    ports[0].HostIp !== '127.0.0.1' || ports[0].HostPort !== '3307' ||
    !container.Config.Env.includes('MARIADB_DATABASE=capital_aperture_uat_9c18799')) throw Error('Approved loopback container not verified');
const suffix = randomBytes(6).toString('hex');
const database = `capital_recovery_${suffix}`;
const user = `cap_restore_${suffix}`;
const password = randomBytes(32).toString('hex');
let ownedDatabase = false, ownedUser = false, connection;
const proof = { artifactSha256: sha256, targetFingerprint: snapshot.targetFingerprint,
  capturedAt: snapshot.capturedAt, restoreVerified: false, tables: [],
  scope: snapshot.scope, destination: 'Owned disposable loopback MariaDB; not production TiDB',
  databaseRemoved: false, userRemoved: false };
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
try {
  if (sql(`SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${database}';`).trim() ||
      sql(`SELECT User FROM mysql.user WHERE User='${user}';`).trim()) throw Error('Disposable identity collision');
  sql(`CREATE DATABASE \`${database}\`;`); ownedDatabase = true;
  sql(`CREATE USER '${user}'@'%' IDENTIFIED BY '${password}';`); ownedUser = true;
  sql(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${user}'@'%';`);
  connection = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user, password, database });
  for (const table of snapshot.tables) {
    await connection.query(table.ddl);
    const [columns] = await connection.execute('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION', [table.table]);
    const fields = columns.map(c => c.COLUMN_NAME);
    if (fields.some(f => !/^[a-z_]+$/.test(f))) throw Error('Unexpected column identity');
    const jsonFields = [...table.ddl.matchAll(/^\s+`([a-z_]+)` json\b/gm)].map(m => m[1]);
    const normalize = row => Object.fromEntries(fields.map(f => {
      let value = row[f];
      if (typeof value === 'number' && !Number.isSafeInteger(value)) throw Error('Unsafe numeric recovery value');
      if (jsonFields.includes(f) && typeof value === 'string') value = JSON.parse(value);
      return [f, value];
    }));
    const original = table.rows.map(normalize);
    for (const row of table.rows) {
      if (Object.keys(row).length !== fields.length || fields.some(f => !(f in row))) throw Error('Recovery columns differ');
      await connection.execute(`INSERT INTO \`${table.table}\` (${fields.map(f => `\`${f}\``).join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
        fields.map(f => jsonFields.includes(f) && row[f] !== null && typeof row[f] !== 'string' ? JSON.stringify(row[f]) : row[f]));
    }
    const [restored] = await connection.execute(`SELECT * FROM \`${table.table}\` ORDER BY id`);
    if (restored.length !== original.length || digest(restored.map(normalize)) !== digest(original)) throw Error('Restored records do not match capture');
    proof.tables.push({ table: table.table, rows: original.length, contentSha256: digest(original), matched: true });
  }
  proof.restoreVerified = true;
} catch {
  // SQL errors can include original record contents. Never print them.
  process.exitCode = 1;
  proof.failure = 'Restore verification failed; no production operation was attempted';
} finally {
  if (connection) await connection.end();
  if (ownedDatabase) sql(`DROP DATABASE \`${database}\`;`);
  if (ownedUser) sql(`DROP USER '${user}'@'%';`);
  proof.databaseRemoved = ownedDatabase && !sql(`SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${database}';`).trim();
  proof.userRemoved = ownedUser && !sql(`SELECT User FROM mysql.user WHERE User='${user}';`).trim();
  if (!proof.databaseRemoved || !proof.userRemoved) { proof.restoreVerified = false; process.exitCode = 1; }
  proof.verifiedAt = new Date().toISOString();
  const proofPath = path.replace('/original-receipts.json', `/restore-proof-${suffix}.json`);
  const fd = openSync(proofPath, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(proof, null, 2)); fsyncSync(fd); } finally { closeSync(fd); }
  console.log(JSON.stringify({ proofPath, ...proof }));
}
