import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const sql = fs.readFileSync(path.join(projectRoot, 'drizzle/0028_capital_aperture.sql'), 'utf8');

  // Split on semicolons, strip comment lines, keep only non-empty SQL
  const executableStatements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => {
      // Remove comment lines and check if anything executable remains
      const stripped = s.split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
      return stripped.length > 0;
    });

  console.log(`Applying ${executableStatements.length} statements from 0028_capital_aperture.sql ...`);
  let ok = 0;
  let skipped = 0;

  for (const stmt of executableStatements) {
    try {
      await conn.execute(stmt);
      ok++;
    } catch (e) {
      if (
        e.code === 'ER_TABLE_EXISTS_ERROR' ||
        e.code === 'ER_DUP_KEYNAME' ||
        (e.message && e.message.includes('already exists'))
      ) {
        skipped++;
      } else {
        console.error('FAILED:', e.message);
        console.error('STMT:', stmt.substring(0, 120));
        await conn.end();
        process.exit(1);
      }
    }
  }

  console.log(`Done. Applied: ${ok}  Skipped (already exist): ${skipped}`);
  await conn.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
