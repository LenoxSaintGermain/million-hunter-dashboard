import { describe, expect, it } from "vitest";
import { immutableReceiptBindingIssue, revisionJsonForInsert } from "./decisionReceiptBinding";
import { emptyMissionDraftValues } from "../../shared/apertureMissionDraft";

const run = { ownerId: 1, canonicalThesisId: 11, capitalThesisId: 21, accountId: 31 };
const contextSnapshot = { canonicalThesisId: 11, capitalThesisId: 21, accountId: 31 };
const gateSnapshot = { mandateVersion: "capital-v1" };

describe("copying immutable revision JSON", () => {
  const fields = { holdingPeriods: ["swing"], contextSnapshot, gateSnapshot, rankingSnapshot: null };
  it("preserves decoded driver values without changing the original", () => {
    expect(revisionJsonForInsert(fields)).toEqual(fields);
  });
  it("decodes text-driver values once before insertion", () => {
    const stored = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, JSON.stringify(value)])) as typeof fields;
    expect(revisionJsonForInsert(stored)).toEqual(fields);
    expect(typeof stored.contextSnapshot).toBe("string");
  });
  it.each(["holdingPeriods", "contextSnapshot", "gateSnapshot", "rankingSnapshot"] as const)("rejects malformed or double-encoded %s", key => {
    expect(() => revisionJsonForInsert({ ...fields, [key]: "{broken" })).toThrow();
    expect(() => revisionJsonForInsert({ ...fields, [key]: JSON.stringify(JSON.stringify(fields[key])) })).toThrow();
  });
});

describe("immutable Decision Runway receipt bindings", () => {
  it("accepts the exact owner, thesis, account, and mandate snapshot", () => {
    expect(immutableReceiptBindingIssue({ requestedOwnerId: 1, run, contextSnapshot, gateSnapshot })).toBeNull();
  });

  it.each([
    ["other owner", { requestedOwnerId: 2, run, contextSnapshot, gateSnapshot }, "owner"],
    ["canonical thesis drift", { requestedOwnerId: 1, run, contextSnapshot: { ...contextSnapshot, canonicalThesisId: 12 }, gateSnapshot }, "canonical_thesis"],
    ["projection drift", { requestedOwnerId: 1, run, contextSnapshot: { ...contextSnapshot, capitalThesisId: 22 }, gateSnapshot }, "capital_thesis"],
    ["account drift", { requestedOwnerId: 1, run, contextSnapshot: { ...contextSnapshot, accountId: 32 }, gateSnapshot }, "account"],
    ["missing mandate revision", { requestedOwnerId: 1, run, contextSnapshot, gateSnapshot: {} }, "mandate"],
  ])("fail-closes %s", (_label, input, expected) => {
    expect(immutableReceiptBindingIssue(input)).toBe(expected);
  });
});

const requestId = "00000000-0000-4000-8000-000000000011";
function objectiveReceipt(selectedCanonicalThesisId: number | null = null) {
  const acceptedDraft = {
    ...emptyMissionDraftValues(), accountId: 31, canonicalThesisId: selectedCanonicalThesisId,
    mission: "Illustrative: compare uses of my declared capital.", capital: "1000", maxLoss: "100",
    strategyContext: {
      schemaVersion: 1 as const, requestId, intent: "deploy_excess_capital" as const,
      searchScope: "broader_permitted_universe" as const, requestedSymbols: [],
      declarationId: "00000000-0000-4000-8000-000000000012", sourceOrder: null, profitReserve: "",
    },
  };
  return {
    requestedOwnerId: 1,
    run: { ownerId: 1, contextKind: "objective" as const, clientRequestId: requestId, canonicalThesisId: null, capitalThesisId: null, accountId: 31 },
    contextSnapshot: { contextKind: "objective", requestId, canonicalThesisId: null, capitalThesisId: null,
      selectedCanonicalThesisId, accountId: 31, sourceDraftId: 4, sourceDraftVersion: 2, acceptedDraft,
      sourceBasis: "operator_declared", availableCapitalCents: null },
    gateSnapshot: { mandateVersion: "capital-v1", paperOnly: true, humanApprovalRequired: true, riskAuthorityState: "pending_verification", permittedRiskCents: null, sourceAvailabilityVerified: false },
  };
}

describe("objective receipt identity is not a fabricated thesis binding", () => {
  it.each([null, 11])("accepts a strict snapshot with selected canonical %s only in its draft/context", selected => {
    expect(immutableReceiptBindingIssue(objectiveReceipt(selected))).toBeNull();
  });

  it.each([
    ["missing head kind", (r: any) => { delete r.run.contextKind; }],
    ["missing context kind", (r: any) => { delete r.contextSnapshot.contextKind; }],
    ["unknown head kind", (r: any) => { r.run.contextKind = "future"; }],
    ["wrong context kind", (r: any) => { r.contextSnapshot.contextKind = "thesis"; }],
    ["canonical ID on objective", (r: any) => { r.run.canonicalThesisId = r.contextSnapshot.canonicalThesisId = 11; }],
    ["projection ID on objective", (r: any) => { r.run.capitalThesisId = r.contextSnapshot.capitalThesisId = 21; }],
    ["missing null canonical field", (r: any) => { delete r.contextSnapshot.canonicalThesisId; }],
    ["missing request", (r: any) => { delete r.run.clientRequestId; }],
    ["invalid request", (r: any) => { r.run.clientRequestId = r.contextSnapshot.requestId = "not-a-uuid"; }],
    ["mismatched request", (r: any) => { r.contextSnapshot.requestId = "00000000-0000-4000-8000-000000000013"; }],
    ["draft request drift", (r: any) => { r.contextSnapshot.acceptedDraft.strategyContext.requestId = "00000000-0000-4000-8000-000000000013"; }],
    ["draft account drift", (r: any) => { r.contextSnapshot.acceptedDraft.accountId = 32; }],
    ["draft selected thesis drift", (r: any) => { r.contextSnapshot.acceptedDraft.canonicalThesisId = 11; }],
    ["missing selected thesis field", (r: any) => { delete r.contextSnapshot.selectedCanonicalThesisId; }],
    ["invalid selected thesis", (r: any) => { r.contextSnapshot.selectedCanonicalThesisId = r.contextSnapshot.acceptedDraft.canonicalThesisId = 0; }],
    ["missing draft identity", (r: any) => { delete r.contextSnapshot.sourceDraftId; }],
    ["invalid draft identity", (r: any) => { r.contextSnapshot.sourceDraftId = -1; }],
    ["invalid draft version", (r: any) => { r.contextSnapshot.sourceDraftVersion = 1.5; }],
    ["unsafe draft version", (r: any) => { r.contextSnapshot.sourceDraftVersion = Number.MAX_SAFE_INTEGER + 1; }],
    ["missing accepted draft", (r: any) => { delete r.contextSnapshot.acceptedDraft; }],
    ["missing strategy", (r: any) => { delete r.contextSnapshot.acceptedDraft.strategyContext; }],
    ["extra draft proof claim", (r: any) => { r.contextSnapshot.acceptedDraft.verifiedAvailableCents = 100_000; }],
    ["other receipt grafted into original draft", (r: any) => { r.contextSnapshot.acceptedDraft.baseDecisionRunId = 91; r.contextSnapshot.acceptedDraft.baseDecisionRevisionId = 92; }],
    ["invented available capital", (r: any) => { r.contextSnapshot.availableCapitalCents = 100_000; }],
    ["invented source verification", (r: any) => { r.contextSnapshot.sourceBasis = "verified"; }],
    ["invented risk verification", (r: any) => { r.gateSnapshot.riskAuthorityState = "verified"; }],
    ["invented permitted risk", (r: any) => { r.gateSnapshot.permittedRiskCents = 100; }],
    ["paper boundary removed", (r: any) => { r.gateSnapshot.paperOnly = false; }],
    ["approval boundary removed", (r: any) => { r.gateSnapshot.humanApprovalRequired = false; }],
    ["missing mandate", (r: any) => { delete r.gateSnapshot.mandateVersion; }],
  ])("rejects %s", (_label, mutate) => {
    const input = objectiveReceipt();
    mutate(input);
    expect(immutableReceiptBindingIssue(input)).not.toBeNull();
  });

  it("does not classify omitted kind as a legacy thesis when IDs are not positive integers", () => {
    for (const id of [null, undefined, 0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(immutableReceiptBindingIssue({ requestedOwnerId: 1, run: { ...run, canonicalThesisId: id } as any,
        contextSnapshot: { ...contextSnapshot, canonicalThesisId: id }, gateSnapshot })).toBe("canonical_thesis");
      expect(immutableReceiptBindingIssue({ requestedOwnerId: 1, run: { ...run, capitalThesisId: id } as any,
        contextSnapshot: { ...contextSnapshot, capitalThesisId: id }, gateSnapshot })).toBe("capital_thesis");
    }
  });

  it("keeps explicit thesis and legacy snapshots compatible, but rejects cross-kind snapshots", () => {
    expect(immutableReceiptBindingIssue({ requestedOwnerId: 1, run: { ...run, contextKind: "thesis" }, contextSnapshot, gateSnapshot })).toBeNull();
    expect(immutableReceiptBindingIssue({ requestedOwnerId: 1, run, contextSnapshot: { ...contextSnapshot, contextKind: "objective" }, gateSnapshot })).not.toBeNull();
  });
});
