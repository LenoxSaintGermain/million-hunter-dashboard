import { and, asc, eq, inArray } from "drizzle-orm";
import {
  portfolioAccounts, positions, uatBookAdjustments, uatHouseBaselines, uatPracticeBooks,
  type InsertUatBookAdjustment, type UatBookAdjustment, type UatHouseBaseline, type UatPracticeBook,
} from "../../../drizzle/schema";
import type { getDb } from "../../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Default virtual capital per tester (design §4: $100k, the Alpaca paper default). */
export const DEFAULT_BOOK_STARTING_CASH_CENTS = 10_000_000;
export const DEFAULT_BOOK_PRESET = "fresh_100k";
export const DEFAULT_BOOK_LABEL = "Practice book";

export interface CreatePracticeBookInput {
  userId: number;
  portfolioAccountId: number;
  createdBy: number;
  now: number;
  startingCashCents?: number;
  label?: string;
  scenarioPreset?: string;
  generation?: number;
  houseExternalAccountId?: string | null;
  /**
   * Reset (UAT-E3): archive this book in the same transaction, clear the row's
   * mirrored book numbers, and optionally unbind a previous house account.
   */
  resetFrom?: { bookId: number; clearExternalAccountId: boolean };
}

export class PracticeBookResetConflict extends Error {}

/**
 * Creates a book, records its starting cash as the first (append-only)
 * adjustment, and points the account row at it, in one transaction.
 */
export async function createPracticeBook(db: Db, input: CreatePracticeBookInput): Promise<{ bookId: number }> {
  const startingCashCents = input.startingCashCents ?? DEFAULT_BOOK_STARTING_CASH_CENTS;
  if (!Number.isSafeInteger(startingCashCents) || startingCashCents <= 0) throw new Error("A practice book needs positive starting cash.");
  return db.transaction(async (tx) => {
    if (input.resetFrom) {
      // Old orders keep their practice_book_id; only the book's status changes.
      const [archived] = await tx.update(uatPracticeBooks).set({ status: "archived", archivedAt: input.now, updatedAt: input.now })
        .where(and(
          eq(uatPracticeBooks.id, input.resetFrom.bookId),
          eq(uatPracticeBooks.userId, input.userId),
          eq(uatPracticeBooks.portfolioAccountId, input.portfolioAccountId),
          inArray(uatPracticeBooks.status, ["active", "frozen"]),
        ));
      if (Number((archived as any)?.affectedRows ?? 0) !== 1) throw new PracticeBookResetConflict("This practice book was already reset.");
      await tx.delete(positions).where(eq(positions.accountId, input.portfolioAccountId));
    }
    const [inserted] = await tx.insert(uatPracticeBooks).values({
      userId: input.userId,
      portfolioAccountId: input.portfolioAccountId,
      houseExternalAccountId: input.houseExternalAccountId ?? null,
      label: input.label ?? DEFAULT_BOOK_LABEL,
      scenarioPreset: input.scenarioPreset ?? DEFAULT_BOOK_PRESET,
      startingCashCents,
      status: "active",
      generation: input.generation ?? 1,
      createdBy: input.createdBy,
      createdAt: input.now,
      updatedAt: input.now,
    });
    const bookId = Number((inserted as any).insertId);
    await tx.insert(uatBookAdjustments).values({
      bookId, kind: "starting_cash", cashCents: startingCashCents, brokerBacked: false,
      note: `Book opened with ${(startingCashCents / 100).toFixed(2)} virtual cash (${input.scenarioPreset ?? DEFAULT_BOOK_PRESET}).`,
      createdBy: input.createdBy, createdAt: input.now,
    });
    await tx.update(portfolioAccounts).set({
      practiceBookId: bookId,
      updatedAt: input.now,
      ...(input.resetFrom ? {
        cashCents: startingCashCents, buyingPowerCents: startingCashCents, equityValueCents: startingCashCents,
        optionsBuyingPowerCents: null, lastSyncedAt: null, syncError: null,
        ...(input.resetFrom.clearExternalAccountId ? { externalAccountId: null } : {}),
      } : {}),
    })
      .where(and(eq(portfolioAccounts.id, input.portfolioAccountId), eq(portfolioAccounts.userId, input.userId)));
    return { bookId };
  });
}

/** The account row's current book, or null in broker mode. Scoped to the row's owner. */
export async function activeBookForAccount(db: Db, account: { practiceBookId?: number | null; userId: number }): Promise<UatPracticeBook | null> {
  if (account.practiceBookId == null) return null;
  const [book] = await db.select().from(uatPracticeBooks)
    .where(and(eq(uatPracticeBooks.id, account.practiceBookId), eq(uatPracticeBooks.userId, account.userId))).limit(1);
  return book ?? null;
}

/**
 * Adjustments are append-only: this module exposes insert and read, and nothing
 * in the server updates or deletes a row (enforced by a source test).
 */
export async function appendBookAdjustment(db: Db, input: Omit<InsertUatBookAdjustment, "id">): Promise<{ id: number }> {
  if (!input.note?.trim()) throw new Error("Every practice-book adjustment needs a note.");
  const [inserted] = await db.insert(uatBookAdjustments).values({ ...input, note: input.note.trim() });
  return { id: Number((inserted as any).insertId) };
}

export async function listBookAdjustments(db: Db, bookId: number): Promise<UatBookAdjustment[]> {
  return db.select().from(uatBookAdjustments).where(eq(uatBookAdjustments.bookId, bookId)).orderBy(asc(uatBookAdjustments.id));
}

export interface HouseSnapshotForBaseline {
  externalAccountId: string;
  cashCents: number | null;
  buyingPowerCents: number | null;
  equityValueCents: number | null;
  positions: Array<{ symbol: string; qty: number; avgCostCents: number | null; lastPriceCents: number | null }>;
}

/**
 * Records the UAT house as first seen in practice-book mode (reconciliation
 * baseline). Idempotent per house account: the first capture wins and is never
 * overwritten, so a new house (a re-pointed env key) gets its own baseline.
 */
export async function ensureHouseBaseline(db: Db, snapshot: HouseSnapshotForBaseline, capturedBy: number | null, now: number): Promise<{ baseline: UatHouseBaseline; created: boolean }> {
  const existing = await houseBaseline(db, snapshot.externalAccountId);
  if (existing) return { baseline: existing, created: false };
  try {
    await db.insert(uatHouseBaselines).values({
      houseExternalAccountId: snapshot.externalAccountId,
      cashCents: snapshot.cashCents,
      buyingPowerCents: snapshot.buyingPowerCents,
      equityValueCents: snapshot.equityValueCents,
      positions: snapshot.positions.map(({ symbol, qty, avgCostCents, lastPriceCents }) => ({ symbol, qty, avgCostCents, lastPriceCents })),
      capturedBy,
      capturedAt: now,
    });
  } catch (error) {
    // A concurrent first capture won the unique key; read its row instead.
    const raced = await houseBaseline(db, snapshot.externalAccountId);
    if (raced) return { baseline: raced, created: false };
    throw error;
  }
  const created = await houseBaseline(db, snapshot.externalAccountId);
  if (!created) throw new Error("The UAT house baseline could not be read back after capture.");
  return { baseline: created, created: true };
}

export async function houseBaseline(db: Db, houseExternalAccountId: string): Promise<UatHouseBaseline | null> {
  const [row] = await db.select().from(uatHouseBaselines)
    .where(eq(uatHouseBaselines.houseExternalAccountId, houseExternalAccountId)).limit(1);
  return row ?? null;
}

export async function listHouseBaselines(db: Db): Promise<UatHouseBaseline[]> {
  return db.select().from(uatHouseBaselines).orderBy(asc(uatHouseBaselines.id));
}

/** Masks an account number to its last four characters (never shown in full outside the owner's raw view). */
export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  return `••••${value.slice(-4)}`;
}

/**
 * Symbols whose sells are paused on a house (reconciliation, UAT-E4). Freezes and
 * unfreezes are append-only adjustment rows; the latest row per symbol decides.
 */
export async function frozenSymbols(db: Db, houseExternalAccountId: string): Promise<Map<string, { since: number; note: string }>> {
  const rows = await db.select().from(uatBookAdjustments).where(and(
    eq(uatBookAdjustments.houseExternalAccountId, houseExternalAccountId),
    inArray(uatBookAdjustments.kind, ["symbol_freeze", "symbol_unfreeze"]),
  )).orderBy(asc(uatBookAdjustments.id));
  const state = new Map<string, { since: number; note: string }>();
  for (const row of rows) {
    if (!row.symbol) continue;
    const symbol = row.symbol.toUpperCase();
    if (row.kind === "symbol_freeze") state.set(symbol, { since: row.createdAt, note: row.note });
    else state.delete(symbol);
  }
  return state;
}
