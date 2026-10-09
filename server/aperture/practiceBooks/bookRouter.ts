import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brokerOrders, portfolioAccounts, type PortfolioAccount } from "../../../drizzle/schema";
import { capitalOperatorProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { alpacaPaperBroker, brokerFor } from "../brokers";
import { isDeploymentOwner } from "../brokers/envBrokerOwner";
import { toLedgerOrder } from "../brokers/practiceBook";
import { practiceBooksEnabled } from "./flags";
import { readHouseSnapshot } from "./houseSnapshot";
import { computeBookLedger } from "./ledger";
import { activeBookForAccount, createPracticeBook, DEFAULT_BOOK_STARTING_CASH_CENTS, listBookAdjustments, maskAccountNumber, PracticeBookResetConflict } from "./repository";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Orders that still belong to the book's working state: proposals and orders working at Alpaca. */
export const BOOK_OPEN_ORDER_STATUSES = ["pending_approval", "approved", "submitted"] as const;

export interface PracticeBookSummary {
  bookId: number;
  generation: number;
  status: "active" | "frozen" | "archived";
  frozenReason: string | null;
  startingCashCents: number;
  openedAt: number;
  /** The book equity from the last sync of this book; null until it is measured. */
  equityValueCents: number | null;
  pnlSinceStartCents: number | null;
  openOrderCount: number;
  heldSymbols: string[];
  /** The shared house account, masked to its last 4. */
  houseAccount: string | null;
  resetBlockedReason: string | null;
}

export function resetBlockedReason(openOrderCount: number, heldSymbols: string[]): string | null {
  if (heldSymbols.length) return `Close your positions first (${heldSymbols.join(", ")}). Reset needs a flat book.`;
  if (openOrderCount) return `Close your positions first: ${openOrderCount} order${openOrderCount === 1 ? " is" : "s are"} still open. Wait for ${openOrderCount === 1 ? "it" : "them"} to fill or expire, or reject pending proposals.`;
  return null;
}

/** A cheap, DB-only summary for the account card. Never reads the house. */
export async function practiceBookSummary(db: Db, row: PortfolioAccount): Promise<PracticeBookSummary | null> {
  const book = await activeBookForAccount(db, row);
  if (!book) return null;
  const orders = await db.select().from(brokerOrders).where(eq(brokerOrders.practiceBookId, book.id));
  const adjustments = await listBookAdjustments(db, book.id);
  const ledger = computeBookLedger({ startingCashCents: book.startingCashCents, adjustments, orders: orders.map(toLedgerOrder), mark: () => null });
  const openOrderCount = orders.filter((order) => (BOOK_OPEN_ORDER_STATUSES as readonly string[]).includes(order.status)).length;
  const heldSymbols = ledger.positions.filter((position) => Math.abs(position.brokerBackedQty) > 1e-9).map((position) => position.symbol).sort();
  // Equity counts only once the row has been synced since this book opened.
  const measured = row.lastSyncedAt != null && row.lastSyncedAt >= book.createdAt && row.equityValueCents != null;
  return {
    bookId: book.id,
    generation: book.generation,
    status: book.status,
    frozenReason: book.frozenReason ?? null,
    startingCashCents: book.startingCashCents,
    openedAt: book.createdAt,
    equityValueCents: measured ? row.equityValueCents : null,
    pnlSinceStartCents: measured ? row.equityValueCents! - book.startingCashCents : null,
    openOrderCount,
    heldSymbols,
    houseAccount: maskAccountNumber(book.houseExternalAccountId ?? row.externalAccountId),
    resetBlockedReason: resetBlockedReason(openOrderCount, heldSymbols),
  };
}

/**
 * Testers see the shared house account only masked to its last 4 (UAT-E3).
 * The owner, and rows without a book, see the stored value unchanged.
 */
export function presentAccountRow<T extends { practiceBookId?: number | null; externalAccountId: string | null }>(row: T, viewerOpenId: string | null | undefined): T {
  if (row.practiceBookId == null || isDeploymentOwner(viewerOpenId)) return row;
  return { ...row, externalAccountId: maskAccountNumber(row.externalAccountId) };
}

/** Tester practice-book actions (`aperture.practiceBook.*`), scoped to the caller's own rows. */
export const practiceBookRouter = router({
  /**
   * Archives the current book and opens a fresh $100k generation. Refused while
   * the book holds broker-backed shares or has open orders. Old orders keep
   * their book id, so Record and the scorecard keep the history. Reads the
   * house at most once (cached); never places, approves or cancels an order.
   */
  reset: capitalOperatorProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "database unavailable" });
      if (!practiceBooksEnabled()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Practice books are off on this deployment." });
      const [row] = await db.select().from(portfolioAccounts)
        .where(and(eq(portfolioAccounts.id, input.accountId), eq(portfolioAccounts.userId, ctx.user.id))).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      const book = await activeBookForAccount(db, row);
      if (!book || row.brokerId !== "alpaca_paper") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This account has no practice book to reset." });
      if (book.status === "archived") throw new TRPCError({ code: "CONFLICT", message: "This practice book was already reset." });

      let currentHouse: string | null = null;
      try {
        currentHouse = (await readHouseSnapshot(alpacaPaperBroker)).externalAccountId;
      } catch {
        // House unreachable: reset still works; the next sync binds and measures the new book.
      }
      // A book from a previous house can't trade (E2 refuses it), so its shares
      // and orders can never be closed here; it may be archived as it stands.
      // The row's own binding counts too: a never-synced converted book has no
      // houseExternalAccountId but its row can still hold an old account number.
      const houseChanged = Boolean(currentHouse && (
        (book.houseExternalAccountId && book.houseExternalAccountId !== currentHouse) ||
        (row.externalAccountId && row.externalAccountId !== currentHouse)
      ));
      if (!houseChanged) {
        const summary = await practiceBookSummary(db, row);
        if (summary?.resetBlockedReason) throw new TRPCError({ code: "PRECONDITION_FAILED", message: summary.resetBlockedReason });
      }

      const now = Date.now();
      let bookId: number;
      try {
        ({ bookId } = await createPracticeBook(db, {
          userId: ctx.user.id, portfolioAccountId: row.id, createdBy: ctx.user.id, now,
          generation: book.generation + 1,
          resetFrom: { bookId: book.id, clearExternalAccountId: houseChanged },
        }));
      } catch (error) {
        if (error instanceof PracticeBookResetConflict) throw new TRPCError({ code: "CONFLICT", message: error.message });
        throw error;
      }
      console.info(`[uat] practice book ${book.id} archived by its tester; account ${row.id} now uses book ${bookId} (generation ${book.generation + 1})${houseChanged ? ", unbound from the previous house" : ""}`);

      // Measure the new book through the same adapter a sync uses, so Today, the
      // cockpit and the ceiling read the fresh $100k book straight away. After a
      // house change the row is unbound; "Refresh balances" rebinds it with the
      // usual binding checks.
      let measured = false;
      if (currentHouse && !houseChanged) {
        try {
          const account = await brokerFor("alpaca_paper", row.id, { practiceBookId: bookId }).getAccount();
          const syncedAt = Date.now();
          await db.update(portfolioAccounts).set({
            cashCents: account.cashCents,
            buyingPowerCents: account.buyingPowerCents,
            equityValueCents: account.equityValueCents,
            lastSyncedAt: syncedAt,
            syncSource: "alpaca_paper",
            syncError: null,
            updatedAt: syncedAt,
          }).where(and(eq(portfolioAccounts.id, row.id), eq(portfolioAccounts.userId, ctx.user.id)));
          measured = true;
        } catch {
          // Leave the row unsynced; "Refresh balances" measures it.
        }
      }
      return { archivedBookId: book.id, bookId, generation: book.generation + 1, startingCashCents: DEFAULT_BOOK_STARTING_CASH_CENTS, measured };
    }),
});
