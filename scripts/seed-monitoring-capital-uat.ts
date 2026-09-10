/** Frozen, read-only-journey records. Never an order submission or market claim. */
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "../server/db";
import { users, capitalTheses, portfolioAccounts, apertureRuns, apertureCandidates, brokerOrders, monitoringChecks, apertureAttentionBaselines } from "../drizzle/schema";
import { parsePersistedJson } from "../shared/persistedJson";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (target.protocol !== "mysql:" || target.hostname !== "127.0.0.1" || target.port !== "3307"
  || target.pathname !== "/capital_aperture_uat_9c18799" || process.env.ISOLATED_UAT_MODE !== "true"
  || process.env.NODE_ENV !== "development") throw new Error("Refusing monitoring fixture outside the exact isolated development database.");
const db = (await getDb())!;
const openId = "uat_monitoring_20260910";
const [existing] = await db.select().from(users).where(eq(users.openId, openId));
if (process.argv[2] === "--inspect") {
  if (!existing) throw new Error("No monitoring fixture exists; inspection never creates it.");
  const accounts = await db.select().from(portfolioAccounts).where(eq(portfolioAccounts.userId, existing.id)).orderBy(portfolioAccounts.id);
  const orders = await db.select().from(brokerOrders).where(eq(brokerOrders.userId, existing.id)).orderBy(brokerOrders.id);
  const checks = await db.select({ check: monitoringChecks }).from(monitoringChecks).innerJoin(apertureRuns, eq(apertureRuns.id, monitoringChecks.runId)).where(eq(apertureRuns.userId, existing.id)).orderBy(monitoringChecks.id);
  const [baseline] = await db.select().from(apertureAttentionBaselines).where(eq(apertureAttentionBaselines.userId, existing.id));
  const snapshot = parsePersistedJson(baseline?.snapshot) as { monitoringReviews?: unknown[] } | null;
  const reviews = snapshot?.monitoringReviews ?? [];
  const digest = createHash("sha256").update(JSON.stringify({ accounts, orders, checks, reviews })).digest("hex");
  console.log(JSON.stringify({ userId: existing.id, orders: orders.length, checks: checks.length, reviews: reviews.length, accountOrderCheckReviewHash: digest, seenExcluded: true }));
  process.exit(0);
}
if (existing) { console.log("Monitoring fixture exists; preserving its saved state."); process.exit(0); }
const now = Date.UTC(2026, 8, 9, 18);
const receipt = await db.transaction(async tx => {
  const [owner] = await tx.insert(users).values({ openId, name: "Illustrative Monitoring UAT", email: "monitoring-uat@invalid.local", role: "capital_operator", onboardingCompleted: true, defaultWorkspace: "capital_aperture_trader" });
  const userId = Number(owner.insertId);
  const [thesis] = await tx.insert(capitalTheses).values({ userId, name: "Illustrative monitoring thesis", rawText: "Frozen UI fixture, not a market thesis. Verify the selected put's recorded catalyst and preserve unresolved findings.", graph: { beliefs: ["Illustrative workflow only"], researchSymbols: ["DKNG"] }, status: "active", isPrimary: true, createdAt: now, updatedAt: now });
  const [account] = await tx.insert(portfolioAccounts).values({ userId, label: "Illustrative monitoring paper account", brokerId: "manual", isPaper: true, equityValueCents: 1_000_000, cashCents: 500_000, buyingPowerCents: 500_000, lastSyncedAt: now, syncSource: "illustrative_fixture", createdAt: now, updatedAt: now });
  const accountId = Number(account.insertId);
  const [run] = await tx.insert(apertureRuns).values({ userId, thesisId: Number(thesis.insertId), accountId, deployableCapitalCents: 100_000, status: "completed", instrumentPreference: "options", holdingPeriod: "swing", createdAt: now });
  const runId = Number(run.insertId);
  const [candidate] = await tx.insert(apertureCandidates).values({ runId, symbol: "DKNG", role: "core", createdAt: now });
  const candidateId = Number(candidate.insertId);
  const [order] = await tx.insert(brokerOrders).values({ userId, runId, candidateId, accountId, symbol: "DKNG261120P00020000", underlyingSymbol: "DKNG", instrumentType: "long_put", optionExpirationDate: "2026-11-20", optionStrikePriceCents: 2000, contractMultiplier: 100, side: "buy", intent: "open", qty: 1, filledQty: 1, filledAvgPriceCents: 100, filledAt: now, status: "filled", reason: "Illustrative recorded put rationale; not broker execution evidence.", plannedRiskCents: 10_000, createdAt: now, updatedAt: now });
  const checkIds: number[] = [];
  for (const checkType of ["macro", "catalyst"] as const) {
    const [check] = await tx.insert(monitoringChecks).values({ runId, candidateId, symbol: "DKNG", checkType, flagged: checkType === "catalyst", finding: `Illustrative ${checkType} observation for navigation UAT only; no live market claim.`, citations: ["https://example.org/illustrative-monitoring-fixture"], checkedAt: now - 2 * 86_400_000, createdAt: now - 2 * 86_400_000 });
    checkIds.push(Number(check.insertId));
  }
  return { userId, accountId, runId, candidateId, orderId: Number(order.insertId), checkIds };
});
console.log(JSON.stringify({ ...receipt, disclosure: "Illustrative isolated records. No broker/provider call or submission." }));
process.exit(0);
