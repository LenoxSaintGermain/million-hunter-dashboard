import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { brokerOrders, portfolioAccounts, positions as positionsTable, uatPracticeBooks, users } from "../../../drizzle/schema";
import { ownerProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { alpacaPaperBroker } from "../brokers";
import { configuredOwnerOpenId, sharedAlpacaKeyOwnerOnly } from "../brokers/envBrokerOwner";
import { practiceBooksConfigured, practiceBooksEnabled, practiceBooksMode } from "./flags";
import { readHouseSnapshot } from "./houseSnapshot";
import { HOUSE_ORDER_PAGE, reconcileHouse } from "./reconcile";
import { appendBookAdjustment, createPracticeBook, ensureHouseBaseline, frozenSymbols, listHouseBaselines, maskAccountNumber } from "./repository";

const symbolInput = z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()).refine((value) => /^[A-Z0-9.\-]+$/.test(value), "Use a ticker or option symbol.");
const noteInput = z.string().trim().min(3, "Explain the change in a note.").max(2000);

async function requireHouse() {
  if (!practiceBooksEnabled()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Practice books are off or inert; there is no shared practice account to reconcile." });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "database unavailable" });
  if (!alpacaPaperBroker.available()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: alpacaPaperBroker.unavailableReason() ?? "Alpaca Paper is not configured." });
  return { db, house: await readHouseSnapshot(alpacaPaperBroker) };
}

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

  /**
   * UAT-E4 reconciliation: Σ books vs the house (cached snapshot ≤ 60 s) plus
   * one read of the house's recent orders. Reads only; the one write is the
   * fail-closed freeze of a mismatched symbol's sells (idempotent). Never
   * corrects a book and never places, approves or cancels an order.
   */
  reconciliation: ownerProcedure.query(async ({ ctx }) => {
    const { db, house } = await requireHouse();
    let houseOrders: Awaited<ReturnType<typeof alpacaPaperBroker.getOrders>> | null = null;
    let ordersError: string | null = null;
    try {
      houseOrders = await alpacaPaperBroker.getOrders({ limit: HOUSE_ORDER_PAGE });
    } catch (error) {
      ordersError = `House orders could not be read, so unattributed orders were not checked: ${error instanceof Error ? error.message : String(error)}`;
    }
    const report = await reconcileHouse(db, house, { now: Date.now(), actor: ctx.user.id, houseOrders });
    return { ...report, houseExternalAccountId: report.houseAccount, ordersError };
  }),

  /** Manual sell pause on a symbol for every book (append-only, audited). */
  freezeSymbol: ownerProcedure
    .input(z.object({ symbol: symbolInput, note: noteInput }))
    .mutation(async ({ ctx, input }) => {
      const { db, house } = await requireHouse();
      if ((await frozenSymbols(db, house.externalAccountId)).has(input.symbol)) throw new TRPCError({ code: "CONFLICT", message: `Sells of ${input.symbol} are already paused.` });
      const now = Date.now();
      const { id } = await appendBookAdjustment(db, { bookId: null, kind: "symbol_freeze", symbol: input.symbol, brokerBacked: false, houseExternalAccountId: house.externalAccountId, note: `Owner paused sells: ${input.note}`, createdBy: ctx.user.id, createdAt: now });
      console.warn(`[uat-recon] owner (user ${ctx.user.id}) paused sells of ${input.symbol} on house ${maskAccountNumber(house.externalAccountId)}`);
      return { id, symbol: input.symbol, createdBy: ctx.user.id, createdAt: now };
    }),

  /** Lifts a sell pause. Writes an audited `symbol_unfreeze` row (actor, time, note). */
  unfreezeSymbol: ownerProcedure
    .input(z.object({ symbol: symbolInput, note: noteInput }))
    .mutation(async ({ ctx, input }) => {
      const { db, house } = await requireHouse();
      if (!(await frozenSymbols(db, house.externalAccountId)).has(input.symbol)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Sells of ${input.symbol} aren't paused.` });
      const now = Date.now();
      const { id } = await appendBookAdjustment(db, { bookId: null, kind: "symbol_unfreeze", symbol: input.symbol, brokerBacked: false, houseExternalAccountId: house.externalAccountId, note: input.note, createdBy: ctx.user.id, createdAt: now });
      console.warn(`[uat-recon] owner (user ${ctx.user.id}) resumed sells of ${input.symbol} on house ${maskAccountNumber(house.externalAccountId)}: ${input.note}`);
      return { id, symbol: input.symbol, createdBy: ctx.user.id, createdAt: now };
    }),

  /**
   * Append-only owner adjustment to one book: cash, a corporate action or a
   * reconciliation write-off. Requires a note; nothing is ever edited or deleted.
   */
  appendAdjustment: ownerProcedure
    .input(z.object({
      bookId: z.number().int().positive(),
      kind: z.enum(["cash_adjustment", "corporate_action", "reconciliation_writeoff"]),
      symbol: symbolInput.optional(),
      qty: z.number().finite().optional(),
      priceCents: z.number().int().nonnegative().optional(),
      cashCents: z.number().int().optional(),
      brokerBacked: z.boolean().default(true),
      note: noteInput,
    }).refine((value) => value.cashCents != null || (value.symbol != null && value.qty != null && value.qty !== 0), "Post a cash amount, or a symbol with a quantity."))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "database unavailable" });
      const [book] = await db.select().from(uatPracticeBooks).where(eq(uatPracticeBooks.id, input.bookId)).limit(1);
      if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Practice book not found." });
      const now = Date.now();
      const { id } = await appendBookAdjustment(db, {
        bookId: book.id, kind: input.kind, symbol: input.symbol ?? null, qty: input.qty ?? null, priceCents: input.priceCents ?? null,
        cashCents: input.cashCents ?? null, brokerBacked: input.brokerBacked, houseExternalAccountId: book.houseExternalAccountId,
        note: input.note, createdBy: ctx.user.id, createdAt: now,
      });
      console.warn(`[uat-recon] owner (user ${ctx.user.id}) posted ${input.kind} #${id} to practice book ${book.id}: ${input.note}`);
      return { id, bookId: book.id, kind: input.kind, createdBy: ctx.user.id, createdAt: now };
    }),
});
