import { z } from "zod";

const note = z.string().trim().min(1).max(1200);
export const strategistInput = z.object({
  thesisText: z.string().trim().min(20).max(4000),
  scope: z.enum(["acquisition", "property"]),
  feedback: z.string().trim().max(2000).default(""),
});
export const strategistReviewSchema = z.object({
  brief: z.string().trim().min(20).max(4000),
  interpretation: note,
  assumptions: z.array(note).max(6),
  questions: z.array(note).max(5),
  feasibility: z.object({
    summary: note,
    capital: note,
    operations: note,
    failureModes: z.array(note).min(1).max(5),
    nextEvidence: z.array(note).min(1).max(5),
  }),
  angles: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    scope: z.enum(["acquisition", "property", "capital", "structure"]),
    mechanism: note,
    mustBeTrue: note,
    downside: note,
    evidence: note,
    nextStep: note,
    professionalReview: z.boolean(),
  })).max(4),
});
export type StrategistReview = z.infer<typeof strategistReviewSchema>;
export type AngleDisposition = "pending" | "investigate" | "park" | "reject";
export const strategistApprovalSchema = z.object({
  review: strategistReviewSchema,
  dispositions: z.array(z.enum(["investigate", "park", "reject"])).max(4),
}).refine(value => value.dispositions.length === value.review.angles.length, "Decide each strategic angle before approval");
export type StrategistApproval = z.infer<typeof strategistApprovalSchema>;
export function strategistReceipt(approval: StrategistApproval, thesisText: string): string[] {
  if (approval.review.brief.trim() !== thesisText.trim()) throw new Error("The approved brief does not match the submitted thesis");
  const value = strategistApprovalSchema.parse(approval);
  return [
    "Operator approved this brief for compilation only. Preliminary Strategist reasoning is unverified; no investment or tax qualification is established.",
    `Preliminary evaluation (not diligence): ${value.review.feasibility.summary} Capital: ${value.review.feasibility.capital} Operations: ${value.review.feasibility.operations}`,
    ...value.review.feasibility.failureModes.map(v => `Failure mode to investigate: ${v}`),
    ...value.review.feasibility.nextEvidence.map(v => `Evidence to request: ${v}`),
    ...value.review.assumptions.map(a => `Unverified proposed assumption: ${a}`),
    ...value.review.questions.map(q => `Unanswered question: ${q}`),
    ...value.review.angles.map((a, i) => `Strategic hypothesis [${value.dispositions[i]} / ${a.scope}]: ${a.title}. Mechanism: ${a.mechanism} Conditions: ${a.mustBeTrue} Downside: ${a.downside} Evidence: ${a.evidence} Next step: ${a.nextStep}. Approval is investigation only, not a filter or execution instruction.${a.professionalReview || a.scope === "structure" ? " Qualified professional review required." : ""}`),
  ];
}
export function reviewKey(text: string, scope: string, feedback: string) {
  return JSON.stringify([text.trim(), scope, feedback.trim()]);
}
