import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { formatDailyOutcomeRefreshResult, refreshDueLiveOutcomesForUser } from "./dailyOutcomeRefresh";

/** Cron-only callback. It resolves the owner strictly by the platform task UID, never request payload. */
export async function handleDailyOutcomeRefresh(req: Request, res: Response) {
  const timestamp = Date.now();
  try {
    const actor = await sdk.authenticateRequest(req);
    if (!actor.isCron || !actor.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    const [owner] = await db!.select().from(users)
      .where(eq(users.dailyOutcomeRefreshTaskUid, actor.taskUid)).limit(1);
    if (!owner || !owner.dailyOutcomeRefreshEnabled) {
      return res.json({ ok: true, skipped: "orphaned_or_paused" });
    }
    const result = await refreshDueLiveOutcomesForUser(db!, owner.id, timestamp);
    const summary = formatDailyOutcomeRefreshResult(result);
    await db!.update(users).set({
      dailyOutcomeRefreshLastRunAt: timestamp,
      dailyOutcomeRefreshLastResult: summary,
    }).where(eq(users.id, owner.id));
    return res.json({ ok: true, ...result, summary, timestamp });
  } catch (error) {
    return res.status(500).json({
      error: String(error instanceof Error ? error.message : error),
      context: { path: req.path, taskUid: "cron task identity unavailable" },
      timestamp,
    });
  }
}
