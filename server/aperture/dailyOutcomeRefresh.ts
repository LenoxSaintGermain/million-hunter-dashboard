import { eq } from "drizzle-orm";
import { aperturePlaySlateItems, aperturePlaySlates, type User } from "../../drizzle/schema";
import type { getDb } from "../db";
import { fetchIntradayBars } from "./providers/marketData";
import { calculatePaperPlayOutcome } from "../../shared/playOutcomeLedger";
import { evaluateIntradayPaperOutcome } from "./playOutcomeEvaluator";
import { closeMinutesFor, etClock, startOfEtDay } from "./marketSession";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type LiveSlate = typeof aperturePlaySlates.$inferSelect;

export const DAILY_OUTCOME_REFRESH_CRON = "0 15 22 * * *";
export const DAILY_OUTCOME_REFRESH_PATH = "/api/scheduled/capital-daily-outcome-refresh";
const MINUTES_AFTER_CLOSE = 15;

export type RefreshEligibility = Pick<LiveSlate, "snapshotBasis" | "status" | "sessionDateEt">;

/**
 * Historical reconstructions are deliberately excluded. A live slate becomes due
 * after its source market day has closed plus a small tape-settlement buffer, or
 * on any later ET date. This makes retries safe and never guesses intraday state.
 */
export function isDailyOutcomeRefreshEligible(slate: RefreshEligibility, now: number): boolean {
  if (slate.snapshotBasis !== "live_capture" || slate.status === "complete") return false;
  const clock = etClock(now);
  if (!clock) return false;
  if (slate.sessionDateEt < clock.dateEt) return true;
  if (slate.sessionDateEt > clock.dateEt) return false;
  return clock.etMinutes >= closeMinutesFor(clock.dateEt) + MINUTES_AFTER_CLOSE;
}

/** Evaluates only a captured live slate's own source-session tape; it has no broker dependency. */
export async function refreshLiveSlateOutcomes(db: Db, slate: LiveSlate, now = Date.now()) {
  if (slate.snapshotBasis !== "live_capture") {
    throw new Error("Historical reconstructions are fixed postmortems and cannot refresh live outcomes.");
  }
  const sessionStartAt = startOfEtDay(slate.capturedAt);
  if (sessionStartAt == null) {
    throw new Error("The captured ET session cannot be determined, so no outcome was refreshed.");
  }
  const sessionEndAt = sessionStartAt + 24 * 60 * 60_000;
  const items = await db.select().from(aperturePlaySlateItems).where(eq(aperturePlaySlateItems.slateId, slate.id));
  let terminalCount = 0;
  for (const item of items) {
    const snapshot = item.recommendationSnapshot as any;
    const play = snapshot?.play;
    if (!play) continue;
    const tape = await fetchIntradayBars(item.symbol, { startMs: slate.capturedAt, timeoutMs: 5_000, maxPages: 3 });
    const windowBars = tape.bars.filter((bar) => bar.t >= slate.capturedAt && bar.t < sessionEndAt);
    const evaluation = evaluateIntradayPaperOutcome({
      side: play.side === "short" ? "short" : "long",
      entryPriceCents: play.entry?.priceCents ?? null,
      stopPriceCents: play.stop?.priceCents ?? null,
      timeStopAt: play.timeStopAt ?? null,
    }, windowBars, now);
    const outcome = calculatePaperPlayOutcome({
      side: play.side === "short" ? "short" : "long",
      entryPriceCents: play.entry?.priceCents ?? null,
      stopPriceCents: play.stop?.priceCents ?? null,
      slippageCents: play.slippage?.priceCents ?? null,
      plannedRiskCents: play.plannedLossCents ?? null,
      notionalCents: play.notionalCents ?? null,
      timeStopAt: play.timeStopAt ?? null,
      noTradeConditions: Array.isArray(play.noTradeConditions) ? play.noTradeConditions : [],
    }, {
      ...evaluation,
      basis: windowBars.length && !tape.unavailableReason ? "verified" : "unknown",
      providerId: windowBars.length ? "alpaca" : null,
      sourceUrl: windowBars.length ? `https://app.alpaca.markets/trade/${encodeURIComponent(item.symbol)}` : null,
      observedAt: windowBars.length ? windowBars[windowBars.length - 1]!.t : null,
      unavailableReason: evaluation.unavailableReason ?? tape.unavailableReason,
    });
    if (outcome.status !== "pending") terminalCount++;
    await db.update(aperturePlaySlateItems).set({
      outcomeStatus: outcome.status,
      outcomeResult: outcome.result,
      triggerObservation: evaluation.trigger,
      exitObservation: evaluation.exit,
      entryPriceCents: outcome.entryPriceCents,
      settlementPriceCents: outcome.settlementPriceCents,
      returnBps: outcome.returnBps,
      rMultiple: outcome.rMultiple,
      outcomeBasis: outcome.basis,
      outcomeProviderId: windowBars.length ? "alpaca" : null,
      outcomeSourceUrl: windowBars.length ? `https://app.alpaca.markets/trade/${encodeURIComponent(item.symbol)}` : null,
      observedAt: windowBars.length ? windowBars[windowBars.length - 1]!.t : null,
      outcomeExplanation: outcome.explanation,
      computedAt: now,
      updatedAt: now,
    }).where(eq(aperturePlaySlateItems.id, item.id));
  }
  await db.update(aperturePlaySlates).set({
    status: terminalCount === items.length ? "complete" : "awaiting_outcome",
    updatedAt: now,
  }).where(eq(aperturePlaySlates.id, slate.id));
  return { refreshed: items.length, terminalCount };
}

/** Idempotently refreshes only due, live-captured paper slates owned by one user. */
export async function refreshDueLiveOutcomesForUser(db: Db, userId: number, now = Date.now()) {
  const candidates = await db.select().from(aperturePlaySlates)
    .where(eq(aperturePlaySlates.userId, userId));
  const due = candidates.filter((slate) => isDailyOutcomeRefreshEligible(slate, now));
  const outcomes = [] as Array<{ slateId: number; refreshed: number; terminalCount: number }>;
  for (const slate of due) {
    const refreshed = await refreshLiveSlateOutcomes(db, slate, now);
    outcomes.push({ slateId: slate.id, ...refreshed });
  }
  return { dueSlates: due.length, outcomes };
}

export function formatDailyOutcomeRefreshResult(result: { dueSlates: number; outcomes: Array<{ slateId: number; refreshed: number; terminalCount: number }> }) {
  const terminal = result.outcomes.reduce((sum, outcome) => sum + outcome.terminalCount, 0);
  const observed = result.outcomes.reduce((sum, outcome) => sum + outcome.refreshed, 0);
  return `${result.dueSlates} due live slate${result.dueSlates === 1 ? "" : "s"}; ${terminal} of ${observed} paper outcomes terminal.`;
}
