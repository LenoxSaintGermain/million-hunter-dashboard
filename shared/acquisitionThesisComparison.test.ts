import { expect, it } from "vitest";
import { compareAcquisitionToThesis } from "./acquisitionThesisComparison";
const sources = [{ url: "https://example.com/listing", excerpt: "Maintenance contracts represent 80% of revenue. Owner must be replaced after sale.", asOf: 1000 }];
const assessments = [
  { dimension: "Recurring revenue", score: 1, explanation: "Broker reports recurring contracts", evidence: [{ sourceUrl: sources[0].url, quote: "Maintenance contracts represent 80% of revenue." }] },
  { dimension: "Management retention", score: 0, explanation: "Owner replacement required", evidence: [{ sourceUrl: sources[0].url, quote: "Owner must be replaced after sale." }] },
];
const weights = [{ dimension: "Recurring revenue", weight: 75 }, { dimension: "Management retention", weight: 25 }];
it("uses the exact thesis weights, including custom dimensions", () => {
  expect(compareAcquisitionToThesis({ weights, assessments, sources }).score).toBe(75);
  expect(compareAcquisitionToThesis({ weights: weights.map(row => ({ ...row, weight: 100 - row.weight })), assessments, sources }).score).toBe(25);
});
it("does not renormalize missing evidence into a complete score", () => {
  const result = compareAcquisitionToThesis({ weights, assessments: assessments.slice(0, 1), sources });
  expect(result).toMatchObject({ score: null, supportedPoints: 75, coveredWeight: 75, unresolvedPoints: 25, status: "needs_evidence" });
});
it("rejects fabricated quotes, unrelated URLs and duplicate assessments", () => {
  for (const evidence of [[{ sourceUrl: sources[0].url, quote: "Customers are very sticky and loyal" }], [{ sourceUrl: "https://unrelated.example", quote: sources[0].excerpt }]]) {
    expect(compareAcquisitionToThesis({ weights, sources, assessments: [{ ...assessments[0], evidence }] }).coveredWeight).toBe(0);
  }
  expect(compareAcquisitionToThesis({ weights, sources, assessments: [assessments[0], assessments[0]] }).coveredWeight).toBe(0);
});
it("requires complete unique weight definitions and bounded scores", () => {
  expect(() => compareAcquisitionToThesis({ weights: weights.slice(0, 1), sources, assessments })).toThrow();
  expect(() => compareAcquisitionToThesis({ weights: [{ dimension: "Same", weight: 50 }, { dimension: "same", weight: 50 }], sources, assessments })).toThrow();
  expect(compareAcquisitionToThesis({ weights, sources, assessments: [{ ...assessments[0], score: 1.1 }] }).score).toBeNull();
});
