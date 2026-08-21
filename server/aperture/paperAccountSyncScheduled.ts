import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { portfolioAccounts } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { marketSession } from "./marketSession";
import { syncPaperAccount } from "./paperAccountSync";

/** Every 15 minutes; the callback performs no broker call outside an active US market session. */
export const PAPER_ACCOUNT_SYNC_CRON = "0 */15 * * * *";
export const PAPER_ACCOUNT_SYNC_PATH = "/api/scheduled/capital-paper-account-sync";

export function sessionAllowsPaperAccountSync(now: number): { allowed: boolean; reason: string } {
  const session = marketSession(now);
  const allowed = session.session === "pre_market" || session.session === "regular" || session.session === "after_hours";
  return { allowed, reason: `${session.session} — ${session.basis}` };
}

/** Cron-only freshness callback. It identifies the target account only by task UID. */
export async function handlePaperAccountSync(req: Request, res: Response) {
  const timestamp = Date.now();
  let accountId: number | null = null;
  try {
    const actor = await sdk.authenticateRequest(req);
    if (!actor.isCron || !actor.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    const [account] = await db!.select().from(portfolioAccounts)
      .where(eq(portfolioAccounts.syncScheduleTaskUid, actor.taskUid)).limit(1);
    if (!account || !account.syncScheduleEnabled) return res.json({ ok: true, skipped: "orphaned_or_paused" });
    accountId = account.id;
    if (!account.isPaper || account.brokerId !== "alpaca_paper") {
      return res.json({ ok: true, skipped: "paper_alpaca_only" });
    }
    const gate = sessionAllowsPaperAccountSync(timestamp);
    if (!gate.allowed) {
      await db!.update(portfolioAccounts).set({
        syncScheduleLastRunAt: timestamp,
        syncScheduleLastResult: `Skipped: ${gate.reason}`,
      }).where(eq(portfolioAccounts.id, account.id));
      return res.json({ ok: true, skipped: "market_closed", summary: gate.reason, timestamp });
    }
    const result = await syncPaperAccount(db!, account, timestamp);
    const summary = `Synced ${result.synced} position(s) from ${result.source}; paper account context only.`;
    await db!.update(portfolioAccounts).set({
      syncScheduleLastRunAt: timestamp,
      syncScheduleLastResult: summary,
    }).where(eq(portfolioAccounts.id, account.id));
    return res.json({ ok: true, ...result, summary, timestamp });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (accountId != null) {
      const db = await getDb();
      if (db) await db.update(portfolioAccounts).set({
        syncError: message,
        syncScheduleLastRunAt: timestamp,
        syncScheduleLastResult: `Failed: ${message}`,
      }).where(eq(portfolioAccounts.id, accountId));
    }
    return res.status(500).json({ error: message, context: { path: req.path }, timestamp });
  }
}
