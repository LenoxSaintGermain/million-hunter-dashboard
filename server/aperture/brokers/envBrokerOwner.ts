import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { users } from "../../../drizzle/schema";
import type { getDb } from "../../db";

/**
 * #41: env-backed broker rails can be restricted to the deployment owner.
 *
 * `alpaca_paper` has no per-user connection: every account on that rail talks
 * to the one Alpaca paper account whose key is in the deploy environment.
 *
 * ALPACA_SHARED_KEY_OWNER_ONLY (server env, default off) decides who may use it:
 *   off (unset / anything but "true") — development/UAT: every capital
 *       operator may use the shared paper key, and several users may bind the
 *       same shared paper account (the behaviour before #41).
 *   "true" — go-live: only the user whose openId equals OWNER_OPEN_ID may read,
 *       sync, schedule or trade through it, and an external account binds to
 *       one user. If OWNER_OPEN_ID is not configured, nobody can be identified
 *       as the owner, so access fails closed and the server logs why.
 */
export const ENV_BACKED_BROKER_IDS: readonly string[] = ["alpaca_paper"];
export const OWNER_ONLY_BROKER_MESSAGE = "Connect your own Alpaca paper key in Sources.";

export type EnvBrokerAccess =
  | { allowed: true }
  | { allowed: false; reason: "not_owner" | "owner_not_configured" | "unknown_user" };

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export function isEnvBackedBroker(brokerId: string | null | undefined): boolean {
  return brokerId != null && ENV_BACKED_BROKER_IDS.includes(brokerId);
}

/** Go-live switch for #41. Off by default; only the exact string "true" turns it on. */
export function sharedAlpacaKeyOwnerOnly(): boolean {
  return process.env.ALPACA_SHARED_KEY_OWNER_ONLY === "true";
}

/** One startup line naming the mode (never logged per request). */
export function logSharedAlpacaKeyMode(): void {
  if (!sharedAlpacaKeyOwnerOnly()) {
    console.info("[alpaca] shared paper key open to all operators (ALPACA_SHARED_KEY_OWNER_ONLY off)");
    return;
  }
  console.info("[alpaca] shared paper key restricted to the deployment owner (ALPACA_SHARED_KEY_OWNER_ONLY on)");
  if (!configuredOwnerOpenId()) console.error("[security] ALPACA_SHARED_KEY_OWNER_ONLY is on but OWNER_OPEN_ID is not set; every user is refused the shared Alpaca paper key.");
}

function configuredOwnerOpenId(): string | null {
  const value = (process.env.OWNER_OPEN_ID ?? "").trim();
  return value || null;
}

/** Pure decision: may this signed-in identity use this broker rail? */
export function envBrokerAccess(openId: string | null | undefined, brokerId: string | null | undefined): EnvBrokerAccess {
  if (!isEnvBackedBroker(brokerId) || !sharedAlpacaKeyOwnerOnly()) return { allowed: true };
  const owner = configuredOwnerOpenId();
  if (!owner) return { allowed: false, reason: "owner_not_configured" };
  if (!openId) return { allowed: false, reason: "unknown_user" };
  return openId === owner ? { allowed: true } : { allowed: false, reason: "not_owner" };
}

function logRefusal(access: Exclude<EnvBrokerAccess, { allowed: true }>, brokerId: string, surface: string, userId: number | null) {
  const who = userId == null ? "unknown user" : `user ${userId}`;
  if (access.reason === "owner_not_configured") {
    console.error(`[security] OWNER_OPEN_ID is not set; refusing env-backed ${brokerId} for ${who} at ${surface}. Every user is refused until OWNER_OPEN_ID is configured.`);
  } else {
    console.warn(`[security] Refused env-backed ${brokerId} for ${who} at ${surface}: only the deployment owner may use it (${access.reason}).`);
  }
}

/** Throws PRECONDITION_FAILED unless the identity may use the rail. */
export function assertEnvBrokerAccess(actor: { id?: number | null; openId?: string | null }, brokerId: string, surface: string): void {
  const access = envBrokerAccess(actor.openId, brokerId);
  if (access.allowed) return;
  logRefusal(access, brokerId, surface, actor.id ?? null);
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: OWNER_ONLY_BROKER_MESSAGE });
}

/** The same decision for code that only knows the user id (order flow, cron). */
export async function envBrokerAccessForUser(db: Db, userId: number, brokerId: string, surface: string): Promise<EnvBrokerAccess> {
  if (!isEnvBackedBroker(brokerId) || !sharedAlpacaKeyOwnerOnly()) return { allowed: true };
  const [row] = await db.select({ openId: users.openId }).from(users).where(eq(users.id, userId)).limit(1);
  const access = envBrokerAccess(row?.openId ?? null, brokerId);
  if (!access.allowed) logRefusal(access, brokerId, surface, userId);
  return access;
}

export async function assertEnvBrokerAccessForUser(db: Db, userId: number, brokerId: string, surface: string): Promise<void> {
  const access = await envBrokerAccessForUser(db, userId, brokerId, surface);
  if (!access.allowed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: OWNER_ONLY_BROKER_MESSAGE });
}
