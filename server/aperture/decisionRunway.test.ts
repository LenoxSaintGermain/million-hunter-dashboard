import { describe, expect, it } from "vitest";
import {
  decisionActionBlock,
  missingDecisionAuthorityBlock,
  outcomeReviewAt,
  rankMissionLibrary,
  type DecisionAuthorizationSnapshot,
} from "./decisionRunway";

const eligible: DecisionAuthorizationSnapshot = {
  source: "authoritative",
  decisionRunId: 9,
  revisionId: 12,
  effectiveBranch: "eligible",
  accountId: 4,
  researchRunId: 22,
};

describe("Decision Runway authorization", () => {
  it.each(["preflight", "create_proposal", "approve", "submit"] as const)(
    "blocks an opening action at %s when cash is current",
    (action) => {
      expect(decisionActionBlock({ ...eligible, effectiveBranch: "cash" }, action, "open"))
        .toMatch(/cash/i);
    },
  );

  it("blocks unresolved conditional branches but does not trap a proven close", () => {
    const conditional = { ...eligible, effectiveBranch: "conditional" as const };
    expect(decisionActionBlock(conditional, "submit", "open")).toMatch(/conditional/i);
    expect(decisionActionBlock(conditional, "submit", "close")).toBeNull();
  });

  it("fails closed when an authoritative binding no longer matches the run or account", () => {
    expect(decisionActionBlock({ ...eligible, researchRunId: 23 }, "create_proposal", "open", { runId: 22, accountId: 4 }))
      .toMatch(/binding/i);
    expect(decisionActionBlock({ ...eligible, accountId: 5 }, "approve", "open", { runId: 22, accountId: 4 }))
      .toMatch(/binding/i);
  });

  it("fails closed for unbound opening actions while preserving a proven close", () => {
    expect(missingDecisionAuthorityBlock("open")).toMatch(/no authoritative Decision Run binding/i);
    expect(missingDecisionAuthorityBlock("unknown")).toMatch(/fail-closed/i);
    expect(missingDecisionAuthorityBlock("close")).toBeNull();
  });
});

describe("contextual Mission Library", () => {
  it("raises portfolio-gap and cash controls when concentration is near its ceiling", () => {
    const ranked = rankMissionLibrary({
      thesisName: "AI Infrastructure Compounding",
      deployableCapitalCents: 25_000_000,
      holdingPeriod: "swing",
      objective: "best_qualified_play",
      concentrationUtilizationPct: 96,
      accountFreshnessMinutes: 7,
      hasVerifiedCatalyst: false,
    });
    expect(ranked[0].key).toBe("portfolio_gap");
    expect(ranked[0].reasons.join(" ")).toMatch(/concentration/i);
    expect(ranked.some((mission) => mission.key === "preserve_cash")).toBe(true);
  });

  it("does not advertise a dated-catalyst mission without verified catalyst context", () => {
    const ranked = rankMissionLibrary({
      thesisName: "Durable cash flow",
      deployableCapitalCents: 5_000_000,
      holdingPeriod: "catalyst_window",
      objective: "verify_catalyst",
      concentrationUtilizationPct: null,
      accountFreshnessMinutes: 4,
      hasVerifiedCatalyst: false,
    });
    expect(ranked.find((mission) => mission.key === "dated_catalyst")?.readiness).toBe("conditional");
  });
});

describe("outcome queue timing", () => {
  it("uses the named catalyst deadline when one exists", () => {
    expect(outcomeReviewAt("catalyst_window", 2_000, 1_000)).toBe(2_000);
  });

  it("queues a swing review instead of asking for an immediate outcome", () => {
    expect(outcomeReviewAt("swing", null, 1_000)).toBe(1_000 + 7 * 24 * 60 * 60 * 1_000);
  });
});
