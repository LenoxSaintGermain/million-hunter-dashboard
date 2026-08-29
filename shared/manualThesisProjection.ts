import type { ThesisGraph } from "../server/aperture/thesisGraph";
import type { CapitalThesisDetails } from "./capitalThesisStructure";

/**
 * Honest fallback when the compiler is unavailable. It preserves only what the
 * operator typed and leaves every inferred field empty. Research may continue
 * later, but this draft does not claim sectors, exposure paths, or rules.
 */
export function manualThesisProjection(thesisText: string, name?: string | null, details?: CapitalThesisDetails): ThesisGraph {
  return {
    beliefs: details?.belief ? [details.belief] : [thesisText.trim()],
    seek: details?.seeks ? [details.seeks] : [],
    avoid: details?.avoids ? [details.avoids] : [],
    horizons: details?.horizon ? [details.horizon] : [],
    sectors: [],
    exclusions: [],
    portfolioRules: {},
    behavior: {},
    exposureTree: [],
    researchSymbols: details?.researchSymbols ?? [],
    evidenceRequirements: details?.evidence ? [details.evidence] : [],
    invalidationConditions: details?.invalidation ? [details.invalidation] : [],
    instrumentPreference: details?.instrumentPreference ?? null,
    confidenceNotes: [
      details
        ? "Manual thesis draft: the compiler was unavailable. Operator-declared structure was preserved; no sectors, exposure paths, portfolio rules, or trade conclusions were inferred."
        : "Manual thesis draft: the compiler was unavailable. No sectors, exposure paths, horizons, portfolio rules, or trade conclusions were inferred.",
    ],
    suggestedName: name?.trim() || "Capital / Trade Thesis",
  };
}
