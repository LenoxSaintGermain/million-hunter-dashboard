/** Opt-in read-only live check. Never imported by tests, demos, or production. */
import { getMacroOdds, searchTrademarks, searchFederalContractors, searchSecCompanies, getForexRates, getBrandFaviconUrl } from "../server/publicIntelligence";

if (!process.argv.includes("--live") || process.env.DATABASE_URL !== "") {
  throw new Error("Explicitly run with DATABASE_URL= and --live. This checks real public providers.");
}
const results = await Promise.all([
  getMacroOdds({ tagSlug: "economy", limit: 2 }),
  searchTrademarks("Tesla", 2),
  searchFederalContractors("Boeing", 2),
  searchSecCompanies("AAPL", 2),
  getForexRates("USD", ["EUR", "GBP"]),
]);
for (const result of results) {
  console.log(JSON.stringify({ source: result.source, status: result.status, sourceUrl: result.sourceUrl,
    fetchedAt: result.fetchedAt, attemptedAt: result.attemptedAt, message: result.message,
    records: Array.isArray(result.data) ? result.data.length : undefined,
    rateDate: result.data && !Array.isArray(result.data) ? result.data.date : undefined }));
}
const icon = await fetch(getBrandFaviconUrl("apple.com"), { signal: AbortSignal.timeout(8000) });
const iconType = icon.headers.get("content-type");
console.log(JSON.stringify({ source: "favicon.im (decorative only)", status: icon.status, contentType: iconType }));
await icon.body?.cancel();
if (results.some(result => result.status !== "ok") || !icon.ok || !iconType?.startsWith("image/")) process.exitCode = 1;
