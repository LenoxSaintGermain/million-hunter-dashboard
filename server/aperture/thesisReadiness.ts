export type ReadinessThesis = {
  id: number;
  rawText: string;
  graph: unknown | null;
  confidenceNotes: string[] | null;
};

type CompiledGraph = { confidenceNotes?: string[] };

/**
 * A thesis graph is required by the research engine, but compilation is not an
 * operator workflow. This boundary prepares and persists it the first time a
 * saved belief is used to build a brief.
 */
export async function ensureThesisReady<T extends ReadinessThesis, TGraph extends CompiledGraph>(
  thesis: T,
  operations: {
    compile: (rawText: string) => Promise<TGraph>;
    persist: (value: { graph: TGraph; confidenceNotes: string[] }) => Promise<void>;
  },
): Promise<Omit<T, "graph" | "confidenceNotes"> & { graph: TGraph; confidenceNotes: string[] }> {
  if (thesis.graph) return thesis as Omit<T, "graph" | "confidenceNotes"> & { graph: TGraph; confidenceNotes: string[] };

  const graph = await operations.compile(thesis.rawText);
  const confidenceNotes = graph.confidenceNotes ?? [];
  await operations.persist({ graph, confidenceNotes });
  return { ...thesis, graph, confidenceNotes };
}
