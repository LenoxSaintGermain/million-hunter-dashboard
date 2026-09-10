import { afterEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb: database.getDb }));
import {
  decisionReceiptPendingOutcome,
  authorizeDecisionAction,
  decisionActionBlock,
  missingDecisionAuthorityBlock,
  outcomeReviewAt,
  rankMissionLibrary,
  requiresCurrentDecisionBinding,
  type DecisionAuthorizationSnapshot,
} from "./decisionRunway";

const eligible: DecisionAuthorizationSnapshot = {
  source: "authoritative",
  decisionRunId: 9,
  revisionId: 12,
  effectiveBranch: "eligible",
  accountId: 4,
  researchRunId: 22,
  maxPlannedLossCents: 50_000,
};

describe("Decision Runway authorization", () => {
  it.each(["preflight", "create_proposal", "approve", "submit"] as const)(
    "keeps discovery %s research-only even with a claimed eligible binding", action => {
      const selected = { ...eligible, contextKind: "discovery" as const, validBinding: true };
      expect(decisionActionBlock(selected, action, "open")).toMatch(/capital source and allocation/);
      expect(decisionActionBlock(selected, action, "unknown")).not.toBeNull();
      expect(decisionActionBlock(selected, action, "close")).toBeNull();
    },
  );
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

  it.each(["preflight", "create_proposal", "approve", "submit"] as const)(
    "blocks each opening action at %s while a named conditional gate remains unresolved",
    (action) => {
      expect(decisionActionBlock({ ...eligible, effectiveBranch: "conditional" }, action, "open"))
        .toMatch(/conditional/i);
    },
  );

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

  it("preserves a proven close even when a newer authority binding makes an opening action stale", () => {
    const stale = { ...eligible, researchRunId: 23, accountId: 5 };
    expect(decisionActionBlock(stale, "submit", "open", { runId: 22, accountId: 4 })).toMatch(/binding/i);
    expect(decisionActionBlock(stale, "submit", "unknown", { runId: 22, accountId: 4 })).toMatch(/binding/i);
    expect(decisionActionBlock(stale, "submit", "close", { runId: 22, accountId: 4 })).toBeNull();
  });

  it("requires the current exact binding for every opening or unknown intent, never for a proven close", () => {
    expect(requiresCurrentDecisionBinding("open")).toBe(true);
    expect(requiresCurrentDecisionBinding("unknown")).toBe(true);
    expect(requiresCurrentDecisionBinding(null)).toBe(true);
    expect(requiresCurrentDecisionBinding("close")).toBe(false);
  });
});

describe("objective context cannot authorize opening exposure", () => {
  afterEach(() => vi.clearAllMocks());

  it.each(["preflight", "create_proposal", "approve", "submit"] as const)("blocks %s irrespective of branch while preserving closes", action => {
    for (const effectiveBranch of ["research", "eligible", "cash", "conditional"] as const) {
      for (const binding of [{ contextKind: "objective" as const }, { contextKind: "thesis" as const, validBinding: false }]) {
        const snapshot = { ...eligible, effectiveBranch, ...binding };
        expect(decisionActionBlock(snapshot, action, "open")).toMatch(/binding|objective/i);
        expect(decisionActionBlock(snapshot, action, "unknown")).toMatch(/binding|objective/i);
        expect(decisionActionBlock(snapshot, action, "close")).toBeNull();
      }
    }
  });

  function mockStore(head: Record<string, unknown>, revision: Record<string, unknown> | null = { id: 12, decisionRunId: 9, effectiveBranch: "eligible", maxPlannedLossCents: 50_000 }) {
    const limit = vi.fn().mockResolvedValueOnce([head]).mockResolvedValueOnce(revision ? [revision] : []);
    const builder = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit };
    const db = { select: vi.fn(() => builder), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() };
    database.getDb.mockResolvedValue(db);
    return db;
  }
  const head = { id: 9, userId: 1, contextKind: "thesis", canonicalThesisId: 11, capitalThesisId: 21, accountId: 4, researchRunId: 22, currentRevisionId: 12 };
  const input = { action: "submit" as const, userId: 1, runId: 22, accountId: 4 };

  it.each([
    ["objective", { contextKind: "objective", canonicalThesisId: null, capitalThesisId: null }],
    ["objective with grafted IDs", { contextKind: "objective" }],
    ["missing canonical", { canonicalThesisId: null }],
    ["missing projection", { capitalThesisId: null }],
    ["zero canonical", { canonicalThesisId: 0 }],
    ["invalid projection", { capitalThesisId: 1.5 }],
    ["unknown context", { contextKind: "future" }],
    ["null context", { contextKind: null }],
    ["legacy omitted context with null IDs", { contextKind: undefined, canonicalThesisId: null, capitalThesisId: null }],
  ])("rejects stored %s for OPEN/UNKNOWN, without writes", async (_label, patch) => {
    for (const intent of ["open", "unknown", undefined] as const) {
      const db = mockStore({ ...head, ...patch });
      await expect(authorizeDecisionAction({ ...input, intent })).rejects.toMatchObject({ code: "DECISION_BINDING_MISMATCH" });
      for (const op of [db.insert, db.update, db.delete, db.transaction]) expect(op).not.toHaveBeenCalled();
    }
  });

  it.each(["thesis", undefined])("accepts valid stored %s context with explicit binding proof in the returned snapshot", async contextKind => {
    mockStore({ ...head, contextKind });
    expect(await authorizeDecisionAction({ ...input, intent: "open" })).toMatchObject({ source: "authoritative", contextKind: "thesis", validBinding: true });
  });

  it.each(["missing current revision", "missing revision row", "present revision"])("preserves a proven close on an objective with %s", async scenario => {
    const db = mockStore({ ...head, contextKind: "objective", canonicalThesisId: null, capitalThesisId: null,
      currentRevisionId: scenario === "missing current revision" ? null : 12 }, scenario === "missing revision row" ? null : undefined);
    expect(await authorizeDecisionAction({ ...input, intent: "close" })).toMatchObject({ source: "authoritative", contextKind: "objective", validBinding: false });
    for (const op of [db.insert, db.update, db.delete, db.transaction]) expect(op).not.toHaveBeenCalled();
  });
});

describe("Decision Runway receipt look-backs", () => {
  it("queues a cash outcome review without creating an order binding", () => {
    expect(decisionReceiptPendingOutcome({
      branch: "cash",
      reviewAt: 1_800_000_000_000,
      reopenCondition: "Re-rank after verified evidence changes.",
      namedGateKey: null,
    })).toEqual({
      kind: "play_outcome",
      dueAt: 1_800_000_000_000,
      gateKey: null,
      reviewBasis: "Review the zero-exposure cash decision at its declared horizon. No order or automatic exit exists.",
    });
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

  it("puts a stale account behind the preserve-cash control rather than treating it as deployment-ready", () => {
    const ranked = rankMissionLibrary({
      thesisName: "Congressional disclosure follow-through",
      deployableCapitalCents: 10_000_000,
      holdingPeriod: "catalyst_window",
      objective: "deploy_today",
      concentrationUtilizationPct: 12,
      accountFreshnessMinutes: 31,
      hasVerifiedCatalyst: true,
    });
    expect(ranked[0].key).toBe("preserve_cash");
    expect(ranked.find((mission) => mission.key === "best_play")?.readiness).toBe("conditional");
    expect(ranked.find((mission) => mission.key === "deploy_today")?.readiness).toBe("conditional");
  });

  it("keeps a long-horizon disclosure investigation bounded to a catalyst question, not a same-day prediction", () => {
    const ranked = rankMissionLibrary({
      thesisName: "Congressional disclosure follow-through",
      deployableCapitalCents: 10_000_000,
      holdingPeriod: "catalyst_window",
      objective: "verify_catalyst",
      concentrationUtilizationPct: null,
      accountFreshnessMinutes: 5,
      hasVerifiedCatalyst: true,
    });
    const catalyst = ranked.find((mission) => mission.key === "dated_catalyst");
    expect(catalyst?.readiness).toBe("researchable");
    expect(catalyst?.missionText).toMatch(/verified/i);
    expect(catalyst?.missionText).not.toMatch(/return|profit|forecast/i);
  });
});

describe("outcome queue timing", () => {
  it("uses the named catalyst deadline when one exists", () => {
    expect(outcomeReviewAt("catalyst_window", 2_000, 1_000)).toBe(2_000);
  });

  it("preserves a stale declared deadline so the mandate rejects it instead of moving it", () => {
    expect(outcomeReviewAt("intraday", 1_000, 2_000)).toBe(1_000);
  });

  it("queues a swing review instead of asking for an immediate outcome", () => {
    expect(outcomeReviewAt("swing", null, 1_000)).toBe(1_000 + 7 * 24 * 60 * 60 * 1_000);
  });

  it("uses declared intraday and long-horizon review points without creating an automatic exit", () => {
    const now = 1_000;
    expect(outcomeReviewAt("intraday", null, now)).toBe(now + 8 * 60 * 60 * 1_000);
    expect(outcomeReviewAt("catalyst_window", null, now)).toBeNull();
  });
});
