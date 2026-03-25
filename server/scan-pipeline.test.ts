/**
 * Scan Pipeline Tests
 * Verifies that the scan_jobs table has the new progress-tracking columns
 * and that insert/update/select work correctly.
 */
import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { scanJobs } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

describe("Scan Pipeline", () => {
  it("scan_jobs table has all required progress columns", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    // Insert a test scan job
    await db!.insert(scanJobs).values({
      status: "pending",
      sources: ["bizbuysell", "dealstream"],
      startedAt: new Date(),
      currentPhase: "Initializing scan engine",
      phaseDetail: "Connecting to 2 marketplaces",
      progressPct: 2,
      dealsScored: 0,
    });

    // Read the most recent row back
    const rows = await db!.select().from(scanJobs).orderBy(desc(scanJobs.id)).limit(1);
    const job = rows[0];

    expect(job).toBeDefined();
    expect(job.status).toBe("pending");
    expect(job.currentPhase).toBe("Initializing scan engine");
    expect(job.phaseDetail).toBe("Connecting to 2 marketplaces");
    expect(job.progressPct).toBe(2);
    expect(job.dealsScored).toBe(0);
    expect(Array.isArray(job.sources)).toBe(true);

    // Clean up
    await db!.delete(scanJobs).where(eq(scanJobs.id, job.id));
  });

  it("scan job progress fields can be updated mid-pipeline", async () => {
    const db = await getDb();

    await db!.insert(scanJobs).values({
      status: "running",
      sources: ["bizbuysell"],
      startedAt: new Date(),
      currentPhase: "Scanning marketplaces",
      progressPct: 10,
    });

    // Get the inserted row
    const inserted = await db!.select().from(scanJobs).orderBy(desc(scanJobs.id)).limit(1);
    const job = inserted[0];
    expect(job).toBeDefined();

    // Update progress
    await db!.update(scanJobs).set({
      currentPhase: "AI scoring",
      phaseDetail: "Scored 3/5: Metro HVAC Services",
      progressPct: 65,
      dealsScored: 3,
    }).where(eq(scanJobs.id, job.id));

    const updated = await db!.select().from(scanJobs).where(eq(scanJobs.id, job.id)).limit(1);
    const row = updated[0];

    expect(row.currentPhase).toBe("AI scoring");
    expect(row.phaseDetail).toBe("Scored 3/5: Metro HVAC Services");
    expect(row.progressPct).toBe(65);
    expect(row.dealsScored).toBe(3);

    // Mark complete
    await db!.update(scanJobs).set({
      status: "completed",
      currentPhase: "Scan complete",
      progressPct: 100,
      completedAt: new Date(),
    }).where(eq(scanJobs.id, job.id));

    const completed = await db!.select().from(scanJobs).where(eq(scanJobs.id, job.id)).limit(1);
    expect(completed[0].status).toBe("completed");
    expect(completed[0].progressPct).toBe(100);

    // Clean up
    await db!.delete(scanJobs).where(eq(scanJobs.id, job.id));
  });
});
