import type { CapitalMissionHoldingPeriod, CapitalMissionInstrument } from "../../shared/capitalMissionDefaults";
import type { ThesisGraph } from "./thesisGraph";

export type ThesisResearchReadiness = {
  ready: boolean;
  missing: string[];
  incompatibilities: string[];
  declaredSymbols: string[];
};

export function evaluateThesisResearchReadiness(
  graph: ThesisGraph,
  run: {
    holdingPeriod: CapitalMissionHoldingPeriod | null;
    instrumentPreference: CapitalMissionInstrument | null;
    invalidationRule: string | null;
  },
): ThesisResearchReadiness {
  const declaredSymbols = graph.researchSymbols ?? [];
  const missing: string[] = [];
  const incompatibilities: string[] = [];
  if (declaredSymbols.length === 0 && graph.exposureTree.length === 0) missing.push("search universe");
  if ((graph.evidenceRequirements ?? []).length === 0 && graph.seek.length === 0) missing.push("evidence requirement");
  if (!(run.invalidationRule?.trim() || (graph.invalidationConditions ?? []).length)) missing.push("invalidation condition");
  if (!(run.holdingPeriod || graph.horizons.length)) missing.push("holding horizon");
  if (!run.instrumentPreference || run.instrumentPreference === "either") missing.push("instrument preference");
  if (graph.instrumentPreference === "options" && run.instrumentPreference === "shares") {
    incompatibilities.push("The thesis requires options, but this run is configured for shares.");
  }
  if (graph.instrumentPreference === "shares" && run.instrumentPreference === "options") {
    incompatibilities.push("The thesis requires shares, but this run is configured for options.");
  }
  return { ready: missing.length === 0 && incompatibilities.length === 0, missing, incompatibilities, declaredSymbols };
}
