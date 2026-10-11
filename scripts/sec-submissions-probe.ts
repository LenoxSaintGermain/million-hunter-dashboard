/**
 * Explicit opt-in, read-only, single-request probe. No dotenv, DB or key access.
 * Supply a real SEC_USER_AGENT via the environment and one confirmed CIK:
 * DATABASE_URL= pnpm exec tsx scripts/sec-submissions-probe.ts --live 320193
 */
import { fetchSecSubmissions } from "../server/secSubmissions";

async function main() {
  const [flag, cik, ...extra] = process.argv.slice(2);
  if (flag !== "--live" || !cik || extra.length) {
    console.error(
      "Usage: sec-submissions-probe.ts --live <CIK>; requires configured SEC_USER_AGENT."
    );
    process.exitCode = 2;
    return;
  }
  const result = await fetchSecSubmissions(cik);
  // Deliberately omit identity configuration and raw provider/error bodies.
  console.log(
    JSON.stringify(
      {
        ...result,
        filingCount: result.filings.length,
        filings: result.filings.slice(0, 3),
      },
      null,
      2
    )
  );
  if (result.status === "unavailable") process.exitCode = 1;
}
void main();
