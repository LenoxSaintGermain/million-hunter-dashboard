import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(resolve(process.cwd(), "server/apertureRouter.ts"), "utf8");

describe("authoritative Mission underwriting semantics", () => {
  it("does not convert a legacy desired-ending value into an explicit profit target", () => {
    const router = source();
    const start = router.indexOf("function objectiveFromDecisionRevision");
    const end = router.indexOf("function normalizeExplicitTarget", start);
    const helper = router.slice(start, end);

    expect(helper).toContain("const hasExplicitTarget");
    expect(helper).toContain("targetProfitCents: hasExplicitTarget ? revision.targetProfitCents : null");
    expect(helper).not.toContain("desiredEndingValueCents");
  });

  it("previews and executes against owner- and account-scoped open risk", () => {
    const router = source();
    const helper = router.slice(
      router.indexOf("async function readAuthoritativeOpenRiskCents"),
      router.indexOf("function underwritingRiskFromCockpit"),
    );
    const preview = router.slice(router.indexOf("preview: capitalOperatorProcedure"), router.indexOf("run: capitalOperatorProcedure", router.indexOf("preview: capitalOperatorProcedure")));

    expect(helper).toContain("eq(brokerOrders.userId, userId)");
    expect(helper).toContain("eq(brokerOrders.accountId, accountId)");
    expect(helper).toContain("LIVE_ORDER_STATUSES");
    expect(preview).toContain("readAuthoritativeOpenRiskCents");
    expect(preview).toContain("proposalCreated: false");
    expect(router).toContain("Portfolio risk changed while underwriting was running");
  });

  it("passes the latest no-trade receipt into the shared Today attention input", () => {
    const router = source();

    expect(router).toContain("noTrade: apertureUnderwritingRevisions.noTrade");
    expect(router).toContain('latestUnderwriting.noTrade ? "no_trade"');
    expect(router).toContain("resultSummary: latestUnderwriting?.noTrade?.explanation");
    expect(router).toContain("reopenCondition: latestUnderwriting?.noTrade?.reopenCondition ?? null");
  });
});
