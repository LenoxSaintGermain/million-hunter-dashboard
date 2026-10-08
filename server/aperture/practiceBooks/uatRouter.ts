import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { brokerOrders, portfolioAccounts, positions as positionsTable, users } from "../../../drizzle/schema";
import { ownerProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { alpacaPaperBroker } from "../brokers";
import { configuredOwnerOpenId, sharedAlpacaKeyOwnerOnly } from "../brokers/envBrokerOwner";
import { practiceBooksConfigured, practiceBooksEnabled, practiceBooksMode } from "./flags";
import { createPracticeBook, ensureHouseBaseline, listHouseBaselines, maskAccountNumber } from "./repository";

/** Owner-only UAT controls (`aperture.uat.*`). Every procedure is ownerProcedure. */
export const uatRouter = router({
  status: ownerProcedure.query(async () => {
    const db = await getDb();
    const baselines = db ? await listHouseBaselines(db) : [];
    return {
      mode: practiceBooksMode(),
      practiceBooksConfigured: practiceBooksConfigured(),
      sharedKeyOwnerOnly: sharedAlpacaKeyOwnerOnly(),
      ownerConfigured: Boolean(configuredOwnerOpenId()),
      houseBaselines: baselines.map((baseline) => ({ ...baseline, houseExternalAccountId: maskAccountNumber(baseline.houseExternalAccountId) })),
    };
  }),

  /**
   * Records the house starting snapshot now, if this house has none yet. Reads
   * the house account and positions once; never places, approves or cancels an order.
   */
  captureHouseBaseline: ownerProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "database unavailable" });
    if (!alpacaPaperBroker.available()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: alpacaPaperBroker.unavailableReason() ?? "Alpaca Paper is not configured." });
    }
    const [account, positions] = await Promise.all([alpacaPaperBroker.getAccount(), alpacaPaperBroker.getPositions()]);
    if (!account.externalAccountId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Alpaca Paper did not return an account number; no baseline was recorded." });
    const { baseline, created } = await ensureHouseBaseline(db, {
      externalAccountId: account.externalAccountId,
      cashCents: account.cashCents,
      buyingPowerCents: account.buyingPowerCents,
      equityValueCents: account.equityValueCents,
      positions,
    }, ctx.user.id, Date.now());
    return { created, capturedAt: baseline.capturedAt, houseExternalAccountId: maskAccountNumber(baseline.houseExternalAccountId) };
  }),

  /**
   * Converts existing non-owner Alpaca paper rows (created before books) into
   * fresh $100k books. Their earlier orders stay unbooked history. A row with an
   * open order is skipped. The copied house numbers are cleared, so the row shows
   * "not measured" until its next sync reads the book.
   */
  convertTesterAccounts: ownerProcedure.mutation(async ({ ctx }) => {
    if (!practiceBooksEnabled()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Practice books are off or inert; nothing was converted." });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "database unavailable" });
    const rows = await db.select().from(portfolioAccounts)
      .where(and(eq(portfolioAccounts.brokerId, "alpaca_paper"), isNull(portfolioAccounts.practiceBookId)));
    const ownerIds = new Set((await db.select({ id: users.id }).from(users).where(eq(users.openId, ctx.user.openId))).map((row) => row.id));
    ownerIds.add(ctx.user.id);
    const converted: number[] = [];
    const skipped: Array<{ accountId: number; reason: string }> = [];
    for (const row of rows) {
      if (ownerIds.has(row.userId)) continue;
      const open = await db.select({ id: brokerOrders.id }).from(brokerOrders).where(and(
        eq(brokerOrders.accountId, row.id), inArray(brokerOrders.status, ["pending_approval", "approved", "submitted"]),
      ));
      if (open.length) { skipped.push({ accountId: row.id, reason: `${open.length} open order(s)` }); continue; }
      const now = Date.now();
      await db.delete(positionsTable).where(eq(positionsTable.accountId, row.id));
      await db.update(portfolioAccounts).set({
        cashCents: null, buyingPowerCents: null, equityValueCents: null, optionsBuyingPowerCents: null, lastSyncedAt: null, syncError: null, updatedAt: now,
      }).where(eq(portfolioAccounts.id, row.id));
      await createPracticeBook(db, { userId: row.userId, portfolioAccountId: row.id, createdBy: ctx.user.id, now });
      converted.push(row.id);
    }
    console.info(`[uat] owner converted ${converted.length} tester account(s) to practice books; skipped ${skipped.length}`);
    return { converted, skipped };
  }),
});
