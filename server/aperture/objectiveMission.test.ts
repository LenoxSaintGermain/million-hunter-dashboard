import { describe, expect, it } from "vitest";
import { emptyMissionDraftValues } from "../../shared/apertureMissionDraft";
import { prepareObjectiveMission, parseDeclaredCents, declaredObjectiveCapitalEvent } from "./objectiveMission";

const values = () => ({ ...emptyMissionDraftValues(), accountId: 31,
  mission: "Illustrative: compare uses of my excess capital over the next month.",
  capital: "25,000", maxLoss: "250", targetProfit: "6,000", targetPeriod: "week" as const,
  holdingPeriod: "swing" as const, holdingPeriods: ["swing" as const],
  strategyContext: { schemaVersion: 1 as const, requestId: "00000000-0000-4000-8000-000000000011",
    intent: "deploy_excess_capital" as const, searchScope: "broader_permitted_universe" as const,
    requestedSymbols: [], declarationId: "00000000-0000-4000-8000-000000000012", sourceOrder: null, profitReserve: "" },
});

describe("accepted objective Mission assumptions", () => {
  it("binds a stable declaration independently of request and target, without verified cash", () => {
    const source = declaredObjectiveCapitalEvent(prepareObjectiveMission(values()));
    expect(source).toEqual({ accountId: 31, amountCents: 2_500_000, currency: "USD",
      sourceKind: "operator_declared_excess", sourceId: "declared:00000000-0000-4000-8000-000000000012",
      sourceKey: "declaration:00000000-0000-4000-8000-000000000012", capitalEventId: "declaration:00000000-0000-4000-8000-000000000012" });
    const revised = values(); revised.targetProfit = "60,000";
    revised.strategyContext.requestId = "00000000-0000-4000-8000-000000000013";
    expect(declaredObjectiveCapitalEvent(prepareObjectiveMission(revised))).toEqual(source);
  });
  it.each(["explore_opportunity", "review_material_change", "redeploy_realized_gains"] as const)("does not register %s as declared cash", intent => {
    const original = values();
    const accepted = prepareObjectiveMission({ ...original, strategyContext: { ...original.strategyContext,
      intent, declarationId: null, sourceOrder: intent === "redeploy_realized_gains"
        ? { accountId: 31, runId: 1, candidateId: 2, orderId: 3 } : null } });
    expect(declaredObjectiveCapitalEvent(accepted)).toBeNull();
    expect(accepted.availableCapitalCents).toBeNull();
  });
  it("accepts an explicit capital objective with no canonical thesis and no invented invalidation", () => {
    const result = prepareObjectiveMission(values());
    expect(result).toMatchObject({ canonicalThesisId: null, accountId: 31, deployableCapitalCents: 2_500_000,
      maxPlannedLossCents: 25_000, targetProfitCents: 600_000, targetPeriod: "week", invalidationRule: null,
      sourceBasis: "operator_declared", availableCapitalCents: null, permittedRiskCents: null });
  });
  it("never changes declared risk when target pressure changes", () => {
    const a = prepareObjectiveMission(values());
    const b = prepareObjectiveMission({ ...values(), targetProfit: "60,000" });
    expect(a.maxPlannedLossCents).toBe(b.maxPlannedLossCents);
    expect(a.permittedRiskCents).toBeNull(); expect(b.permittedRiskCents).toBeNull();
  });
  it.each(["1e3", "Infinity", "-1", "1.001", "1,00", "9007199254740992", "", ".", "$500"])("rejects ambiguous or unsafe required money %s", value => {
    expect(() => prepareObjectiveMission({ ...values(), capital: value })).toThrow();
  });
  it("parses dollars without floating-point rounding or treating a zero as missing", () => {
    expect(parseDeclaredCents("1,234.56")).toBe(123456);
    expect(parseDeclaredCents("0.29")).toBe(29);
    expect(parseDeclaredCents("0")).toBe(0);
    expect(() => prepareObjectiveMission({ ...values(), capital: "0" })).toThrow();
    expect(prepareObjectiveMission({ ...values(), targetProfit: "" }).targetProfitCents).toBeNull();
  });
  it.each(["current_thesis", "related_opportunities"] as const)("requires a chosen thesis for %s without adopting an active profile thesis", scope => {
    expect(() => prepareObjectiveMission({ ...values(), strategyContext: { ...values().strategyContext, searchScope: scope } })).toThrow(/thesis/i);
    expect(prepareObjectiveMission({ ...values(), canonicalThesisId: 41, strategyContext: { ...values().strategyContext, searchScope: scope } }).canonicalThesisId).toBe(41);
  });
  it("keeps gain planning hypothetical; an order reference is not verified proceeds", () => {
    const result = prepareObjectiveMission({ ...values(), strategyContext: { ...values().strategyContext,
      intent: "redeploy_realized_gains", declarationId: null, profitReserve: "600",
      sourceOrder: { accountId: 31, runId: 1, candidateId: 2, orderId: 3 } } });
    expect(result).toMatchObject({ sourceBasis: "hypothetical_only", availableCapitalCents: null, profitReserveCents: 60000 });
  });
  it("requires exact source context, rather than guessing an order or declaration", () => {
    expect(() => prepareObjectiveMission({ ...values(), strategyContext: { ...values().strategyContext, declarationId: null } })).toThrow(/declaration/i);
    expect(() => prepareObjectiveMission({ ...values(), strategyContext: { ...values().strategyContext, intent: "redeploy_realized_gains" } })).toThrow(/source order/i);
  });
  it("rejects unfinished or different dispositions; acceptance is not a cash receipt", () => {
    expect(() => prepareObjectiveMission({ ...values(), branch: "cash" })).toThrow();
    expect(() => prepareObjectiveMission({ ...values(), mission: "" })).toThrow();
    expect(() => prepareObjectiveMission({ ...values(), holdingPeriods: [] })).toThrow();
    expect(() => prepareObjectiveMission({ ...values(), holdingPeriods: ["position"] })).toThrow();
    expect(() => prepareObjectiveMission({ ...values(), maxLoss: "25,001" })).toThrow();
    expect(() => prepareObjectiveMission({ ...values(), strategyContext: null })).toThrow();
  });
});
