import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { oneTimePostOpenResearchGate } from "./oneTimeGlp1Research";
import { startScheduledCapitalResearch } from "../apertureRouter";

/** Cron-only callback. Ownership is resolved only from the immutable platform task UID. */
export async function handleOneTimeGlp1Research(req: Request, res: Response) {
  const timestamp = Date.now();
  try {
    const actor = await sdk.authenticateRequest(req);
    if (!actor.isCron || !actor.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    const [owner] = await db!.select().from(users)
      .where(eq(users.oneTimeResearchTaskUid, actor.taskUid)).limit(1);
    if (!owner || !owner.oneTimeResearchEnabled || owner.oneTimeResearchStatus !== "queued") {
      return res.json({ ok: true, skipped: "orphaned_paused_or_terminal" });
    }
    if (owner.oneTimeResearchTargetAt == null || owner.oneTimeResearchThesisId == null) {
      await db!.update(users).set({
        oneTimeResearchEnabled: false,
        oneTimeResearchStatus: "failed",
        oneTimeResearchLastResult: "Scheduled research was missing its target timestamp or active thesis binding.",
      }).where(eq(users.id, owner.id));
      return res.json({ ok: true, skipped: "missing_schedule_context" });
    }
    const gate = oneTimePostOpenResearchGate(timestamp, owner.oneTimeResearchTargetAt);
    if (!gate.eligible) {
      await db!.update(users).set({
        oneTimeResearchEnabled: false,
        oneTimeResearchStatus: "failed",
        oneTimeResearchLastResult: gate.reason,
      }).where(eq(users.id, owner.id));
      return res.json({ ok: true, skipped: "market_gate", reason: gate.reason });
    }
    await db!.update(users).set({
      oneTimeResearchStatus: "running",
      oneTimeResearchLastResult: "Opening-range gate passed. Building the paper-only GLP-1 research brief.",
    }).where(eq(users.id, owner.id));
    const run = await startScheduledCapitalResearch({
      userId: owner.id,
      canonicalThesisId: owner.oneTimeResearchThesisId,
      targetAt: owner.oneTimeResearchTargetAt,
    });
    await db!.update(users).set({
      oneTimeResearchEnabled: false,
      oneTimeResearchStatus: "completed",
      oneTimeResearchRunId: run.runId,
      oneTimeResearchLastResult: `Research brief #${run.runId} started. Record a paper posture only after reviewing its completed opportunity set.`,
    }).where(eq(users.id, owner.id));
    return res.json({ ok: true, runId: run.runId, timestamp });
  } catch (error) {
    return res.status(500).json({
      error: String(error instanceof Error ? error.message : error),
      context: { path: req.path, taskUid: "cron task identity unavailable" },
      timestamp,
    });
  }
}
