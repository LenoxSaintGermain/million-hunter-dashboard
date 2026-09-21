import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { apertureCandidates, apertureDecisionRuns, apertureDecisionRevisions, apertureRuns, portfolioAccounts, brokerOrders, aperturePlayDecisions } from "../../drizzle/schema";
import { capitalOperatorProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorizeDecisionAction } from "./decisionRunway";
import { createOrder, preflightOrder, LIVE_ORDER_STATUSES, type CreateOrderInput } from "./orderFlow";
import { normalizeStringList } from "../../shared/stringList";
import { marketSession } from "./marketSession";
import { PAPER_ACKNOWLEDGEMENT } from "./mandate";
import type { ConstructedPlay } from "./playConstructor";

const identity = z.object({
  runId: z.number().int().positive(), candidateId: z.number().int().positive(),
  accountId: z.number().int().positive(), decisionRunId: z.number().int().positive(),
  decisionRevisionId: z.number().int().positive(), budgetCents: z.number().int().min(100).max(100_000_000),
}).strict();
type Selection = z.infer<typeof identity>;
type Context = { user: { id: number; openId?: string } };
type Recipe = Pick<ConstructedPlay, "readiness" | "entry" | "stop" | "slippage" | "qty" | "targets" | "timeStopAt" | "feed" | "unavailableReasons" | "noTradeConditions" | "tapeBasis"> & { trigger: { state: string; lagMs: number | null; lastPrice: number | null } | null };
type Dependencies = {
  construct: (ctx: Context, input: { runId: number; candidateId: number }) => Promise<{ play: Recipe | null; disclosure: string }>;
  evidenceBlock: (db: Awaited<ReturnType<typeof getDb>>, userId: number, runId: number, candidateId: number) => Promise<string | null>;
};
function fail(message: string): never { throw new TRPCError({ code: "PRECONDITION_FAILED", message }); }
const sourceUrls = (value: unknown) => normalizeStringList(value).filter(url => {
  try { return new URL(url).protocol === "https:"; } catch { return false; }
});

/** Tighten a measured recipe. A larger budget never increases the recipe's risk ceiling. */
export function sizeQuickPlay(input: { budgetCents: number; missionCapitalCents: number; missionRiskCents: number;
  recipeQty: number; entryCents: number; stopCents: number; slippageCents: number }) {
  if (Object.values(input).some(n => !Number.isSafeInteger(n) || n < 0)
    || input.entryCents <= input.stopCents || input.stopCents <= 0) return null;
  const unitRisk = input.entryCents - input.stopCents + input.slippageCents;
  const qty = Math.min(input.recipeQty, Math.floor(Math.min(input.budgetCents, input.missionCapitalCents) / input.entryCents),
    Math.floor(input.missionRiskCents / unitRisk));
  return qty > 0 ? { qty, notionalCents: qty * input.entryCents, plannedLossCents: qty * unitRisk } : null;
}

/** Join identity first. Never independently choose the newest account, run or plan. */
async function rowsFor(userId: number, selection?: Selection) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Your saved research could not be loaded. Try again." });
  const rows = await db.select({ candidate: apertureCandidates, run: apertureRuns, decision: apertureDecisionRuns,
    revision: apertureDecisionRevisions, account: portfolioAccounts })
    .from(apertureCandidates)
    .innerJoin(apertureRuns, eq(apertureRuns.id, apertureCandidates.runId))
    .innerJoin(apertureDecisionRuns, eq(apertureDecisionRuns.researchRunId, apertureRuns.id))
    .innerJoin(apertureDecisionRevisions, and(eq(apertureDecisionRevisions.id, apertureDecisionRuns.currentRevisionId), eq(apertureDecisionRevisions.decisionRunId, apertureDecisionRuns.id)))
    .innerJoin(portfolioAccounts, and(eq(portfolioAccounts.id, apertureDecisionRuns.accountId), eq(portfolioAccounts.id, apertureRuns.accountId)))
    .where(and(eq(apertureRuns.userId, userId), eq(apertureDecisionRuns.userId, userId), eq(portfolioAccounts.userId, userId),
      eq(apertureRuns.status, "completed"), ...(selection ? [
        eq(apertureRuns.id, selection.runId), eq(apertureCandidates.id, selection.candidateId),
        eq(portfolioAccounts.id, selection.accountId), eq(apertureDecisionRuns.id, selection.decisionRunId),
        eq(apertureDecisionRevisions.id, selection.decisionRevisionId),
      ] : [])))
    .orderBy(desc(apertureCandidates.rankScore), desc(apertureCandidates.id)).limit(selection ? 1 : 120);
  return { db, rows };
}
type Row = Awaited<ReturnType<typeof rowsFor>>["rows"][number];
function researchBlock(row: Row, now: number): string | null {
  if (!row.account.isPaper) return "Quick Plays currently support practice accounts only.";
  if (row.run.holdingPeriod !== "intraday" || row.revision.holdingPeriod !== "intraday" || row.candidate.playSide !== "long"
    || row.revision.instrumentPreference === "options" || row.run.instrumentPreference === "options")
    return "This first Quick Play flow supports recorded intraday long-share ideas. Open research for other strategies.";
  if (row.candidate.memoStatus !== "ok" || !sourceUrls(row.candidate.citations).length)
    return "This idea needs sourced research before a Quick Play can be prepared.";
  if (!normalizeStringList(row.candidate.verifyFields).length)
    return "This idea has no recorded evidence checklist. Review its research first.";
  if (row.run.catalystDeadlineAt == null || row.run.catalystDeadlineAt <= now)
    return "This idea's review window is missing or has passed. Reassess its research.";
  if (row.decision.lifecycle === "closed") return "This plan is closed. Start a new plan to reassess it.";
  if (row.revision.selectedCandidateId != null && row.revision.selectedCandidateId !== row.candidate.id)
    return "Another idea is selected in this plan. Review the plan before switching ideas.";
  return null;
}
const reviewUrl = (s: Selection) => `/aperture/run/${s.runId}?candidate=${s.candidateId}&view=evidence&decisionRunId=${s.decisionRunId}&decisionRevisionId=${s.decisionRevisionId}&accountId=${s.accountId}`;

export function createQuickPlayRouter(deps: Dependencies) {
  async function preview(ctx: Context, selection: Selection) {
    const { db, rows } = await rowsFor(ctx.user.id, selection);
    const row = rows[0];
    if (!row) fail("Your plan or account changed. Reload Quick Plays and select the idea again. No order was created.");
    const now = Date.now();
    const block = researchBlock(row, now);
    if (block) fail(block);
    await authorizeDecisionAction({ ...selection, userId: ctx.user.id, action: "create_proposal", intent: "open" });
    const evidenceBlock = await deps.evidenceBlock(db, ctx.user.id, selection.runId, selection.candidateId);
    if (evidenceBlock) fail(evidenceBlock);
    if (marketSession(now).session !== "regular") fail("Quick Plays need current regular-session prices. Review the research now, then check again after the market opens.");
    const result = await deps.construct(ctx, selection);
    const play = result.play;
    if (!play || play.readiness !== "constructed" || play.entry?.priceCents == null || play.stop?.priceCents == null
      || play.slippage?.priceCents == null || play.qty == null || play.timeStopAt == null || play.timeStopAt <= now
      || play.feed !== "sip" || play.trigger?.state !== "confirmed" || play.trigger?.lagMs == null
      || play.trigger.lagMs < 0 || play.trigger.lagMs > 120_000 || play.unavailableReasons.length > 0
      || play.trigger.lastPrice == null || Math.round(play.trigger.lastPrice * 100) < play.entry.priceCents) {
      fail(`This idea is not ready for an order. ${play?.unavailableReasons[0] ?? "Fresh market prices and a confirmed entry condition are required."} Open research or check again.`);
    }
    const size = sizeQuickPlay({ budgetCents: selection.budgetCents, missionCapitalCents: row.revision.deployableCapitalCents,
      missionRiskCents: row.revision.maxPlannedLossCents, recipeQty: play.qty, entryCents: play.entry.priceCents,
      stopCents: play.stop.priceCents, slippageCents: play.slippage.priceCents });
    if (!size) fail("Your budget or risk allowance cannot cover one share of this setup. Choose another idea or review your plan; no order was created.");
    const order: CreateOrderInput = { ...selection, userId: ctx.user.id, symbol: row.candidate.symbol, instrumentType: "shares", side: "buy",
      intent: "open", orderType: "limit", timeInForce: "day", qty: size.qty, limitPriceCents: play.entry.priceCents,
      entryPriceCents: play.entry.priceCents, stopPriceCents: play.stop.priceCents, slippageCents: play.slippage.priceCents,
      timeStopAt: play.timeStopAt, noTradeConditions: play.noTradeConditions, holdingPeriod: "intraday",
      reason: row.revision.missionText, invalidationCondition: row.revision.invalidationRule ?? row.run.invalidationRule,
      invalidationPriceCents: play.stop.priceCents, catalystDeadlineAt: row.run.catalystDeadlineAt,
      paperAcknowledgement: PAPER_ACKNOWLEDGEMENT };
    const preflight = await preflightOrder(order);
    const blockers = preflight.evaluation.results.filter(item => !item.passed).map(item => item.detail);
    const fingerprint = createHash("sha256").update(JSON.stringify({ order, targets: play.targets, sources: sourceUrls(row.candidate.citations) })).digest("hex");
    return { order, public: { selection, symbol: row.candidate.symbol, accountLabel: row.account.label, brokerId: row.account.brokerId,
      ...size, entryCents: play.entry.priceCents, stopCents: play.stop.priceCents,
      targets: play.targets, timeStopAt: play.timeStopAt, asOf: now, tapeBasis: play.tapeBasis,
      sources: sourceUrls(row.candidate.citations), reason: row.revision.missionText,
      invalidation: order.invalidationCondition, blockers, ready: preflight.evaluation.passed && !blockers.length,
      fingerprint, reviewUrl: reviewUrl(selection) } };
  }
  return router({
    list: capitalOperatorProcedure.input(z.object({ budgetCents: identity.shape.budgetCents })).query(async ({ ctx, input }) => {
      const { db, rows } = await rowsFor(ctx.user.id);
      const now = Date.now();
      const candidateIds = rows.map(row => row.candidate.id);
      const [orders, decisions] = candidateIds.length ? await Promise.all([
        db.select().from(brokerOrders).where(and(eq(brokerOrders.userId, ctx.user.id), inArray(brokerOrders.candidateId, candidateIds))),
        db.select().from(aperturePlayDecisions).where(and(eq(aperturePlayDecisions.userId, ctx.user.id), inArray(aperturePlayDecisions.candidateId, candidateIds))),
      ]) : [[], []];
      const items: Array<{ selection: Selection; symbol: string; accountLabel: string; sourceCount: number; researchAt: number; reviewUrl: string }> = [];
      let withheld = 0;
      const symbols = new Set<string>();
      for (const row of rows) {
        if (orders.some(order => order.runId === row.run.id && order.candidateId === row.candidate.id && order.intent === "open" && (LIVE_ORDER_STATUSES as readonly string[]).includes(order.status))
          || decisions.some(decision => decision.runId === row.run.id && decision.candidateId === row.candidate.id
            && (decision.decision === "skipped" || decision.resumeAt == null || decision.resumeAt > now))) { withheld++; continue; }
        if (researchBlock(row, now)) { withheld++; continue; }
        const selection = { runId: row.run.id, candidateId: row.candidate.id, accountId: row.account.id,
          decisionRunId: row.decision.id, decisionRevisionId: row.revision.id, budgetCents: input.budgetCents };
        try {
          await authorizeDecisionAction({ ...selection, userId: ctx.user.id, action: "preflight", intent: "open" });
        } catch (error) {
          if (error instanceof Error && error.name === "DecisionRunwayBlockedError") { withheld++; continue; }
          throw error; // Database failures must not look like no qualifying research.
        }
        if (await deps.evidenceBlock(db, ctx.user.id, row.run.id, row.candidate.id)) { withheld++; continue; }
        if (!symbols.has(row.candidate.symbol) && items.length < 3) {
          symbols.add(row.candidate.symbol);
          items.push({ selection, symbol: row.candidate.symbol, accountLabel: row.account.label,
            sourceCount: sourceUrls(row.candidate.citations).length, researchAt: row.candidate.createdAt, reviewUrl: reviewUrl(selection) });
        }
      }
      return { items, withheld, scanned: rows.length, asOf: now, session: marketSession(now).session,
        disclosure: "Saved research, not current trade approval. Check prices and risk before preparing an order." };
    }),
    preview: capitalOperatorProcedure.input(identity).query(async ({ ctx, input }) => (await preview(ctx, input)).public),
    prepare: capitalOperatorProcedure.input(identity.extend({ fingerprint: z.string().length(64), acknowledgement: z.literal("PAPER") }))
      .mutation(async ({ ctx, input }) => {
        const selection = identity.parse({ runId: input.runId, candidateId: input.candidateId, accountId: input.accountId,
          decisionRunId: input.decisionRunId, decisionRevisionId: input.decisionRevisionId, budgetCents: input.budgetCents });
        // Reconcile a retry to the existing candidate lifecycle before recomputing exposure.
        const { db, rows } = await rowsFor(ctx.user.id, selection);
        if (!rows.length) fail("Your plan or account changed. Reload Quick Plays before preparing an order.");
        const existing = await db.select().from(brokerOrders).where(and(eq(brokerOrders.userId, ctx.user.id),
          eq(brokerOrders.runId, input.runId), eq(brokerOrders.candidateId, input.candidateId), eq(brokerOrders.accountId, input.accountId)));
        const active = existing.find(order => order.intent === "open" && (LIVE_ORDER_STATUSES as readonly string[]).includes(order.status));
        if (active) return { orderId: active.id, created: false, url: `/aperture/run/${input.runId}/execute?candidate=${input.candidateId}&order=${active.id}` };
        const checked = await preview(ctx, selection);
        if (checked.public.fingerprint !== input.fingerprint) fail("The order terms changed. Check prices and risk again, then review the updated amounts.");
        if (!checked.public.ready) fail(checked.public.blockers.join(" "));
        const order = await createOrder(checked.order); // Existing locked deduplication and risk authority; never approve or submit here.
        return { ...order, url: `/aperture/run/${input.runId}/execute?candidate=${input.candidateId}&order=${order.orderId}` };
      }),
  });
}
