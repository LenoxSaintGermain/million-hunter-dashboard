/**
 * Live check of the Alpaca PAPER adapter against the real sandbox.
 *
 * Read-only by default: account, positions, and the live-trading refusal.
 * Pass --order to also submit one notional paper order, which is the only way
 * to prove the execution path end to end. No real money exists in a paper
 * account, and the adapter refuses anything that is not paper.
 *
 *   export PATH="/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH"
 *   npx tsx scripts/verify-alpaca-paper.ts
 *   npx tsx scripts/verify-alpaca-paper.ts --order
 */
import "dotenv/config";
import { alpacaPaperBroker, assertPaperOnly, LiveTradingRefusedError } from "../server/aperture/brokers";

const money = (c: number | null) => (c == null ? "—" : `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

async function main() {
  console.log("Alpaca paper adapter — live verification\n");

  if (!alpacaPaperBroker.available()) {
    console.error(`✗ ${alpacaPaperBroker.unavailableReason()}`);
    process.exit(1);
  }
  console.log("✓ configured (both env vars present)");

  // ── Account ────────────────────────────────────────────────────────────────
  const acct = await alpacaPaperBroker.getAccount();
  console.log("\nACCOUNT");
  console.log(`  id            ${acct.externalAccountId}`);
  console.log(`  cash          ${money(acct.cashCents)}`);
  console.log(`  buying power  ${money(acct.buyingPowerCents)}`);
  console.log(`  equity        ${money(acct.equityValueCents)}`);
  console.log(`  isPaper       ${acct.isPaper}`);
  if (!acct.isPaper) {
    console.error("\n✗ adapter reported a non-paper account — refusing to continue");
    process.exit(1);
  }
  if (acct.cashCents == null || acct.buyingPowerCents == null) {
    console.error("\n✗ account returned null balances — the cents coercion is wrong");
    process.exit(1);
  }

  // ── Positions ──────────────────────────────────────────────────────────────
  const positions = await alpacaPaperBroker.getPositions();
  console.log(`\nPOSITIONS (${positions.length})`);
  for (const p of positions.slice(0, 10)) {
    console.log(`  ${p.symbol.padEnd(8)} qty ${String(p.qty).padStart(10)}  mv ${money(p.marketValueCents)}  last ${money(p.lastPriceCents)}`);
  }
  if (!positions.length) console.log("  (none — a fresh paper account)");

  // ── The refusal that matters ───────────────────────────────────────────────
  let refused = false;
  try {
    assertPaperOnly("Alpaca", false);
  } catch (e) {
    refused = e instanceof LiveTradingRefusedError;
  }
  console.log(`\n✓ live-trading gate refuses non-paper: ${refused}`);
  if (!refused) {
    console.error("✗ the live-trading gate did not fire — stop and fix before anything else");
    process.exit(1);
  }

  // ── Optional order round-trip ──────────────────────────────────────────────
  if (process.argv.includes("--order")) {
    console.log("\nSUBMITTING ONE PAPER ORDER — $1 notional SPY, market, day");
    const res = await alpacaPaperBroker.submitOrder(
      { symbol: "SPY", side: "buy", notionalCents: 100, type: "market", timeInForce: "day" },
      { isPaper: true },
    );
    console.log(`  brokerOrderId ${res.brokerOrderId || "(none)"}`);
    console.log(`  status        ${res.status}`);
    console.log(`  filled        ${res.filledQty ?? "—"} @ ${money(res.filledAvgPriceCents)}`);
    if (res.status === "rejected") {
      console.log(`  raw           ${JSON.stringify(res.raw).slice(0, 300)}`);
      console.log("\n  A rejection is still a working path — read the message above (markets closed, etc).");
    }
  } else {
    console.log("\n(skipped order submission — pass --order to test the execution path)");
  }

  console.log("\nDone. Nothing real was bought or sold.");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✗ verification failed:", e?.message ?? e);
  process.exit(1);
});
