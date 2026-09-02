import { describe, expect, it } from "vitest";
import { buildCapitalThesisCompilationFields, detailsFromCanonicalRecord, extractDeclaredResearchSymbols, normalizeCapitalThesisDetails } from "../../shared/capitalThesisStructure";
import { manualThesisProjection } from "../../shared/manualThesisProjection";
import { operatorDeclaredProjectionIfReady } from "./operatorDeclaredProjection";

describe("Capital thesis structured authoring", () => {
  it("persists typed fields and carries them through an honest compiler fallback", () => {
    const details = normalizeCapitalThesisDetails({
      belief: "NFL demand may support licensed sportsbook engagement.",
      evidence: "Verify the ruling, company exposure, and next earnings date.",
      seeks: "Compare bullish and bearish DKNG expressions.",
      avoids: "No uncovered or multi-leg options.",
      horizon: "Eight to sixteen weeks.",
      holdingPeriod: "position",
      invalidation: "Invalidate if the mechanism cannot be verified.",
      risk: "Maximum premium at risk is $250.",
      symbols: "dkng, DKNG",
      instrument: "options",
    });
    const fields = buildCapitalThesisCompilationFields(details);
    const graph = manualThesisProjection("Football and regulation thesis.", "Football Regulatory Split", details);

    expect(details.researchSymbols).toEqual(["DKNG"]);
    expect(fields.compiledFilters).toMatchObject({ holdingPeriod: "position", instrumentPreference: "options", researchSymbols: ["DKNG"] });
    expect(fields.evidenceRequirements).toEqual([details.evidence]);
    expect(fields.autoDisqualifiers).toEqual([details.invalidation]);
    expect(graph).toMatchObject({
      researchSymbols: ["DKNG"],
      horizons: ["Eight to sixteen weeks."],
      evidenceRequirements: [details.evidence],
      invalidationConditions: [details.invalidation],
      instrumentPreference: "options",
    });
    expect(graph.confidenceNotes.join(" ")).toMatch(/operator-declared/i);
  });

  it("recovers explicit declarations from a legacy canonical thesis without treating market acronyms as symbols", () => {
    const thesisText = "Paper-only intraday research after the 10:00 ET BLS release. Research a long IWM share expression only if IWM is above VWAP and its range high. Use at most $3,000 notional and $30 maximum planned loss, and preserve cash if tape evidence is missing.";
    const details = detailsFromCanonicalRecord({ thesisText });

    expect(extractDeclaredResearchSymbols(thesisText)).toEqual(["IWM"]);
    expect(details.researchSymbols).toEqual(["IWM"]);
    expect(details.instrumentPreference).toBe("shares");
    expect(details.holdingPeriod).toBe("intraday");
    expect(details.evidence).toMatch(/^only if IWM is above VWAP/);
    expect(details.invalidation).toMatch(/^preserve cash if tape evidence is missing/);
    expect(details.risk).toContain("$30 maximum planned loss");
  });

  it("keeps structured declarations authoritative over legacy text", () => {
    const details = detailsFromCanonicalRecord({
      thesisText: "Research a long IWM share expression only if IWM is above VWAP.",
      compiledFilters: {
        researchSymbols: ["DKNG"],
        instrumentPreference: "options",
      },
    });

    expect(details.researchSymbols).toEqual(["DKNG"]);
    expect(details.instrumentPreference).toBe("options");
  });

  it("bypasses provider projection when an intraday thesis already declares every research gate", () => {
    const thesisText = "Paper-only intraday research for Wednesday, September 2, 2026. Research one long IWM share expression after 9:45 ET only if IWM is above VWAP and the 9:30–9:45 range high, the 10-year Treasury yield is no higher than its 9:30 ET level, market breadth is positive, and IWM volume rate is at least 1.25 times normal. Use at most $1,000 notional and $20 maximum planned loss, size from entry-to-stop distance plus slippage, use a day limit order, and close by 3:45 ET. Preserve cash if any named evidence is missing, stale, contradictory, or the gate is not met.";

    const projection = operatorDeclaredProjectionIfReady({
      thesisText,
      name: "UAT — IWM Intraday Confirmation (Submit Path)",
    });

    expect(projection).not.toBeNull();
    expect(projection?.readiness).toMatchObject({ ready: true, missing: [], incompatibilities: [] });
    expect(projection?.graph).toMatchObject({
      researchSymbols: ["IWM"],
      instrumentPreference: "shares",
    });
    expect(projection?.graph.evidenceRequirements[0]).toMatch(/^only if IWM is above VWAP/);
    expect(projection?.graph.invalidationConditions[0]).toMatch(/^Preserve cash if any named evidence/);
  });
});
