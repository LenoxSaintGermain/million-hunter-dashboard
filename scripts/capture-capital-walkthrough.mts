/**
 * Usage: pnpm tsx scripts/capture-capital-walkthrough.mts --run=390002 --version=2026-08-21-glp1-postfix-v2
 *
 * Reads one completed intraday paper-research run and writes one new immutable
 * fixture file. It fails closed on an existing version and never creates an
 * order, proposal, approval, or broker write.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { apertureCandidates, aperturePlayDecisions, apertureRuns, capitalTheses, portfolioAccounts, positions } from "../drizzle/schema";
import { getDb } from "../server/db";
import { fetchIntradayBars } from "../server/aperture/providers/marketData";
import { checkVwapHold, openingRange, sessionVwap } from "../server/aperture/intraday";
import { REGULAR_OPEN, startOfEtDay } from "../server/aperture/marketSession";
import { constructPlay } from "../server/aperture/playConstructor";
import { preflightOrder } from "../server/aperture/orderFlow";
import { CAPITAL_WALKTHROUGH_DISCLOSURE, type CapitalWalkthroughFixture } from "../shared/capitalWalkthrough";

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const runId = Number(arg("run"));
const version = arg("version");
if (!Number.isInteger(runId) || runId <= 0 || !version || !/^[a-z0-9][a-z0-9-]*$/i.test(version)) throw new Error("Usage: --run=<completed run id> --version=<immutable lowercase-hyphen version>");
const captureDirectory = resolve(process.cwd(), "client/src/fixtures/captures");
const capturePath = resolve(captureDirectory, `${version}.ts`);
if (existsSync(capturePath)) throw new Error(`Capture ${version} already exists and is immutable: ${capturePath}`);

const db = await getDb();
if (!db) throw new Error("database unavailable");
const [run] = await db.select().from(apertureRuns).where(eq(apertureRuns.id, runId)).limit(1);
if (!run || run.status !== "completed" || run.holdingPeriod !== "intraday") throw new Error("Capture requires one completed intraday Capital run.");
const [account] = await db.select().from(portfolioAccounts).where(eq(portfolioAccounts.id, run.accountId)).limit(1);
if (!account?.isPaper) throw new Error("Capture requires the run's recorded paper account.");
const [thesis] = await db.select().from(capitalTheses).where(eq(capitalTheses.id, run.thesisId)).limit(1);
const candidates = await db.select().from(apertureCandidates).where(eq(apertureCandidates.runId, run.id));
const decisions = await db.select().from(aperturePlayDecisions).where(eq(aperturePlayDecisions.runId, run.id));
const heldPositions = await db.select().from(positions).where(eq(positions.accountId, account.id));
if (!candidates.length) throw new Error("The completed run has no candidates to capture.");
const selected = [...candidates].sort((a, b) => Number(b.compositeScore ?? 0) - Number(a.compositeScore ?? 0))[0]!;
const now = Date.now();
const dayStart = startOfEtDay(now);
if (dayStart == null) throw new Error("The ET session day could not be determined for capture.");
const tape = await fetchIntradayBars(selected.symbol, { startMs: dayStart, timeoutMs: 4_000, maxPages: 1 });
const vwap = sessionVwap(tape.bars, { feed: tape.feed, now });
const range = openingRange(tape.bars, { sessionOpenAt: dayStart + REGULAR_OPEN * 60_000, minutes: 30, feed: tape.feed, now });
const side = selected.playSide ?? "long";
const trigger = checkVwapHold(tape.bars, vwap, { side: side === "long" ? "above" : "below", minutesRequired: 15, now });
const recipe = constructPlay({ symbol: selected.symbol, side, holdingPeriod: "intraday", bars: tape.bars, vwap, range, trigger, equityCents: account.equityValueCents, sessionDayStartMs: dayStart, catalystDeadlineAt: run.catalystDeadlineAt, now });
const preflightBase = { runId: run.id, candidateId: selected.id, accountId: account.id, userId: run.userId, symbol: selected.symbol, qty: 1, orderType: "limit" as const, limitPriceCents: recipe.entry?.priceCents ?? 1, entryPriceCents: recipe.entry?.priceCents ?? null, stopPriceCents: recipe.stop?.priceCents ?? null, slippageCents: recipe.slippage?.priceCents ?? null, timeStopAt: recipe.timeStopAt, noTradeConditions: recipe.noTradeConditions, holdingPeriod: "intraday", catalystDeadlineAt: run.catalystDeadlineAt, reason: "Captured walkthrough preflight — no order is created.", invalidationCondition: "Captured walkthrough invalidation — no order is created.", paperAcknowledgement: "PAPER", now };
const openPreflight = await preflightOrder({ ...preflightBase, side: side === "long" ? "buy" : "sell", intent: "open" });
const refusedClose = await preflightOrder({ ...preflightBase, side: "sell", intent: "close" });
const fixture: CapitalWalkthroughFixture = {
  version, capturedAt: now,
  source: { runId: run.id, candidateId: selected.id, slateId: null, accountId: account.id, accountLabel: account.label, captureReason: "Real paper research session captured for immutable admin replay." },
  disclosure: CAPITAL_WALKTHROUGH_DISCLOSURE,
  account: { equityValueCents: account.equityValueCents, cashCents: account.cashCents, lastSyncedAt: account.lastSyncedAt, syncSource: account.syncSource, positionCount: heldPositions.length },
  thesis: { name: thesis?.name ?? "Captured Capital thesis", holdingPeriod: run.holdingPeriod, catalystDeadlineAt: run.catalystDeadlineAt },
  today: { cashOutcome: "Cash is the explicit control outcome in the captured session.", expiredPlayCount: null, expiredPlayBasis: "Not measured by this capture source.", queueOrderingBasis: "Captured source queue order." },
  rail: { marketSession: openPreflight.session.session, marketSessionBasis: openPreflight.session.basis, mandateVersion: openPreflight.evaluation.mandateVersion, tightestConstraint: "Not measured by the capture generator.", tightestConstraintBasis: "The capture did not retrieve a cockpit payload.", headroom: {} },
  queue: candidates.map((candidate) => ({ symbol: candidate.symbol, company: candidate.companyName ?? null, compositeScore: candidate.compositeScore == null ? null : Number(candidate.compositeScore), playSide: candidate.playSide ?? null, evidenceSummary: Array.isArray(candidate.verifyFields) && candidate.verifyFields.length ? `${candidate.verifyFields.length} decision-critical evidence check(s) captured.` : "No generated decision-critical check was captured.", decision: decisions.find((decision) => decision.candidateId === candidate.id)?.decision ?? null })),
  selectedPlay: { id: selected.id, symbol: selected.symbol, companyName: selected.companyName ?? null, compositeScore: selected.compositeScore, verifyFields: selected.verifyFields, playSide: selected.playSide ?? null },
  trigger: { ...trigger, captureNow: now, tapeUnavailableReason: tape.unavailableReason ?? null, note: "Preserved exactly as captured; the walkthrough never recomputes this trigger." },
  recipe: recipe as unknown as Record<string, unknown>,
  evidence: { verifiedFields: Array.isArray(selected.verifyFields) ? selected.verifyFields : [], setAside: [], setAsideBasis: "Set-aside rows were not retrieved by this capture version." },
  proposal: { allowed: { evaluation: openPreflight.evaluation, resolvedIntent: openPreflight.resolvedIntent, session: openPreflight.session, note: "Preflight-only capture; no order row was created." }, refused: { evaluation: refusedClose.evaluation, resolvedIntent: refusedClose.resolvedIntent, session: refusedClose.session, note: "Preflight-only capture; no order row was created." }, refusalReason: "A stated close with no provable closing position is deliberately gated as an opening-risk violation or refused outright." },
  outcome: { captured: null, absentReason: "No outcome-ledger row was captured for this source run.", sampleSufficiency: "0 closed trades: this validates the decision process, not an edge." },
};
mkdirSync(captureDirectory, { recursive: true });
writeFileSync(capturePath, `import type { CapitalWalkthroughFixture } from "@shared/capitalWalkthrough";\n\nexport const CAPITAL_WALKTHROUGH_CAPTURE: CapitalWalkthroughFixture = ${JSON.stringify(fixture, null, 2)};\n`, { encoding: "utf8", flag: "wx" });
console.log(`Wrote immutable walkthrough capture: ${capturePath}`);
process.exit(0);
