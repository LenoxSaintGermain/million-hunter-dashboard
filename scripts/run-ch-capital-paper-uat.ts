import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
import { approveOrder, createOrder, submitOrder } from "../server/aperture/orderFlow";
import { buildOccOptionSymbol, type PaperInstrumentType } from "../shared/paperInstrument";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required.");
const parsed = new URL(DATABASE_URL);
if (process.env.NODE_ENV !== "development" || process.env.ISOLATED_UAT_MODE !== "true"
  || parsed.hostname !== "127.0.0.1" || parsed.port !== "3307"
  || parsed.pathname !== "/capital_aperture_uat_9c18799" || parsed.username !== "uat_app") {
  throw new Error("Refusing to run paper UAT outside the exact isolated CH Capital development database.");
}

const NOW = Date.parse("2026-08-28T14:30:00Z"); // Friday, 10:30 ET regular session.
const DAY = 86_400_000;
const db = await mysql.createConnection(DATABASE_URL);

type Scenario = {
  name: string;
  symbol: string;
  instrumentType: PaperInstrumentType;
  underlyingSymbol?: string;
  optionExpirationDate?: string;
  optionStrikePriceCents?: number;
  qty: number;
  limitPriceCents: number;
  stopPriceCents?: number;
  slippageCents: number;
  holdingPeriod: "intraday" | "position";
  deadlineAt: number;
  timeStopAt?: number;
  noTradeConditions?: string[];
};

const callSymbol = buildOccOptionSymbol({ underlyingSymbol: "NVDA", expirationDate: "2027-01-15", optionType: "call", strikePriceCents: 15_000 })!;
const putSymbol = buildOccOptionSymbol({ underlyingSymbol: "SPY", expirationDate: "2027-01-15", optionType: "put", strikePriceCents: 50_000 })!;

const scenarios: Scenario[] = [
  {
    name: "Intraday shares",
    symbol: "NVDA",
    instrumentType: "shares",
    qty: 4,
    limitPriceCents: 12_500,
    stopPriceCents: 12_200,
    slippageCents: 10,
    holdingPeriod: "intraday",
    deadlineAt: Date.parse("2026-08-28T19:45:00Z"),
    timeStopAt: Date.parse("2026-08-28T19:30:00Z"),
    noTradeConditions: ["Do not open if the verified trigger or liquidity condition is no longer present."],
  },
  {
    name: "Long-term shares",
    symbol: "AAPL",
    instrumentType: "shares",
    qty: 6,
    limitPriceCents: 18_000,
    stopPriceCents: 16_500,
    slippageCents: 10,
    holdingPeriod: "position",
    deadlineAt: NOW + 30 * DAY,
  },
  {
    name: "Long call",
    symbol: callSymbol,
    instrumentType: "long_call",
    underlyingSymbol: "NVDA",
    optionExpirationDate: "2027-01-15",
    optionStrikePriceCents: 15_000,
    qty: 1,
    limitPriceCents: 150,
    slippageCents: 5,
    holdingPeriod: "position",
    deadlineAt: NOW + 30 * DAY,
  },
  {
    name: "Long put",
    symbol: putSymbol,
    instrumentType: "long_put",
    underlyingSymbol: "SPY",
    optionExpirationDate: "2027-01-15",
    optionStrikePriceCents: 50_000,
    qty: 1,
    limitPriceCents: 120,
    slippageCents: 5,
    holdingPeriod: "position",
    deadlineAt: NOW + 30 * DAY,
  },
];

async function seedDecisionRun(userId: number, contextAccountId: number, scenario: Scenario): Promise<number> {
  const [runResult] = await db.execute<any>(
    `INSERT INTO aperture_runs
      (user_id, thesis_id, account_id, deployable_capital_cents, intended_trades, holding_period,
       catalyst_deadline_at, liquidity_floor_adv_usd, max_single_name_pct, invalidation_rule,
       mandate_version, status, dropped_note, created_at)
     VALUES (?, 1, ?, 500000, '[]', ?, ?, 1000000, 10, ?, 'v2', 'completed', 'ISOLATED_CH_CAPITAL_EXECUTION_UAT', ?)`,
    [userId, contextAccountId, scenario.holdingPeriod, scenario.deadlineAt, `Reject ${scenario.name} if the stated evidence or risk premise is no longer true.`, NOW],
  );
  const runId = Number(runResult.insertId);
  const [decisionResult] = await db.execute<any>(
    `INSERT INTO aperture_decision_runs
      (user_id, canonical_thesis_id, capital_thesis_id, account_id, research_run_id, lifecycle, lock_version, created_at, updated_at)
     VALUES (?, 1, 1, ?, ?, 'eligible', 0, ?, ?)`,
    [userId, contextAccountId, runId, NOW, NOW],
  );
  const decisionRunId = Number(decisionResult.insertId);
  const mission = `Isolated paper UAT for ${scenario.name}; exact amount, risk, review, approval, submission, fill, and outcome receipt must remain legible.`;
  const [revisionResult] = await db.execute<any>(
    `INSERT INTO aperture_decision_revisions
      (decision_run_id, version, mission_text, mission_hash, mission_source, objective, instrument_preference,
       include_held_research, deployable_capital_cents, max_planned_loss_cents, holding_period,
       invalidation_rule, operator_choice, effective_branch, planned_risk_cents, created_by_user_id, created_at)
     VALUES (?, 1, ?, ?, 'edited', 'best_qualified_play', ?, 0, 500000, 18000, ?, ?, 'selected_play', 'eligible', 0, ?, ?)`,
    [decisionRunId, mission, createHash("sha256").update(mission).digest("hex"), scenario.instrumentType === "shares" ? "shares" : "options", scenario.holdingPeriod, `Invalidate ${scenario.name} when the named evidence or risk condition fails.`, userId, NOW],
  );
  await db.execute("UPDATE aperture_decision_runs SET current_revision_id = ? WHERE id = ?", [Number(revisionResult.insertId), decisionRunId]);
  return runId;
}

try {
  const [[user]] = await db.execute<any[]>("SELECT id FROM users WHERE openId = 'uat_ch_capital_9c18799' LIMIT 1");
  if (!user) throw new Error("Provision the CH Capital isolated identity first.");
  const [[contextAccount]] = await db.execute<any[]>("SELECT id FROM portfolio_accounts WHERE user_id = ? AND broker_id = 'manual' ORDER BY id LIMIT 1", [user.id]);
  const [[executionAccount]] = await db.execute<any[]>("SELECT id FROM portfolio_accounts WHERE user_id = ? AND broker_id = 'uat_paper' ORDER BY id LIMIT 1", [user.id]);
  if (!contextAccount || !executionAccount) throw new Error("Provision both context and isolated execution accounts first.");

  await db.execute("DELETE FROM aperture_pending_outcomes WHERE user_id = ?", [user.id]);
  await db.execute("DELETE FROM position_snapshots WHERE account_id = ?", [executionAccount.id]);
  await db.execute("DELETE FROM broker_orders WHERE user_id = ?", [user.id]);
  await db.execute("DELETE FROM aperture_decision_revisions WHERE decision_run_id IN (SELECT id FROM aperture_decision_runs WHERE user_id = ?)", [user.id]);
  await db.execute("DELETE FROM aperture_decision_runs WHERE user_id = ?", [user.id]);
  await db.execute("DELETE FROM aperture_runs WHERE user_id = ? AND dropped_note = 'ISOLATED_CH_CAPITAL_EXECUTION_UAT'", [user.id]);
  await db.execute("UPDATE portfolio_accounts SET last_synced_at = ?, updated_at = ? WHERE id IN (?, ?)", [NOW, NOW, contextAccount.id, executionAccount.id]);

  for (const symbol of ["NVDA", "AAPL", "SPY"]) {
    await db.execute(
      `INSERT INTO security_facts
       (symbol, fact_key, value_num, value_text, unit, basis, provider_id, source_name, source_url, as_of, fetched_at)
       VALUES (?, 'adv_usd_30d', 500000000, NULL, 'usd', 'verified', 'isolated_uat', 'Isolated UAT fixture', NULL, ?, ?),
              (?, 'last_price', ?, NULL, 'usd', 'verified', 'isolated_uat', 'Isolated UAT fixture', NULL, ?, ?),
              (?, 'sector', NULL, ?, 'none', 'verified', 'isolated_uat', 'Isolated UAT fixture', NULL, ?, ?)`,
      [symbol, NOW, NOW, symbol, symbol === "AAPL" ? 180 : symbol === "SPY" ? 500 : 125, NOW, NOW, symbol, symbol === "SPY" ? "Broad market" : "Technology", NOW, NOW],
    );
  }

  const receipts = [];
  for (const scenario of scenarios) {
    const runId = await seedDecisionRun(user.id, contextAccount.id, scenario);
    const orderId = await createOrder({
      runId,
      accountId: executionAccount.id,
      portfolioContextAccountId: contextAccount.id,
      userId: user.id,
      symbol: scenario.symbol,
      instrumentType: scenario.instrumentType,
      underlyingSymbol: scenario.underlyingSymbol,
      optionExpirationDate: scenario.optionExpirationDate,
      optionStrikePriceCents: scenario.optionStrikePriceCents,
      contractMultiplier: scenario.instrumentType === "shares" ? undefined : 100,
      side: "buy",
      intent: "open",
      qty: scenario.qty,
      orderType: "limit",
      limitPriceCents: scenario.limitPriceCents,
      timeInForce: "day",
      reason: `Isolated paper-only UAT of ${scenario.name} with exact amount and risk controls.`,
      invalidationCondition: `Reject or review ${scenario.name} if the recorded evidence, liquidity, or risk premise fails.`,
      entryPriceCents: scenario.limitPriceCents,
      stopPriceCents: scenario.stopPriceCents,
      slippageCents: scenario.slippageCents,
      timeStopAt: scenario.timeStopAt,
      noTradeConditions: scenario.noTradeConditions,
      holdingPeriod: scenario.holdingPeriod,
      catalystDeadlineAt: scenario.deadlineAt,
      paperAcknowledgement: "PAPER",
      now: NOW,
    });
    await approveOrder(orderId, user.id, "APPROVE PAPER", NOW);
    const filled = await submitOrder(orderId, user.id, "SUBMIT PAPER", NOW);
    if (filled.status !== "filled" || !filled.brokerOrderId?.startsWith("uat-paper-")) throw new Error(`${scenario.name} did not produce a deterministic isolated fill.`);
    receipts.push({
      scenario: scenario.name,
      runId,
      orderId,
      instrumentType: scenario.instrumentType,
      symbol: scenario.symbol,
      quantity: scenario.qty,
      limitPriceCents: scenario.limitPriceCents,
      maximumPlannedLossCents: filled.plannedRiskCents,
      status: filled.status,
      destination: "CH-UAT-PAPER-9C18799",
      confirmations: ["PAPER", "APPROVE PAPER", "SUBMIT PAPER"],
    });
  }

  const [[counts]] = await db.execute<any[]>(
    `SELECT COUNT(*) AS total, SUM(status = 'filled') AS filled,
      SUM(instrument_type = 'shares') AS shares, SUM(instrument_type = 'long_call') AS long_calls,
      SUM(instrument_type = 'long_put') AS long_puts
     FROM broker_orders WHERE user_id = ?`, [user.id],
  );
  const [[pending]] = await db.execute<any[]>("SELECT COUNT(*) AS count FROM aperture_pending_outcomes WHERE user_id = ? AND status = 'pending'", [user.id]);
  console.log(JSON.stringify({
    isolated: true,
    paperOnly: true,
    autoApprovalMode: "test runner typed the same three explicit confirmations; no product bypass",
    receipts,
    counts: { total: Number(counts.total), filled: Number(counts.filled), shares: Number(counts.shares), longCalls: Number(counts.long_calls), longPuts: Number(counts.long_puts), pendingReviews: Number(pending.count) },
  }, null, 2));
} finally {
  await db.end();
}
