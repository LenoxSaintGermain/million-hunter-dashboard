import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Capital Aperture owner-isolation contracts", () => {
  it("binds Alpha reads and recomputation to the owner of the requested run", () => {
    const alpha = read("server/aperture/alpha.ts");
    const router = read("server/apertureRouter.ts");

    expect(alpha).toContain("eq(apertureRuns.userId, userId)");
    expect(alpha).toContain("export async function getAlpha(runId: number, userId: number)");
    expect(alpha).toContain("eq(apertureAlpha.userId, userId)");
    expect(router).toContain("getAlpha(input.runId, ctx.user.id)");
  });

  it("lets a run owner read receipts and outcomes for a legitimately shared canonical thesis", () => {
    const router = read("server/apertureRouter.ts");
    const receiptStart = router.indexOf("async function readImmutableDecisionReceipt");
    const receiptEnd = router.indexOf("function decisionRunHasSourceEvidence", receiptStart);
    const receipt = router.slice(receiptStart, receiptEnd);
    const pendingStart = router.indexOf("pending: capitalOperatorProcedure.query");
    const pendingEnd = router.indexOf("resolveCashOutcome:", pendingStart);
    const pending = router.slice(pendingStart, pendingEnd);

    expect(receipt).toContain("eq(thesisCompilations.id, decisionRun.canonicalThesisId)");
    expect(receipt).not.toContain("eq(thesisCompilations.userId, userId)");
    expect(receipt).toContain("eq(capitalTheses.userId, userId)");
    expect(receipt).toContain("eq(portfolioAccounts.userId, userId)");
    expect(pending).toContain("eq(apertureDecisionRuns.userId, ctx.user.id)");
    expect(pending).not.toContain("eq(thesisCompilations.userId, ctx.user.id)");
  });

  it("refuses Jim fixture provisioning outside the exact isolated loopback database", () => {
    const script = read("scripts/provision-jim-capital-uat.mjs");

    expect(script).toContain("function assertIsolatedDatabase(rawUrl)");
    expect(script).toContain('parsed.hostname !== "127.0.0.1"');
    expect(script).toContain('parsed.port !== "3307"');
    expect(script).toContain('database !== "capital_aperture_uat_9c18799"');
    expect(script).toContain("assertIsolatedDatabase(process.env.DATABASE_URL)");
  });
});
