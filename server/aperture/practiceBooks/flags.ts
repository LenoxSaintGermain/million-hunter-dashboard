import { configuredOwnerOpenId, isDeploymentOwner, sharedAlpacaKeyOwnerOnly } from "../brokers/envBrokerOwner";

/**
 * UAT Practice Books: each tester trades a virtual sub-ledger on the one shared
 * "UAT house" Alpaca paper account (see uat-tester-isolation-design §5).
 *
 * UAT_PRACTICE_BOOKS (server env) is ON by default for UAT. Only an explicit
 * "false", "0" or "off" turns it off. It is automatically inert when
 * ALPACA_SHARED_KEY_OWNER_ONLY=true (go-live, #41/#64): the env rail is then
 * owner-only, every non-owner is refused by that gate, and books never engage.
 *
 *   UAT_PRACTICE_BOOKS | ALPACA_SHARED_KEY_OWNER_ONLY | result
 *   on (default)       | off (default)                | UAT mode: non-owner alpaca_paper rows are books
 *   on (default)       | true                         | books inert; owner-only env rail
 *   false              | off                          | testers see the raw shared account (pre-books)
 *   false              | true                         | go-live: owner-only env rail; everyone else BYOK
 */
const OFF_VALUES = new Set(["false", "0", "off", "no"]);

/** The env switch alone (default on). */
export function practiceBooksConfigured(): boolean {
  const raw = (process.env.UAT_PRACTICE_BOOKS ?? "").trim().toLowerCase();
  return !OFF_VALUES.has(raw);
}

/** Books engage only when configured AND the shared key is not owner-only. */
export function practiceBooksEnabled(): boolean {
  return practiceBooksConfigured() && !sharedAlpacaKeyOwnerOnly();
}

export type PracticeBookMode = "on" | "off" | "inert";

export function practiceBooksMode(): PracticeBookMode {
  if (!practiceBooksConfigured()) return "off";
  return sharedAlpacaKeyOwnerOnly() ? "inert" : "on";
}

/**
 * Access check: is this signed-in identity a tester whose env-rail Alpaca rows
 * are practice books? The owner (OWNER_OPEN_ID) keeps broker mode, the raw house.
 */
export function usesPracticeBooks(openId: string | null | undefined): boolean {
  return practiceBooksEnabled() && !isDeploymentOwner(openId);
}

/** One startup line per mode (never per request). */
export function logPracticeBooksMode(): void {
  const mode = practiceBooksMode();
  if (mode === "off") {
    console.info("[uat] practice books off (UAT_PRACTICE_BOOKS=false); testers see the raw shared Alpaca paper account");
    return;
  }
  if (mode === "inert") {
    console.warn("[uat] practice books are on but the shared Alpaca key is owner-only; books are inert");
    return;
  }
  console.info("[uat] practice books on (UAT_PRACTICE_BOOKS default on); non-owner Alpaca paper accounts trade per-tester books on the shared house account");
  if (!configuredOwnerOpenId()) console.error("[uat] OWNER_OPEN_ID is not set; owner-only practice-book views are disabled and every user is treated as a tester.");
}
