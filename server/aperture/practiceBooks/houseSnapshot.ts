import { getDb } from "../../db";
import { BrokerUnavailableError, type BrokerAdapter, type BrokerPosition } from "../brokers/types";
import { ensureHouseBaseline } from "./repository";

/**
 * The one shared read of the UAT house account (account + positions), cached
 * for 60 s and single-flight, so N testers never cost N × (account + positions)
 * against Alpaca's 200 requests/min per account. Feeds book marks, house buying
 * power and reconciliation. Testers never receive these numbers directly.
 */
export interface HouseSnapshot {
  externalAccountId: string;
  cashCents: number | null;
  buyingPowerCents: number | null;
  equityValueCents: number | null;
  optionsApprovedLevel: number | null;
  optionsTradingLevel: number | null;
  positions: BrokerPosition[];
  /** When the house was read (never "now" unless it was just read). */
  asOf: number;
}

export const HOUSE_SNAPSHOT_TTL_MS = 60_000;
let cached: HouseSnapshot | null = null;
let inflight: Promise<HouseSnapshot> | null = null;

async function readHouse(house: BrokerAdapter): Promise<HouseSnapshot> {
  if (!house.available()) throw new BrokerUnavailableError(house.unavailableReason() ?? "Alpaca Paper is not configured.");
  const [account, positions] = await Promise.all([house.getAccount(), house.getPositions()]);
  if (!account.externalAccountId) throw new BrokerUnavailableError("The shared practice account did not return an account number. Nothing was changed; try again.");
  const snapshot: HouseSnapshot = {
    externalAccountId: account.externalAccountId,
    cashCents: account.cashCents,
    buyingPowerCents: account.buyingPowerCents,
    equityValueCents: account.equityValueCents,
    optionsApprovedLevel: account.optionsApprovedLevel,
    optionsTradingLevel: account.optionsTradingLevel,
    positions,
    asOf: account.asOf,
  };
  // The first house read in book mode records the reconciliation baseline (idempotent per house).
  try {
    const db = await getDb();
    if (db) await ensureHouseBaseline(db, { ...snapshot, positions }, null, snapshot.asOf);
  } catch (error) {
    console.warn(`[uat] could not record the house baseline: ${error instanceof Error ? error.message : String(error)}`);
  }
  return snapshot;
}

/** `house` is the env-key Alpaca paper adapter (passed in to keep brokers/index free of an import cycle). */
export async function readHouseSnapshot(house: BrokerAdapter, options: { now?: number; maxAgeMs?: number } = {}): Promise<HouseSnapshot> {
  const now = options.now ?? Date.now();
  const maxAge = options.maxAgeMs ?? HOUSE_SNAPSHOT_TTL_MS;
  if (cached && now - cached.asOf >= 0 && now - cached.asOf < maxAge) return cached;
  if (!inflight) {
    inflight = readHouse(house).then((snapshot) => { cached = snapshot; return snapshot; }).finally(() => { inflight = null; });
  }
  return inflight;
}

/** Tests and the owner's "refresh now" only. */
export function resetHouseSnapshotCache(): void {
  cached = null;
  inflight = null;
}
