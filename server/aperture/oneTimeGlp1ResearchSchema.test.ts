import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("one-time GLP-1 scheduled research contract", () => {
  it("persists a task UID and observable terminal state on the owner profile", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/0048_one_time_glp1_research_schedule.sql");
    expect(schema).toContain("oneTimeResearchTaskUid");
    expect(schema).toContain("oneTimeResearchStatus");
    expect(migration).toContain("users_one_time_research_task_uid_uq");
  });

  it("uses cron task identity for ownership and has no broker-order capability", () => {
    const handler = read("server/aperture/oneTimeGlp1ResearchScheduled.ts");
    expect(handler).toContain("actor.isCron");
    expect(handler).toContain("actor.taskUid");
    expect(handler).toContain("oneTimeResearchTaskUid");
    expect(handler).not.toMatch(/brokerOrders|createOrder|approveOrder|submitBrokerOrder/);
  });

  it("keeps the scheduled research wrapper outside proposal or order code", () => {
    const router = read("server/apertureRouter.ts");
    const helper = router.slice(router.indexOf("export async function startScheduledCapitalResearch"), router.indexOf("async function evidenceReviewBlock"));
    expect(helper).toContain("executeRun");
    expect(helper).not.toMatch(/createOrder|approveOrder|submitBrokerOrder|brokerOrders/);
  });
});
