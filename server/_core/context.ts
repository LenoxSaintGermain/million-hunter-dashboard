import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import { users, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Duplicate-account resolution.
 *
 * One person signed up twice under two OAuth identities and actively uses both.
 * Rather than deleting a row (not reversible) or moving every foreign key
 * (investor_dna.user_id is UNIQUE, so a merge can throw), the non-canonical row
 * carries `merged_into_user_id` and is resolved here — so either login lands in
 * the same account and sees the same data.
 *
 * Single hop only, on purpose: a chain of pointers is a bug, not a feature, and
 * following one would risk a cycle at request time.
 */
export async function resolveMergedUser(user: User): Promise<User> {
  if (!user.mergedIntoUserId || user.mergedIntoUserId === user.id) return user;
  try {
    const db = await getDb();
    if (!db) return user;
    const rows = await db.select().from(users).where(eq(users.id, user.mergedIntoUserId)).limit(1);
    const canonical = rows[0];
    if (!canonical) return user;
    // A pointer to another pointer is misconfiguration — stop here rather than
    // chasing it, and keep serving the canonical row we did find.
    return canonical;
  } catch {
    // Never fail a request over this; the un-merged identity still works.
    return user;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const isolatedPreviewOpenId = process.env.LOCAL_PREVIEW_OPENID;
  const isIsolatedUat = process.env.NODE_ENV === "development"
    && process.env.ISOLATED_UAT_MODE === "true"
    && process.env.DATABASE_URL?.includes("127.0.0.1:3307/capital_aperture_uat_9c18799");

  if (isIsolatedUat && isolatedPreviewOpenId) {
    const requestedFixture = opts.req.header("x-isolated-uat-identity");
    const jimFixtureOpenId = process.env.LOCAL_PREVIEW_JIM_OPENID ?? "uat_jim_9c18799";
    const fixtureOpenId = requestedFixture === "jim" ? jimFixtureOpenId : isolatedPreviewOpenId;
    const db = await getDb();
    const rows = db
      ? await db.select().from(users).where(eq(users.openId, fixtureOpenId)).limit(1)
      : [];
    user = rows[0] ?? null;
  } else {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  if (user) user = await resolveMergedUser(user);

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
