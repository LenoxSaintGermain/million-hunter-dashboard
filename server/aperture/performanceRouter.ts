import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { accountEquitySnapshots, apertureRuns, brokerOrders, capitalTheses, portfolioAccounts, positions } from "../../drizzle/schema";
import { capitalOperatorProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  computeHeadline, computePlanOutcomes, findSeriesGaps, summarizeClosedPlays, totalUnrealizedCents, walkFilledOrders,
  PLAN_TARGET_R, type PerfOrder, type PerfPosition,
} from "./accountPerformance";
import { activeBookForAccount } from "./practiceBooks/repository";

const MAX_SNAPSHOTS = 5000;

/**
 * Read-only account performance. Every row is scoped to the signed-in user; the
 * numbers come from saved syncs and recorded fills, never from live prices. The
 * procedure is mode-agnostic: Quick Play and Strategist differ only in presentation.
 */
export const performanceRouter = router({
  overview: capitalOperatorProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [account] = await db.select().from(portfolioAccounts)
        .where(and(eq(portfolioAccounts.id, input.accountId), eq(portfolioAccounts.userId, ctx.user.id))).limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });

      const book = await activeBookForAccount(db, account);

      // A practice book resets to a new row: only that generation's saves and fills count.
      const snapshotRows = (await db.select({ takenAt: accountEquitySnapshots.takenAt, equityCents: accountEquitySnapshots.equityCents })
        .from(accountEquitySnapshots)
        .where(and(
          eq(accountEquitySnapshots.userId, ctx.user.id),
          eq(accountEquitySnapshots.accountId, account.id),
          book ? eq(accountEquitySnapshots.practiceBookId, book.id) : undefined,
          book ? gt(accountEquitySnapshots.takenAt, book.createdAt - 1) : undefined,
        ))
        .orderBy(desc(accountEquitySnapshots.takenAt)).limit(MAX_SNAPSHOTS)).reverse();

      const orderRows = await db.select({
        id: brokerOrders.id, symbol: brokerOrders.symbol, side: brokerOrders.side,
        filledQty: brokerOrders.filledQty, filledAvgPriceCents: brokerOrders.filledAvgPriceCents,
        entryPriceCents: brokerOrders.entryPriceCents, stopPriceCents: brokerOrders.stopPriceCents,
        plannedRiskCents: brokerOrders.plannedRiskCents, instrumentType: brokerOrders.instrumentType,
        contractMultiplier: brokerOrders.contractMultiplier, filledAt: brokerOrders.filledAt, updatedAt: brokerOrders.updatedAt,
        thesisName: capitalTheses.name,
      }).from(brokerOrders)
        .leftJoin(apertureRuns, and(eq(brokerOrders.runId, apertureRuns.id), eq(apertureRuns.userId, ctx.user.id)))
        .leftJoin(capitalTheses, and(eq(apertureRuns.thesisId, capitalTheses.id), eq(capitalTheses.userId, ctx.user.id)))
        .where(and(
          eq(brokerOrders.userId, ctx.user.id),
          eq(brokerOrders.accountId, account.id),
          book ? eq(brokerOrders.practiceBookId, book.id) : undefined,
          gt(brokerOrders.filledQty, 0),
          isNotNull(brokerOrders.filledAvgPriceCents),
        ));

      const orders: PerfOrder[] = orderRows.map((row) => ({
        id: row.id, symbol: row.symbol, side: row.side === "sell" ? "sell" : "buy",
        filledQty: row.filledQty, filledAvgPriceCents: row.filledAvgPriceCents,
        entryPriceCents: row.entryPriceCents, stopPriceCents: row.stopPriceCents, plannedRiskCents: row.plannedRiskCents,
        multiplier: !row.instrumentType || row.instrumentType === "shares" ? 1 : row.contractMultiplier ?? 100,
        thesisName: row.thesisName, filledAt: row.filledAt ?? row.updatedAt,
      }));

      const positionRows = await db.select().from(positions).where(eq(positions.accountId, account.id));
      const held: PerfPosition[] = positionRows.map((row) => ({
        symbol: row.symbol, qty: row.qty, multiplier: row.assetType === "option" ? 100 : 1,
        avgCostCents: row.avgCostCents, lastPriceCents: row.lastPriceCents, marketValueCents: row.marketValueCents,
      }));

      const now = Date.now();
      const points = snapshotRows;
      const walk = walkFilledOrders(orders);
      const headline = computeHeadline({
        points, now, startingCashCents: book?.startingCashCents ?? null, startingAt: book?.createdAt ?? null,
      });
      const plan = computePlanOutcomes(held, walk.openContexts);
      const stats = summarizeClosedPlays(walk.closedPlays);

      return {
        accountId: account.id,
        accountLabel: account.label,
        isPracticeBook: Boolean(book),
        planTargetR: PLAN_TARGET_R,
        lastSyncedAt: account.lastSyncedAt,
        headline,
        cashCents: account.cashCents,
        unrealizedCents: totalUnrealizedCents(held),
        realizedCents: walk.closedPlays.length || orders.length ? walk.realizedCents : null,
        unattributedSells: walk.unattributedSells,
        plan,
        closed: {
          stats,
          plays: [...walk.closedPlays].sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)),
        },
        series: {
          points,
          gaps: findSeriesGaps(points),
          startingCents: book?.startingCashCents ?? null,
          startingAt: book?.createdAt ?? null,
        },
      };
    }),
});
