import 'dotenv/config';
import mysql from 'mysql2/promise';

// All tables and indexes introduced by 0028_capital_aperture.sql
const EXPECTED_TABLES = [
  'portfolio_accounts',
  'positions',
  'securities',
  'security_facts',
  'aperture_runs',
  'aperture_candidates',
  'aperture_strategies',
  'exposure_nodes',
  'exposure_coverage',
];

const EXPECTED_INDEXES: Record<string, string[]> = {
  positions:           ['positions_account_idx', 'positions_symbol_idx'],
  security_facts:      ['security_facts_symbol_key_idx', 'security_facts_expiry_idx'],
  aperture_runs:       ['aperture_runs_user_idx'],
  aperture_candidates: ['aperture_candidates_run_idx'],
  aperture_strategies: ['aperture_strategies_run_idx'],
  exposure_nodes:      ['exposure_nodes_thesis_idx'],
  exposure_coverage:   ['exposure_coverage_run_idx'],
};

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // 1. Check tables exist
  const [rows] = await conn.execute<mysql.RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${EXPECTED_TABLES.map(() => '?').join(',')})`,
    EXPECTED_TABLES
  );
  const foundTables = new Set(rows.map(r => r.TABLE_NAME as string));

  let allOk = true;
  for (const t of EXPECTED_TABLES) {
    if (foundTables.has(t)) {
      console.log(`  ✓  ${t}`);
    } else {
      console.error(`  ✗  MISSING TABLE: ${t}`);
      allOk = false;
    }
  }

  // 2. Check indexes exist
  for (const [table, indexes] of Object.entries(EXPECTED_INDEXES)) {
    const [idxRows] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME IN (${indexes.map(() => '?').join(',')})`,
      [table, ...indexes]
    );
    const foundIdx = new Set(idxRows.map(r => r.INDEX_NAME as string));
    for (const idx of indexes) {
      if (foundIdx.has(idx)) {
        console.log(`  ✓  ${table}.${idx}`);
      } else {
        console.error(`  ✗  MISSING INDEX: ${table}.${idx}`);
        allOk = false;
      }
    }
  }

  await conn.end();

  if (allOk) {
    console.log('\n✅  0028_capital_aperture schema verified — all 9 tables and 11 indexes present.');
    process.exit(0);
  } else {
    console.error('\n❌  Schema verification FAILED — see missing items above.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
