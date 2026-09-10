import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyMissionDraftValues, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import {
  parseStrategyDiscovery, type StrategyDiscoveryContext, type StrategyDiscoveryPayload,
} from "./strategyDiscovery";
import { DISCOVERY_RESEARCH_CONTEXT_LIMITS, prepareDiscoveryResearchContext } from "./discoveryResearchContext";
import { evaluateThesisResearchReadiness } from "./thesisResearchReadiness";
import type { ThesisGraph } from "./thesisGraph";

vi.mock("../db", () => { throw new Error("The pure mapper must not load the database"); });
vi.mock("../deepResearch", () => { throw new Error("The pure mapper must not load a provider"); });
vi.mock("./thesisGraph", () => { throw new Error("The pure mapper must not load the compiler"); });

// Frozen illustrative receipts. example.test is not a real issuer or a provider.
const cutoff = Date.UTC(2026, 8, 10, 14);
const day = 86_400_000;
function manifest(): StrategyDiscoveryContext {
  return {
    requestId: "illustrative-selection", provider: "illustrative-fixture", asOf: cutoff, receivedAt: cutoff,
    searchScope: "broader_permitted_universe", universePolicy: "cited_us_security_leads", permittedUniverse: [],
    citations: ["https://example.test/release", "https://example.test/contract"],
    sources: [
      { id: "release", originId: "issuer-release", originUrl: "https://example.test/release", sourceName: "Illustrative issuer release", sourceUrl: "https://example.test/release", observedAt: cutoff - 500, publishedAt: cutoff - 600, retrievedAt: cutoff - 400, quality: { kind: "primary", basis: "Illustrative originating issuer document; not a real customer." } },
      { id: "contract", originId: "contract-filing", originUrl: "https://example.test/contract", sourceName: "Illustrative contract filing", sourceUrl: "https://example.test/contract", observedAt: cutoff - 300, publishedAt: cutoff - 350, retrievedAt: cutoff - 200, quality: { kind: "primary", basis: "Illustrative contract document; no independently checked economics." } },
    ],
    providerState: { status: "available", failures: [] }, classifierState: { status: "available", failures: [] },
  };
}
function payload(): StrategyDiscoveryPayload {
  const assertion = (id: string, sourceId: string) => ({
    id, statement: `Illustrative ${id}: distribution might affect economic participation.`, assertionClass: "analyst_inference" as const,
    sourceIds: [sourceId], requiredConditions: [`${id}: incremental adoption must occur.`],
    contradictions: [`${id}: usage could displace existing sales.`], unknowns: [`${id}: pricing sensitivity is unresolved.`],
    invalidation: `${id}: no incremental adoption occurs after the distribution change.`,
  });
  return {
    schemaVersion: 1, searchScope: "broader_permitted_universe", reviewedUniverse: ["DATA", "ALT"], coverageGaps: ["The search does not cover all permitted alternatives."],
    hypotheses: [{
      id: "lead-1", title: "Illustrative distribution research", use: "new_play", horizon: "swing", disposition: "research_lead", rejectionReasons: [],
      whyThisUse: "Compare possible economic participation; no direction is established.",
      whyNow: "Revisit the recorded contract against prior expectations, not a presumed new catalyst.",
      whyNotAlternatives: "Other suppliers could earn fixed fees regardless of usage.",
      changeCondition: "Confirm the variable economics and incremental usage before proceeding.",
      causalPath: {
        id: "path-1", originatingSignal: { ...assertion("origin", "release"), assertionClass: "issuer_claim" },
        hops: [{ id: "hop-1", from: "Illustrative distribution", to: "Illustrative variable consideration", assertion: assertion("economic-link", "contract"),
          mechanism: { kind: "variable_usage", commercialTermsStatus: "unverified" },
          estimatedImpact: { basis: "unsupported", amountCents: null, description: "No supported economic estimate is available." },
          expectedTiming: "Next reporting period, if incremental adoption occurs.",
          nextFactToVerify: "Determine the actual consideration mechanism in the contract.",
          failureCondition: "Consideration is fixed regardless of incremental usage." }],
        affectedEntities: ["Illustrative supplier", "Illustrative distributor"],
        securityMapping: { entity: "Illustrative supplier", symbol: "DATA", status: "unverified" },
        whatChangedFromExpectations: "The recorded contract might change participation, conditional on new adoption.",
        counterargument: "Lower pricing on existing business could offset all incremental participation.",
        expectationsBaseline: { asOf: cutoff - 400, commercialLaunchStatus: "announced", sourceIds: ["release"], incrementalChange: assertion("incremental", "contract") },
        technologyPermission: { technicalCapabilityDocumented: true, rightsDocumented: false, jurisdictionAndProductIdentified: false, permissionStatus: "unverified", commercialLaunchStatus: "announced", adoptionObserved: false, financialImpactSupportable: false },
        marketMeasurement: { kind: "reported_activity", volumeObserved: false, claimedMetrics: ["handle"], methodology: "Illustrative reported activity; methodology not independently tested.", coverage: "Illustrative single jurisdiction, excluding other products.", asOf: cutoff - 100 },
        reviewAt: cutoff + day, expiresAt: cutoff + 2 * day,
      },
    }],
  };
}
function values(): MissionDraftValues {
  return {
    ...emptyMissionDraftValues(), accountId: 31, capital: "2,000.", maxLoss: " 100 ", targetProfit: "250.0",
    mission: "  Investigate this distribution claim.\nDo not assume adoption or deploy capital.  ",
    newBelief: "My hypothesis remains conditional.  ", reason: "Keep optionality.  ", blocker: "No proof of incrementality.",
    reopen: "Return only after checking the contract.", holdingPeriod: "position", holdingPeriods: ["position", "swing", "overnight"],
    instrument: "either", declaredCatalystAt: cutoff + day, declaredCatalystLabel: "User-declared date, not a confirmed catalyst",
  };
}
function input(body = payload(), context = manifest()) {
  const result = parseStrategyDiscovery(JSON.stringify(body), context);
  return { values: values(), result, hypothesisId: "lead-1", now: cutoff };
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
const prepare = (value = input()) => prepareDiscoveryResearchContext(value);

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No live network in mapper tests"); })));
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("selected discovery -> pure bounded INVESTIGATE context", () => {
  it("consumes the real parser result, chooses the hypothesis horizon and satisfies the research graph contract", () => {
    const request = input();
    expect(request.result.status).toBe("incomplete");
    expect(request.result.hypotheses[0].disposition).toBe("research_lead");
    const mapped = prepare(request);
    expect(Object.keys(mapped).sort()).toEqual(["symbol", "title", "rawText", "graph", "confidenceNotes", "invalidationRule", "reviewAt", "horizon", "sourceAsOf"].sort());
    expect(mapped).toMatchObject({ symbol: "DATA", title: payload().hypotheses[0].title, horizon: "swing", sourceAsOf: cutoff, reviewAt: cutoff + day });
    expect(mapped.graph).toMatchObject({ researchSymbols: ["DATA"], horizons: ["swing"], instrumentPreference: "either",
      exposureTree: [], sectors: [], exclusions: [], avoid: [], portfolioRules: {}, behavior: {} });
    expect(Object.keys(mapped.graph).sort()).toEqual(["beliefs", "seek", "avoid", "horizons", "sectors", "exclusions", "portfolioRules", "behavior", "exposureTree", "researchSymbols", "evidenceRequirements", "invalidationConditions", "instrumentPreference", "confidenceNotes", "suggestedName"].sort());
    expect(evaluateThesisResearchReadiness(mapped.graph as ThesisGraph, {
      holdingPeriod: mapped.horizon, instrumentPreference: "either", invalidationRule: mapped.invalidationRule,
    })).toMatchObject({ ready: true, declaredSymbols: ["DATA"] });
    expect(request.values.holdingPeriod).toBe("position");
    expect(request.values.holdingPeriods).toEqual(["position", "swing", "overnight"]);
  });

  it("does not demand a verified mapping or eligible independent origin to INVESTIGATE", () => {
    const context = manifest();
    for (const source of context.sources) {
      source.originId = null; source.originUrl = null; source.observedAt = null; source.publishedAt = null;
      source.quality = { kind: "unknown", basis: "Adapter could not establish provenance or source quality." };
    }
    context.providerState = { status: "partial", failures: ["Activity source could not be retrieved."] };
    context.classifierState = { status: "partial", failures: ["Independent classification is pending."] };
    const request = input(payload(), context);
    expect(request.result.hypotheses[0].assessment.independentOriginCount).toBe(0);
    const mapped = prepare(request);
    const evidence = mapped.graph.evidenceRequirements!.join("\n");
    for (const gap of ["security_mapping_unverified", "source_provenance_unverified", "source_time_unverified", "source_quality_unverified", ...context.providerState.failures, ...context.classifierState.failures, context.sources[0].quality.basis]) expect(evidence).toContain(gap);
    expect(mapped.confidenceNotes.join("\n")).toContain("independently confirm");
    expect(mapped.graph.researchSymbols).toEqual(["DATA"]);
  });

  it("preserves every decision-critical narrative and condition in the graph and raw record", () => {
    const body = payload();
    const selected = body.hypotheses[0];
    const path = selected.causalPath;
    path.originatingSignal.statement = "Illustrative claim line one.\nLine two has trailing spaces.  ";
    const request = input(body);
    const mapped = prepare(request);
    const evidence = mapped.graph.evidenceRequirements!.join("\n");
    const beliefs = mapped.graph.beliefs!.join("\n");
    const parsed = request.result.hypotheses[0].causalPath;
    const assertions = [parsed.originatingSignal, ...parsed.hops.map(hop => hop.assertion), parsed.expectationsBaseline!.incrementalChange!];
    expect(beliefs).toContain("User-declared Mission (not evidence)");
    expect(beliefs).toContain("User belief (not evidence)");
    expect(beliefs).toContain("Discovery inference (recorded issuer_claim");
    for (const item of assertions) {
      expect(beliefs).toContain(item.statement);
      expect(mapped.rawText).toContain(item.statement);
      for (const value of [...item.requiredConditions, ...item.contradictions, ...item.unknowns, item.invalidation]) {
        expect(evidence).toContain(value); expect(mapped.rawText).toContain(value);
      }
      expect(mapped.invalidationRule).toContain(item.invalidation);
    }
    for (const value of [selected.whyThisUse, selected.whyNow, selected.whyNotAlternatives, selected.changeCondition,
      path.whatChangedFromExpectations, path.counterargument, ...path.affectedEntities,
      path.hops[0].from, path.hops[0].to, path.hops[0].expectedTiming, path.hops[0].nextFactToVerify, path.hops[0].failureCondition,
      path.hops[0].estimatedImpact!.description, path.marketMeasurement!.methodology, path.marketMeasurement!.coverage]) {
      expect(evidence).toContain(value); expect(mapped.rawText).toContain(value);
    }
    expect(evidence).toContain("rightsDocumented:\nfalse");
    expect(evidence).toContain("financialImpactSupportable:\nfalse");
    expect(evidence).toContain("volumeObserved:\nfalse");
    expect(evidence).toContain("incrementalChange.requiredConditions");
    expect(evidence).toContain(`recorded timing.reviewAt:\n${path.reviewAt}`);
    expect(evidence).toContain(`recorded timing.expiresAt:\n${path.expiresAt}`);
    for (const value of [request.values.reason, request.values.blocker, request.values.reopen, request.values.declaredCatalystLabel!]) expect(evidence).toContain(value);
    for (const receipt of manifest().sources) for (const value of [receipt.sourceUrl, receipt.sourceName, receipt.quality.basis]) {
      expect(mapped.rawText).toContain(value); expect(evidence).toContain(value);
    }
    expect(mapped.rawText).toContain("Source asOf: 2026-09-10T14:00:00.000Z");
    expect(mapped.rawText).not.toContain("Verified source");
  });

  it("retains literal user inputs and all additional accepted horizons without aliasing or mutation", () => {
    const request = input(); const before = structuredClone(request);
    // Inject whitespace AFTER the production parser so losslessness tests the mapper.
    request.result.hypotheses[0].whyNow = "  Recorded timing.\nNo replacement catalyst.  ";
    before.result.hypotheses[0].whyNow = request.result.hypotheses[0].whyNow;
    deepFreeze(request);
    const mapped = prepare(request);
    expect(request).toEqual(before);
    for (const value of [request.values.mission, request.values.newBelief, request.values.capital, request.values.maxLoss,
      request.values.reason, request.values.blocker, request.values.reopen, request.result.hypotheses[0].whyNow]) expect(mapped.rawText).toContain(value);
    mapped.graph.confidenceNotes!.push("Changed output only");
    expect(mapped.confidenceNotes).not.toContain("Changed output only");
    expect(request).toEqual(before);
    const clock = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("Mapper must use input.now"); });
    expect(prepare(request)).toEqual(prepare(request)); expect(clock).not.toHaveBeenCalled();
  });

  it.each(["shares", "options", "either"] as const)("keeps exact %s instrument scope and invents no sizing or direction", instrument => {
    const request = input(); request.values.instrument = instrument;
    const mapped = prepare(request);
    expect(mapped.graph.instrumentPreference).toBe(instrument);
    for (const key of ["canonicalThesisId", "price", "score", "confidence", "underwriter", "qualified", "direction", "catalystAt"]) {
      expect(mapped).not.toHaveProperty(key); expect(mapped.graph).not.toHaveProperty(key);
    }
    expect(mapped.graph.portfolioRules).toEqual({}); expect(mapped.graph.behavior).toEqual({});
  });

  it("does not spread other hypotheses or other reviewed symbols into research", () => {
    const body = payload(); const other = structuredClone(body.hypotheses[0]);
    other.id = "lead-2"; other.causalPath.id = "path-2"; other.causalPath.securityMapping.symbol = "ALT";
    other.title = "Unselected illustrative hypothesis"; other.causalPath.counterargument = "Unselected material counterargument.";
    body.hypotheses.push(other);
    const mapped = prepare(input(body));
    expect(mapped.graph.researchSymbols).toEqual(["DATA"]);
    expect(mapped.rawText).not.toContain(other.title);
    expect(mapped.graph.evidenceRequirements!.join("\n")).not.toContain(other.causalPath.counterargument);
  });
});

describe("time boundaries are explicit facts, not invented freshness cutoffs", () => {
  it.each([1, 30, 365, 3650])("retains %i-day-old recorded research, requiring fresh validation", days => {
    const body = payload(); body.hypotheses[0].causalPath.reviewAt = null; body.hypotheses[0].causalPath.expiresAt = null;
    const request = input(body); request.now = cutoff + days * day;
    const mapped = prepare(request);
    expect(mapped.sourceAsOf).toBe(cutoff); expect(mapped.reviewAt).toBeNull();
    expect(mapped.graph.evidenceRequirements!.join("\n")).toContain("Fresh validation");
    expect(mapped.confidenceNotes.join("\n")).toContain("Older research is retained as recorded context");
  });
  it("preserves a due review without inventing a deadline extension or confusing it with expiry", () => {
    const request = input(); request.now = cutoff + day + 1;
    const mapped = prepare(request);
    expect(mapped.reviewAt).toBe(cutoff + day);
    expect(mapped.confidenceNotes.join("\n")).toContain("Recorded review is due");
  });
  it.each([
    [null, null, null], [null, cutoff + 2 * day, cutoff + 2 * day],
    [cutoff + day, null, cutoff + day], [cutoff + 3 * day, cutoff + 2 * day, cutoff + 2 * day],
  ])("uses only supplied review/expiry boundaries (%s, %s)", (reviewAt, expiresAt, expected) => {
    const body = payload(); Object.assign(body.hypotheses[0].causalPath, { reviewAt, expiresAt });
    expect(prepare(input(body)).reviewAt).toBe(expected);
  });
  it.each([cutoff + 2 * day, cutoff + 2 * day + 1])("rejects an originally valid lead now expired at %s", now => {
    const request = input(); request.now = now;
    expect(request.result.hypotheses[0].disposition).toBe("research_lead");
    expect(() => prepare(request)).toThrow("expired");
  });
  it.each([NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER, "2026-09-10", null, undefined])("rejects invalid selection timestamp %s", now => {
    const request = input(); Object.assign(request, { now }); expect(() => prepare(request)).toThrow();
  });
  it.each(["asOf", "receivedAt"] as const)("rejects a future manifest %s", field => {
    const request = input(); request.result.context![field] = cutoff + 1;
    if (field === "asOf") request.result.asOf = cutoff + 1;
    expect(() => prepare(request)).toThrow("future");
  });
  it.each([NaN, Infinity, -1, 0.5, "2026-09-10", null])("rejects malformed source asOf %s", asOf => {
    const request = input(); Object.assign(request.result, { asOf }); expect(() => prepare(request)).toThrow();
  });
  it.each(["reviewAt", "expiresAt"] as const)("rejects invalid %s without converting it to null", field => {
    for (const value of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER, "tomorrow", undefined]) {
      const request = input(); Object.assign(request.result.hypotheses[0].causalPath, { [field]: value }); expect(() => prepare(request)).toThrow();
    }
  });
  it.each(["observedAt", "publishedAt", "retrievedAt"] as const)("rejects future source %s even on an otherwise usable parsed result", field => {
    const context = manifest(); context.sources[0][field] = cutoff + 1;
    if (field === "retrievedAt") context.receivedAt = cutoff + 1;
    expect(() => prepare(input(payload(), context))).toThrow();
  });
  it.each(["expectationsBaseline", "marketMeasurement"] as const)("rejects future %s asOf rather than rewriting it", field => {
    const body = payload(); body.hypotheses[0].causalPath[field]!.asOf = cutoff + 1;
    const request = input(body); expect(request.result.hypotheses[0].disposition).toBe("research_lead");
    expect(() => prepare(request)).toThrow("future");
  });
  it("preserves historical source exclusions and does not use later evidence to rewrite the asOf", () => {
    const context = manifest(); context.receivedAt = cutoff + 1_000; context.sources[0].publishedAt = cutoff + 1;
    const request = input(payload(), context); request.now = context.receivedAt;
    const mapped = prepare(request);
    expect(mapped.sourceAsOf).toBe(cutoff);
    expect(mapped.graph.evidenceRequirements!.join("\n")).toContain("source_after_cutoff");
    expect(mapped.graph.evidenceRequirements!.join("\n")).toContain("Excluded source remains excluded");
  });
});

describe("fail closed on malformed or ineligible selection", () => {
  it.each(["missing", "", " lead-1 ", "x".repeat(161)])("requires exact selected identity %s", hypothesisId => {
    const request = input(); request.hypothesisId = hypothesisId; expect(() => prepare(request)).toThrow();
  });
  it("requires exactly one matching hypothesis, never first-match selection", () => {
    const request = input(); request.result.hypotheses.push(structuredClone(request.result.hypotheses[0]));
    expect(() => prepare(request)).toThrow("exactly one");
  });
  it.each(["rejected", "unavailable"] as const)("refuses the original %s disposition", disposition => {
    const request = input(); request.result.hypotheses[0].disposition = disposition;
    expect(() => prepare(request)).toThrow("not a research lead");
  });
  it("does not resurrect an explicitly rejected original hypothesis with structurally valid evidence", () => {
    const body = payload(); body.hypotheses[0].disposition = "reject"; body.hypotheses[0].rejectionReasons = ["The connection is immaterial to the issuer."];
    const request = input(body); request.result.hypotheses[0].disposition = "research_lead";
    expect(() => prepare(request)).toThrow("not a research lead");
  });
  it("rechecks unsupported causal conditions even if the saved summary still claims research_lead", () => {
    const request = input(); const hop = request.result.hypotheses[0].causalPath.hops[0];
    hop.mechanism.kind = "fixed_fee"; hop.estimatedImpact!.basis = "usage_driven";
    expect(() => prepare(request)).toThrow("unsupported");
  });
  it("rejects an unavailable result or an unusable source manifest", () => {
    for (const patch of [{ status: "unavailable" }, { context: null }, { asOf: null }, { contentSha256: null }]) {
      const request = input(); Object.assign(request.result, patch); expect(() => prepare(request)).toThrow();
    }
  });
  it.each(["providerState", "classifierState"] as const)("refuses %s failed sources", field => {
    const context = manifest(); context[field] = { status: "failed", failures: ["Illustrative source unavailable."] };
    expect(() => prepare(input(payload(), context))).toThrow();
  });
  it("refuses noSource narratives but retains a missing assertion source as a mandatory gap when other citations exist", () => {
    const body = payload(); const path = body.hypotheses[0].causalPath;
    path.originatingSignal.sourceIds = [];
    expect(prepare(input(body)).graph.evidenceRequirements!.join("\n")).toContain("Obtain missing source evidence for assertion [origin]");
    path.hops[0].assertion.sourceIds = []; path.expectationsBaseline = null;
    const context = manifest(); context.sources = []; context.citations = [];
    const request = input(body, context); expect(request.result.hypotheses[0].disposition).toBe("research_lead");
    expect(() => prepare(request)).toThrow("no source citations");
  });
  it("rejects invented/modified source links or metadata", () => {
    for (const patch of [{ sourceUrl: "https://example.test/invented" }, { sourceName: "Invented issuer receipt" }, { originId: "invented" }, { observedAt: 1 }]) {
      const request = input(); Object.assign(request.result.hypotheses[0].causalPath.originatingSignal.sources[0], patch);
      expect(() => prepare(request)).toThrow("source citation");
    }
  });
  it.each([null, "", "data", " DATA ", "$DATA", "DATA/ALT", "TOOLONG", "A..B", "DATA\n"])("rejects missing/malformed symbol %s", symbol => {
    const request = input(); request.result.hypotheses[0].causalPath.securityMapping.symbol = symbol;
    expect(() => prepare(request)).toThrow();
  });
  it("rejects non-public, outside-reviewed-universe and falsely certified broad mappings", () => {
    for (const patch of [{ status: "not_public" }, { symbol: "OTHER" }, { status: "verified" }, { status: false }]) {
      const request = input(); Object.assign(request.result.hypotheses[0].causalPath.securityMapping, patch);
      expect(() => prepare(request)).toThrow();
    }
  });
  it("accepts a syntactically valid class symbol without claiming qualification", () => {
    const body = payload(); body.reviewedUniverse.push("BRK.B"); body.hypotheses[0].causalPath.securityMapping.symbol = "BRK.B";
    expect(prepare(input(body)).symbol).toBe("BRK.B");
  });
  it("retains recorded verified mapping only in an exact-symbol search, still requiring fresh validation", () => {
    const context = manifest(); context.universePolicy = "declared_symbols"; context.permittedUniverse = ["DATA", "ALT"];
    const body = payload(); body.hypotheses[0].causalPath.securityMapping.status = "verified";
    const mapped = prepare(input(body, context));
    expect(mapped.symbol).toBe("DATA");
    expect(mapped.graph.evidenceRequirements!.join("\n")).toContain("Independently confirm the recorded entity-to-symbol mapping");
  });
  it("requires the selected horizon in holdingPeriods, not merely the parent's primary horizon", () => {
    const request = input(); request.values.holdingPeriod = "swing"; request.values.holdingPeriods = ["position"];
    expect(() => prepare(request)).toThrow("horizon not accepted");
    request.values.holdingPeriods = []; expect(() => prepare(request)).toThrow("horizon not accepted");
  });
  it.each(["", "   ", "TBD", "Watch it", "Not yet specified.   ", "x".repeat(19)])("requires substantive invalidation instead of %j", invalidation => {
    const request = input(); request.result.hypotheses[0].causalPath.originatingSignal.invalidation = invalidation;
    expect(() => prepare(request)).toThrow();
  });
  it("does not lose a missing invalidation on a downstream or incremental assertion", () => {
    for (const target of ["hop", "incremental"]) {
      const request = input(); const path = request.result.hypotheses[0].causalPath;
      (target === "hop" ? path.hops[0].assertion : path.expectationsBaseline!.incrementalChange!).invalidation = "Unknown";
      expect(() => prepare(request)).toThrow("substantive invalidation");
    }
  });
});

describe("strict storage and resource bounds never truncate conditions", () => {
  it.each(["score", "price", "direction", "canonicalThesisId", "qualifiedSecurity"])("refuses extra authority field %s", key => {
    const request = input(); Object.assign(request.result.hypotheses[0], { [key]: "invented" });
    expect(() => prepare(request)).toThrow("malformed");
  });
  it("rejects extra schema fields and non-null confidence", () => {
    for (const target of ["result", "path", "assessment"] as const) {
      const request = input();
      Object.assign(target === "result" ? request.result : target === "path" ? request.result.hypotheses[0].causalPath : request.result.hypotheses[0].assessment, { unexpected: true });
      expect(() => prepare(request)).toThrow();
    }
    const request = input(); Object.assign(request.result, { confidence: 1 }); expect(() => prepare(request)).toThrow();
  });
  it("bounds title at the existing 160-character storage width without slicing it", () => {
    const request = input(); request.result.hypotheses[0].title = "T".repeat(160);
    expect(prepare(request).title).toHaveLength(160);
    request.result.hypotheses[0].title += "!"; const before = structuredClone(request);
    expect(() => prepare(request)).toThrow("title exceeds"); expect(request).toEqual(before);
  });
  it("bounds original hypothesis count, hop count and assertion conditions", () => {
    const count = input(); count.result.hypotheses = Array.from({ length: 13 }, () => structuredClone(count.result.hypotheses[0]));
    expect(() => prepare(count)).toThrow();
    const hops = input(); const path = hops.result.hypotheses[0].causalPath;
    path.hops = Array.from({ length: 4 }, () => structuredClone(path.hops[0])); expect(() => prepare(hops)).toThrow();
    const conditions = input(); conditions.result.hypotheses[0].causalPath.originatingSignal.requiredConditions = Array(31).fill("Every condition must be retained.");
    expect(() => prepare(conditions)).toThrow();
  });
  it("bounds total rawText using UTF-8 storage bytes, not characters", () => {
    const request = input(); request.values.mission = "界".repeat(25_000);
    const before = structuredClone(request);
    expect(request.values.mission.length).toBeLessThan(DISCOVERY_RESEARCH_CONTEXT_LIMITS.rawTextBytes);
    expect(() => prepare(request)).toThrow("full source narrative exceeds"); expect(request).toEqual(before);
  });
  it("rejects an oversized receipt before building a projection", () => {
    const request = input(); request.result.coverageGaps = Array(1_024).fill("x".repeat(2_000));
    request.result.hypotheses[0].reasons = Array(50).fill("y".repeat(2_000));
    expect(() => prepare(request)).toThrow("input exceeds bounds");
  });
  it("rejects oversized user input and does not echo untrusted narrative in errors", () => {
    const request = input(); request.values.mission = "private-untrusted-marker".repeat(2_000);
    try { prepare(request); throw new Error("Expected rejection"); } catch (error) {
      expect(String(error)).toContain("invalid accepted Mission"); expect(String(error)).not.toContain("private-untrusted-marker");
    }
  });
});
