import { eq } from "drizzle-orm";
import { portfolioAccounts, positions, type PortfolioAccount } from "../../drizzle/schema";
import type { getDb } from "../db";
import { brokerFor } from "./brokers";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export interface PaperAccountSyncResult {
  synced: number;
  cashCents: number | null;
  equityValueCents: number | null;
  source: string;
}

/**
 * Synchronizes only a configured Alpaca Paper account. This function has no
 * order capability: it reads account state and replaces the local position
 * snapshot used as the documented denominator for research guardrails.
 */
export async function syncPaperAccount(db: Db, account: PortfolioAccount, now = Date.now()): Promise<PaperAccountSyncResult> {
  if (!account.isPaper || account.brokerId !== "alpaca_paper") {
    throw new Error("Scheduled synchronization is limited to configured Alpaca Paper accounts.");
  }
  const broker = brokerFor(account.brokerId, account.id);
  if (!broker.available()) throw new Error(broker.unavailableReason() ?? "Alpaca Paper broker is not configured.");

  const [accountData, positionData] = await Promise.all([broker.getAccount(), broker.getPositions()]);
  await db.update(portfolioAccounts).set({
    cashCents: accountData.cashCents,
    buyingPowerCents: accountData.buyingPowerCents,
    equityValueCents: accountData.equityValueCents,
    optionsApprovedLevel: accountData.optionsApprovedLevel,
    optionsTradingLevel: accountData.optionsTradingLevel,
    optionsBuyingPowerCents: accountData.optionsBuyingPowerCents,
    lastSyncedAt: now,
    syncSource: broker.id,
    syncError: null,
    updatedAt: now,
  }).where(eq(portfolioAccounts.id, account.id));

  await db.delete(positions).where(eq(positions.accountId, account.id));
  if (positionData.length) {
    await db.insert(positions).values(positionData.map((position) => ({
      accountId: account.id,
      symbol: position.symbol,
      assetType: position.assetType as "equity" | "etf" | "option" | "crypto" | "cash",
      qty: position.qty,
      avgCostCents: position.avgCostCents ?? null,
      lastPriceCents: position.lastPriceCents ?? null,
      marketValueCents: position.marketValueCents ?? null,
      priceAsOf: now,
      priceSource: broker.id,
      createdAt: now,
      updatedAt: now,
    })));
  }
  return {
    synced: positionData.length,
    cashCents: accountData.cashCents,
    equityValueCents: accountData.equityValueCents,
    source: broker.id,
  };
}
