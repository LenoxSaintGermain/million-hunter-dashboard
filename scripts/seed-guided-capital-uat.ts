import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { users, thesisCompilations, capitalTheses, portfolioAccounts } from "../drizzle/schema";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "3307" || target.pathname !== "/capital_aperture_uat_9c18799" || process.env.ISOLATED_UAT_MODE !== "true") throw new Error("Refusing fixture creation outside the exact isolated UAT database.");
const db = (await getDb())!;
const openId = "uat_guided_20260909";
const [existing] = await db.select().from(users).where(eq(users.openId, openId));
if (existing) { console.log("Guided UAT fixture already exists; preserving saved work."); process.exit(0); }
await db.transaction(async (tx) => {
  const now = Date.now();
  const [ownerInsert] = await tx.insert(users).values({ openId, name: "Illustrative Guided UAT", email: "guided-uat@invalid.local", role: "capital_operator", onboardingCompleted: true, defaultWorkspace: "capital_aperture_trader" });
  const userId = Number(ownerInsert.insertId);
  const name = "Illustrative UAT · MRVL infrastructure thesis";
  const belief = "Illustrative workflow fixture, not a market finding: investigate an MRVL infrastructure catalyst over a swing horizon using shares. Require fresh sourced prices and a confirmed catalyst before considering entry. Invalidate if the catalyst evidence is contradicted or the declared risk limit cannot be honored. Preserve cash when data is unavailable.";
  const [canonicalInsert] = await tx.insert(thesisCompilations).values({ userId, name, thesisText: belief, templateUsed: "capital_trade", status: "approved", compiledFilters: { holdingPeriod: "swing", instrumentPreference: "shares", researchSymbols: ["MRVL"], capitalTradeDetails: { belief, seeks: "Source-backed catalyst", avoids: "Unverified quotes", horizon: "swing", risk: "Declared planned-loss limit" } } });
  const canonicalId = Number(canonicalInsert.insertId);
  await tx.insert(capitalTheses).values({ userId, name, rawText: belief, sourceCompilationId: canonicalId, status: "active", isPrimary: true, graph: { beliefs: [belief], seek: ["Sourced catalyst"], avoid: ["Unverified prices"], horizons: ["swing"], researchSymbols: ["MRVL"], evidenceRequirements: ["Fresh price", "Sourced catalyst"], invalidationConditions: ["Catalyst contradicted", "Risk boundary exceeded"], instrumentPreference: "shares" }, createdAt: now, updatedAt: now });
  await tx.insert(portfolioAccounts).values({ userId, label: "Illustrative UAT paper account", brokerId: "manual", externalAccountId: "ILLUSTRATIVE-GUIDED-20260909", isPaper: true, equityValueCents: 10_000_000, cashCents: 5_000_000, buyingPowerCents: 5_000_000, lastSyncedAt: now, syncSource: "illustrative_fixture", createdAt: now, updatedAt: now });
  await tx.update(users).set({ activeCapitalThesisId: canonicalId }).where(eq(users.id, userId));
});
console.log("Created labeled illustrative Mission UAT user, thesis, and paper account. No order or real broker connection.");
process.exit(0);
