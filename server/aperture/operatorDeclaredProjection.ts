import { detailsFromCanonicalRecord, type CapitalThesisDetails } from "../../shared/capitalThesisStructure";
import { manualThesisProjection } from "../../shared/manualThesisProjection";
import type { ThesisGraph } from "./thesisGraph";
import { evaluateThesisResearchReadiness, type ThesisResearchReadiness } from "./thesisResearchReadiness";

type CanonicalCapitalSource = {
  thesisText: string;
  name?: string | null;
  compiledFilters?: unknown;
  evidenceRequirements?: unknown;
  autoDisqualifiers?: unknown;
};

/**
 * Prefer exact operator declarations over a provider reinterpretation when the
 * canonical thesis already states every field required to begin research.
 * Returning null is an honest signal that open-ended provider discovery is
 * still needed; no missing structure is invented here.
 */
export function operatorDeclaredProjectionIfReady(source: CanonicalCapitalSource): {
  declared: CapitalThesisDetails;
  graph: ThesisGraph;
  readiness: ThesisResearchReadiness;
} | null {
  const declared = detailsFromCanonicalRecord(source);
  const graph = manualThesisProjection(source.thesisText, source.name, declared);
  const readiness = evaluateThesisResearchReadiness(graph, {
    holdingPeriod: declared.holdingPeriod,
    instrumentPreference: declared.instrumentPreference,
    invalidationRule: declared.invalidation || null,
  });

  return readiness.ready ? { declared, graph, readiness } : null;
}
