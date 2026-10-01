import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Optional override verifies the clean release source without importing routers,
// connecting to a database, or changing the index/worktree router.
const source = readFileSync(process.env.PRIVATE_SCAN_ROUTER_SOURCE ?? resolve("server/routers.ts"), "utf8");
const scan = source.slice(source.indexOf("  scan: router({"), source.indexOf("  models: router({"));
const pipeline = source.slice(source.indexOf("async function runScanPipeline("));
describe("private scan router source contract (legacy and V2)", () => {
  it("uses protected owner-scoped polling and owner-assigned creation", () => {
    expect(scan).toContain("getLatest: protectedProcedure");
    expect(scan).toContain("getStatus: protectedProcedure");
    expect(scan).toContain("getLatestPrivateScanJob(ctx.user.id)");
    expect(scan).toContain("getPrivateScanJob(ctx.user.id, input.jobId)");
    expect(scan).toContain("createPrivateScanJob(ctx.user.id, {");
    expect(scan).toContain("const jobId = insertResult.id");
    expect(scan).toMatch(/runScanPipeline\([^\n]+, ctx\.user\.id\)/);
    expect(scan).toContain("updatePrivateScanJob(ctx.user.id, jobId,");
  });
  it("carries required owner identity through every job write", () => {
    expect(pipeline).toContain("ownerUserId: number,");
    expect(pipeline).toContain("await getPrivateScanJob(ownerUserId, jobId)");
    expect(pipeline).toContain("updatePrivateScanJob(ownerUserId, jobId,");
    expect(scan + pipeline).not.toMatch(/\b(?:updateScanJob|createScanJob|getLatestScanJob)\(/);
  });
  it("does not reuse or upsert global catalog records", () => {
    expect(pipeline).toContain("privateWorkspace.findPrivateDealByNameSource(principal, listing.name, listing.source)");
    expect(pipeline).toContain("privateWorkspace.createPrivateDeal(principal,");
    expect(pipeline).toContain("privateWorkspace.getPrivateDeal(principal, dealId)");
    expect(pipeline).toContain("privateWorkspace.updatePrivateDealScore(principal, dealId, score, redFlagCount)");
    expect(pipeline).not.toMatch(/(?<!\.)\b(?:createDeal|getDealById|getDealIdByNameSource|updateDealScore|updateAcquisitionScreeningStage)\(/);
  });
  it("scopes every pipeline SQL deal update and retains lifecycle gate", () => {
    const writes = [...pipeline.matchAll(/sql`UPDATE deals[\s\S]*?`/g)].map(m => m[0]);
    expect(writes).toHaveLength(2);
    for (const write of writes) {
      expect(write).toContain("owner_user_id = ${ownerUserId}");
      expect(write).toContain("isArchived = 0");
      expect(write).toContain("id = ${dealId}");
    }
    expect(writes[0]).toContain("stage IN ('new', 'scanning', 'qualified', 'high_priority')");
  });
  it("assigns the caller to legacy scout creation without reopening its gate", () => {
    const scout = source.slice(source.indexOf("    convertToDeal:"), source.indexOf("  sentinel: router({"));
    expect(scout).toContain("async ({ input, ctx })");
    expect(scout).toMatch(/createDeal\(\{\s*ownerUserId: ctx\.user\.id,/);
  });
});
