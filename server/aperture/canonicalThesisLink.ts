export function canonicalCapitalValues(input: { userId: number; name?: string | null; rawText: string }) {
  return {
    userId: input.userId,
    thesisText: input.rawText,
    name: input.name?.trim() || "Capital / Trade Thesis",
    templateUsed: "capital_trade" as const,
    compiledFilters: {},
    scoringWeights: [],
    evidenceRequirements: [],
    autoDisqualifiers: [],
    confidenceNotes: ["Capital / Trade scope: use the linked Aperture graph for securities analysis."],
    status: "review" as const,
  };
}

/** Legacy Aperture rows without a source compilation cannot appear in the canonical Thesis workspace. */
export function needsCanonicalPromotion(sourceCompilationId: number | null | undefined) {
  return sourceCompilationId == null;
}
