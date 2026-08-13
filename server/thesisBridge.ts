import type { ThesisGraph } from "./aperture/thesisGraph";

export type CanonicalThesisSource = {
  id: number;
  name: string | null;
  thesisText: string;
};

/**
 * A Capital Aperture record is a compiled liquid-securities projection of one
 * canonical Signal Hunter thesis. The raw intent stays owned by the main
 * thesis record; this helper guarantees the projection cannot fork it.
 */
export function projectionValues(
  source: CanonicalThesisSource,
  graph: ThesisGraph,
  wasPrimary: boolean,
  now: number,
) {
  return {
    sourceCompilationId: source.id,
    name: source.name?.trim() || graph.suggestedName,
    rawText: source.thesisText,
    graph,
    confidenceNotes: graph.confidenceNotes,
    status: wasPrimary ? ("active" as const) : ("review" as const),
    updatedAt: now,
  };
}
