import { appRouter } from "../server/routers.ts";
import { getDb } from "../server/db.ts";
import { apertureRuns, portfolioAccounts } from "../drizzle/schema.ts";
import { and, eq } from "drizzle-orm";

const USER = {
  id: 1,
  openId: "Goh4vGbFA3JEi9ThwWspxn",
  name: "Lenox Saint Germain",
  email: "treble.design@gmail.com",
  loginMethod: "google",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  onboardingCompleted: true,
};

const TRIAL_NAME = "Jim Reference — Catalyst Reaction (Paper Trial)";

const RAW_THESIS = `I only want to research and paper-trade confirmed intraday reactions to dated macroeconomic or company catalysts. I do not anticipate reactions overnight and I do not hold leveraged ETFs overnight. My priority is a housing-data reaction through XHB, a post-earnings opening-range reaction in HD, and one conditional Nasdaq relative-strength branch through either TQQQ or SQQQ. I choose only one housing expression at a time: never both XHB and HD. I choose only one Nasdaq branch: never both TQQQ and SQQQ.

I act only after the stated release or earnings event and only if price confirmation, sustained volume, and VWAP alignment agree. For housing, the catalyst is new residential construction at 8:30 a.m. ET and industrial production at 9:15 a.m. ET. For HD, I wait through the first 30 minutes after the earnings release/call and require an orderly pullback plus an opening-range break aligned with VWAP. For the Nasdaq branch, I require QQQ relative-strength confirmation and a single directional leveraged-ETF branch aligned with VWAP. I skip gapped or disordered opens, repeated VWAP crossings, no sustained volume, and any setup that requires a stop wider than the stated loss budget.

I use only a $2,000–$10,000 short-term research bucket. Planned loss per setup is 0.50%–0.75% of the active bucket. Absolute loss must never exceed 2% of the active bucket. The combined planned loss for one housing play and the Nasdaq play must not exceed 1.25% of the active bucket. Position quantity must be calculated from risk dollars divided by entry-to-stop distance plus a stated slippage allowance; notional cannot substitute for this risk calculation. I close XHB by 3:30 p.m., HD by the close and earlier if the response never develops, and any TQQQ or SQQQ position by 3:45 p.m. ET. A reclaim of the invalidation level cancels the setup or exits the paper position.

I seek liquid U.S. housing, home-improvement, technology, semiconductor, and index ETF expressions of those catalysts. I exclude overnight positions, simultaneous correlated housing exposure, simultaneous leveraged long and short Nasdaq exposure, and any position that lacks a dated catalyst, confirmed price/VWAP/volume evidence, an explicit stop, a time stop, and a current risk calculation. I research no more than three candidate expressions in one catalyst window and prepare at most one paper proposal per active branch.`;

const ctx = { user: USER, req: {}, res: {} };
const caller = appRouter.createCaller(ctx);
const db = await getDb();
if (!db) throw new Error("Database is unavailable");

const [account] = await db.select().from(portfolioAccounts).where(and(
  eq(portfolioAccounts.userId, USER.id),
  eq(portfolioAccounts.label, "Alpaca Paper — AI Thesis"),
  eq(portfolioAccounts.isPaper, true),
)).limit(1);
if (!account) throw new Error("Expected Alpaca Paper research account is unavailable");

const theses = await caller.aperture.thesis.list();
let thesis = theses.find((item) => item.name === TRIAL_NAME);
if (!thesis) {
  const created = await caller.aperture.thesis.create({ name: TRIAL_NAME, rawText: RAW_THESIS });
  thesis = await caller.aperture.thesis.get({ id: created.id });
}

if (!thesis.graph) {
  await caller.aperture.thesis.compile({ id: thesis.id });
  thesis = await caller.aperture.thesis.get({ id: thesis.id });
}

const existingRuns = await caller.aperture.run.list();
const existingRun = existingRuns.find((run) => run.thesisId === thesis.id);
let runId;
if (existingRun) {
  runId = existingRun.id;
  console.log(JSON.stringify({ thesisId: thesis.id, runId, reused: true, orderIntent: "none" }, null, 2));
} else {
  const now = Date.now();
  const started = await caller.aperture.run.start({
    thesisId: thesis.id,
    accountId: account.id,
    deployableCapitalCents: 500_000,
    intendedTrades: [],
    holdingPeriod: "intraday",
    liquidityFloorAdvUsd: 20_000_000,
    catalystDeadlineAt: now + (10 * 60 * 60 * 1000),
    maxSingleNamePct: 5,
    invalidationRule: "Cancel the research-to-action path when price, VWAP, sustained-volume, catalyst timing, or the stated risk budget fails to confirm the proposed intraday setup. This run is research-only and creates no order.",
  });
  runId = started.runId;
  console.log(JSON.stringify({ thesisId: thesis.id, runId, reused: false, orderIntent: "none" }, null, 2));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const active = new Set(["queued", "compiling", "discovering", "researching", "scoring", "constructing"]);
let recovered = false;
for (let poll = 0; poll < 108; poll++) {
  const [run] = await db.select().from(apertureRuns).where(eq(apertureRuns.id, runId)).limit(1);
  if (!run) throw new Error(`Trial run ${runId} disappeared`);
  if (!active.has(run.status)) {
    console.log(JSON.stringify({ thesisId: thesis.id, runId, status: run.status, candidateCount: run.candidateCount, error: run.error, recovered, orderIntent: "none" }, null, 2));
    process.exit(0);
  }
  const elapsed = Date.now() - Number(run.startedAt ?? run.createdAt);
  if (!recovered && elapsed >= 10 * 60_000) {
    const restarted = await caller.aperture.run.retry({ id: runId });
    runId = restarted.runId;
    recovered = true;
    console.log(JSON.stringify({ event: "stale-run-restarted", runId, orderIntent: "none" }, null, 2));
  }
  await sleep(5_000);
}
throw new Error(`Trial run ${runId} did not reach a terminal state within the observation window`);
