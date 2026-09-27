import { z } from "zod";

const weightsSchema = z.array(z.object({
  dimension: z.string().trim().min(1).max(200),
  weight: z.number().int().min(1).max(100),
})).min(1).max(30).superRefine((rows, ctx) => {
  if (rows.reduce((sum, row) => sum + row.weight, 0) !== 100)
    ctx.addIssue({ code: "custom", message: "Thesis weights must total 100" });
  if (new Set(rows.map(row => row.dimension.toLowerCase())).size !== rows.length)
    ctx.addIssue({ code: "custom", message: "Thesis dimensions must be unique" });
});

export type ThesisWeight = z.infer<typeof weightsSchema>[number];
export type CriterionAssessment = {
  dimension: string;
  score: number | null;
  explanation: string;
  evidence: Array<{ sourceUrl: string; quote: string }>;
};
export type ComparisonSource = { url: string; excerpt: string; asOf: number };

/** A model may assess a criterion; only this function calculates weighted results.
 * Quotes must exist in the captured source. That grounds a claim, not its truth.
 * Missing evidence never becomes neutral/positive support or a smaller denominator.
 */
export function compareAcquisitionToThesis(input: {
  weights: unknown;
  assessments: CriterionAssessment[];
  sources: ComparisonSource[];
}) {
  const weights = weightsSchema.parse(input.weights);
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  const dimensions = weights.map(weight => {
    const matches = input.assessments.filter(row => row.dimension === weight.dimension);
    const assessment = matches.length === 1 ? matches[0] : undefined;
    const grounded = assessment?.evidence.length && assessment.evidence.every(evidence =>
      evidence.quote.trim().length >= 12 && input.sources.some(source =>
        source.url === evidence.sourceUrl && Number.isFinite(source.asOf) &&
        normalize(source.excerpt).includes(normalize(evidence.quote))));
    const score = grounded && assessment?.score != null && Number.isFinite(assessment.score) &&
      assessment.score >= 0 && assessment.score <= 1 ? assessment.score : null;
    return {
      ...weight, score,
      contribution: score == null ? null : score * weight.weight,
      explanation: score == null ? "Evidence is missing or cannot support this criterion yet." : assessment!.explanation,
      evidence: score == null ? [] : assessment!.evidence,
    };
  });
  const coveredWeight = dimensions.reduce((sum, row) => sum + (row.score == null ? 0 : row.weight), 0);
  const supportedPoints = dimensions.reduce((sum, row) => sum + (row.contribution ?? 0), 0);
  return {
    dimensions, coveredWeight,
    score: coveredWeight === 100 ? supportedPoints : null,
    supportedPoints,
    unresolvedPoints: 100 - coveredWeight,
    status: coveredWeight === 100 ? "assessed" as const : "needs_evidence" as const,
    basis: "source_claims_not_independently_verified" as const,
  };
}
