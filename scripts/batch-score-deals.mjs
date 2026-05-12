/**
 * Batch score all deals that don't have a score yet.
 * Run: node scripts/batch-score-deals.mjs
 */
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

function scoreCapitalStackCompatibility(deal) {
  const askingPrice = deal.askingPrice ?? 0;
  const cashFlow = deal.cashFlow ?? 0;
  const multiple = deal.multiple ?? (askingPrice / (cashFlow || 1));
  const sbaEligible = askingPrice <= 5_000_000;
  const sbaScore = sbaEligible ? 0.9 : 0.4;
  const dscr = cashFlow > 0 && askingPrice > 0
    ? cashFlow / (askingPrice * 0.1)
    : 0;
  const dscrScore = dscr >= 1.25 ? 1 : dscr >= 1.0 ? 0.7 : 0.3;
  return sbaScore * 0.5 + dscrScore * 0.5;
}

function scoreOperationalAlpha(deal) {
  const industry = (deal.industry ?? '').toLowerCase();
  const highAlpha = ['hvac', 'plumbing', 'pest control', 'cleaning', 'electrical', 'logistics', 'landscaping'];
  const hasAlpha = highAlpha.some(kw => industry.includes(kw));
  return hasAlpha ? 0.75 : 0.45;
}

function scoreDeal(deal) {
  const cashFlow = deal.cashFlow ?? 0;
  const revenue = deal.revenue ?? 0;
  const askingPrice = deal.askingPrice ?? 1;
  const multiple = deal.multiple ?? (askingPrice / (cashFlow || 1));

  const marginScore = revenue > 0 ? Math.min(1, cashFlow / revenue / 0.4) : 0;
  const multipleScore = multiple > 0 ? Math.max(0, 1 - (multiple - 2) / 4) : 0;
  const sizeScore = cashFlow >= 1_000_000 ? 1 : cashFlow >= 500_000 ? 0.7 : cashFlow >= 250_000 ? 0.4 : 0.2;
  const financialScore = marginScore * 0.4 + multipleScore * 0.35 + sizeScore * 0.25;

  const industryBonus = ['hvac', 'plumbing', 'pest control', 'cleaning', 'logistics', 'healthcare', 'electrical'].some(
    kw => (deal.industry ?? '').toLowerCase().includes(kw)
  ) ? 0.8 : 0.5;

  const dealScore = multiple <= 3 ? 1 : multiple <= 4 ? 0.7 : 0.4;
  const capitalStackScore = scoreCapitalStackCompatibility(deal);
  const operationalAlphaScore = scoreOperationalAlpha(deal);
  const macroArbitrageScore = 0.55; // reasonable default for SE/SW US service businesses

  const score =
    0.40 * financialScore +
    0.20 * industryBonus +
    0.10 * dealScore +
    0.15 * capitalStackScore +
    0.10 * operationalAlphaScore +
    0.05 * macroArbitrageScore;

  const redFlagCount = [
    multiple > 5,
    cashFlow < 300_000,
    (deal.employees ?? 0) > 100,
  ].filter(Boolean).length;

  return { score: Math.min(1, Math.max(0, score)), redFlagCount };
}

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  const [deals] = await conn.query('SELECT * FROM deals');
  
  let scored = 0;
  let highPriority = 0;
  
  for (const deal of deals) {
    const { score, redFlagCount } = scoreDeal(deal);
    await conn.query(
      'UPDATE deals SET score = ?, red_flag_count = ? WHERE id = ?',
      [score, redFlagCount, deal.id]
    );
    console.log(`✓ ${deal.name}: ${(score * 100).toFixed(1)}% (${redFlagCount} red flags)`);
    scored++;
    if (score >= 0.8) highPriority++;
  }
  
  console.log(`\n✅ Scored ${scored} deals. HIGH PRIORITY (≥0.8): ${highPriority}`);
  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
