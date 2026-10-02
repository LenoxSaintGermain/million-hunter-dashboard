import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
describe("V2 router integration boundaries", () => {
  it("requires explicit mandate approval and marks the job private before manifest creation", () => {
    expect(source).toContain("input?.v2Mandate && !input.v2Approved");
    expect(source).toContain("sources: input?.v2Mandate ? [...sources, ACQUISITION_V2_PENDING_SOURCE] : sources");
    expect(source.indexOf("sources: input?.v2Mandate")).toBeLessThan(source.indexOf("await beginAcquisitionV2Run(ctx.user.id"));
  });
  it("checks ownership on legacy status endpoints", () => {
    expect(source).toContain("await assertAcquisitionV2JobAccess(ctx.user?.id ?? null, job.id)");
    expect(source).toContain("await assertAcquisitionV2JobAccess(ctx.user?.id ?? null, input.jobId)");
  });
  it("preserves the receipt before terminal status and bypasses shared catalog scoring", () => {
    const pipeline = source.slice(source.indexOf("// V2 is an owner-scoped screening receipt"));
    const branch = pipeline.slice(0, pipeline.indexOf("// ── Phase 2"));
    expect(branch).toContain("await updateAcquisitionV2RunState(v2.userId, jobId, \"completed\")");
    expect(branch.indexOf("await updateAcquisitionV2RunState")).toBeLessThan(branch.indexOf("status: \"completed\""));
    expect(branch).toContain("dealsScored: 0");
    expect(branch).toContain("return;");
    expect(branch).not.toContain("upsertDeal");
  });
});
