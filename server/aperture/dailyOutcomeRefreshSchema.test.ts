import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("daily outcome refresh persistence contract", () => {
  it("keeps cron ownership on the user profile and away from broker orders", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0047_daily_outcome_refresh_schedule.sql"), "utf8");
    const handler = readFileSync(resolve(process.cwd(), "server/aperture/dailyOutcomeRefreshScheduled.ts"), "utf8");
    const evaluator = readFileSync(resolve(process.cwd(), "server/aperture/dailyOutcomeRefresh.ts"), "utf8");
    expect(schema).toContain('dailyOutcomeRefreshTaskUid: varchar("daily_outcome_refresh_task_uid"');
    expect(schema).toContain('dailyOutcomeRefreshEnabled: boolean("daily_outcome_refresh_enabled")');
    expect(migration).toContain("CREATE UNIQUE INDEX users_daily_outcome_refresh_task_uid_uq");
    expect(migration).not.toMatch(/broker_orders|live.*order|submit/i);
    expect(handler).toContain("eq(users.dailyOutcomeRefreshTaskUid, actor.taskUid)");
    expect(handler).not.toContain("req.body");
    expect(evaluator).not.toMatch(/brokerOrders|createOrder|approveOrder|submitOrder/);
  });
});
