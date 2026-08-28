import type { ThesisGraph } from "../server/aperture/thesisGraph";

/**
 * Honest fallback when the compiler is unavailable. It preserves only what the
 * operator typed and leaves every inferred field empty. Research may continue
 * later, but this draft does not claim sectors, exposure paths, or rules.
 */
export function manualThesisProjection(thesisText: string, name?: string | null): ThesisGraph {
  return {
    beliefs: [thesisText.trim()],
    seek: [],
    avoid: [],
    horizons: [],
    sectors: [],
    exclusions: [],
    portfolioRules: {},
    behavior: {},
    exposureTree: [],
    confidenceNotes: [
      "Manual thesis draft: the compiler was unavailable. No sectors, exposure paths, horizons, portfolio rules, or trade conclusions were inferred.",
    ],
    suggestedName: name?.trim() || "Capital / Trade Thesis",
  };
}
