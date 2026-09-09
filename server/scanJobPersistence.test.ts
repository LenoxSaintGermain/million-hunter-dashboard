import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const stored = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({ select: () => ({ from: () => ({ orderBy: () => ({ limit: async () => stored.rows }) }) }) }),
}));
import { getLatestScanJob } from "./db";

describe("scan job persistence read boundary", () => {
  beforeEach(() => {
    // No connection or credentials: drizzle is mocked at the driver boundary.
    vi.stubEnv("DATABASE_URL", "mysql://127.0.0.1/unit_test_no_connection");
    stored.rows = [];
  });
  afterAll(() => vi.unstubAllEnvs());

  it("decodes MariaDB text JSON through the actual scan getter", async () => {
    stored.rows = [{ id: 1, sources: '["bizbuysell","dealstream"]', status: "running" }];
    expect(await getLatestScanJob()).toEqual({ id: 1, sources: ["bizbuysell", "dealstream"], status: "running" });
  });
  it("preserves already-decoded MySQL JSON", async () => {
    stored.rows = [{ id: 1, sources: ["bizbuysell"] }];
    expect((await getLatestScanJob())!.sources).toEqual(["bizbuysell"]);
  });
  it("preserves null sources rather than inventing an empty array", async () => {
    stored.rows = [{ id: 1, sources: null }];
    expect((await getLatestScanJob())!.sources).toBeNull();
  });
  it("rejects malformed persisted JSON rather than hiding corrupt storage", async () => {
    stored.rows = [{ id: 1, sources: '["broken"' }];
    await expect(getLatestScanJob()).rejects.toThrow(SyntaxError);
  });
  it("returns undefined when no scan job exists", async () => {
    expect(await getLatestScanJob()).toBeUndefined();
  });
});
