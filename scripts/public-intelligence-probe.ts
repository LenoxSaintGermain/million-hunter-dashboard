/** Opt-in live provider reads with budget writes only to the fixed isolated DB.
 * Never imported by tests, demos, or production. Never loads .env.
 */
import {
  getMacroOdds,
  searchTrademarks,
  searchFederalContractors,
  searchSecCompanies,
  getForexRates,
  getBrandFaviconUrl,
} from "../server/publicIntelligence";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";

if (
  !process.argv.includes("--live") ||
  process.env.DATABASE_URL !== "" ||
  process.env.NODE_ENV !== "development"
) {
  throw new Error(
    "Explicitly run with NODE_ENV=development DATABASE_URL= and --live. Provider reads use isolated local DB budgets only."
  );
}
if (
  !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(process.env.SEC_USER_AGENT?.trim() ?? "")
) {
  throw new Error(
    "Set SEC_USER_AGENT with your real application/contact identity before live probing."
  );
}
const { pool, db } = openEvidenceUatDatabase();
const repository = createEvidenceRepository(async () => db);
const feedAccess = { reserve: (provider: import("../server/publicIntelligence").FeedProvider) => repository.reserveFeedProvider(provider) };
try {
  console.log(
    "LOCAL PROBE · live public-provider reads · isolated database budget writes · no production database or orders"
  );
  const results = await Promise.all([
    getMacroOdds({ tagSlug: "economy", limit: 2 }, feedAccess),
    searchTrademarks("Tesla", 2, feedAccess),
    searchFederalContractors("Boeing", 2, feedAccess),
    searchSecCompanies("AAPL", 2, {
      reserve: () => repository.reserveSecProviderBudget(),
      cooldown: until => repository.setSecCooldown(until),
    }),
    getForexRates("USD", ["EUR", "GBP"], feedAccess),
  ]);
  for (const result of results) {
    console.log(
      JSON.stringify({
        source: result.source,
        status: result.status,
        sourceUrl: result.sourceUrl,
        fetchedAt: result.fetchedAt,
        attemptedAt: result.attemptedAt,
        message: result.message,
        records: Array.isArray(result.data) ? result.data.length : undefined,
        rateDate:
          result.data && !Array.isArray(result.data)
            ? result.data.date
            : undefined,
      })
    );
  }
  const icon = await fetch(getBrandFaviconUrl("apple.com"), {
    signal: AbortSignal.timeout(8000),
  });
  const iconType = icon.headers.get("content-type");
  console.log(
    JSON.stringify({
      source: "favicon.im (decorative only)",
      status: icon.status,
      contentType: iconType,
    })
  );
  await icon.body?.cancel();
  if (
    results.some(result => result.status !== "ok") ||
    !icon.ok ||
    !iconType?.startsWith("image/")
  )
    process.exitCode = 1;
} finally {
  await pool.end();
}
