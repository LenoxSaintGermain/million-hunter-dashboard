import type { StrategistReview } from "../../shared/strategistReview";
/** Deterministic visual/test fixture. Not a live agent assessment or real opportunity. */
export const strategistReviewFixture: StrategistReview = {
  brief: "Acquire an automated express car wash. Prefer recurring memberships and limited daily owner involvement. Purchase budget, geography and property ownership remain unspecified.",
  interpretation: "Illustrative interpretation: a similar operating model, not an established franchise relationship. Confirm what 'like El Car Wash' means to you.",
  assumptions: ["Automated does not mean absentee: staffing, equipment downtime and customer service still need ownership."],
  questions: ["What purchase budget and geography fit?", "Would you own the site, lease it, or consider either?"],
  feasibility: {
    summary: "Too little evidence to assess investability. This is a preliminary map of what to investigate.",
    capital: "Purchase equity, working capital, equipment replacement and site costs are unknown. Request separate operating-business and property valuations.",
    operations: "Test membership retention, maintenance burden, water costs and manager continuity before relying on limited owner involvement.",
    failureModes: ["Reported memberships may conceal churn or discounting.", "A short lease or major equipment replacement can change the economics."],
    nextEvidence: ["Membership cohorts and cancellation history", "Lease or title records, equipment inspection and repair history"],
  },
  angles: [{
    title: "Could the site—not the wash—be the enduring asset?", scope: "property",
    mechanism: "If the site is included and has independently supportable value, separate the property thesis from operating cash flow.",
    mustBeTrue: "Ownership, zoning, permitted use and independent valuation must support the case.",
    downside: "Environmental liabilities or use restrictions could outweigh location value.",
    evidence: "Title, zoning, environmental assessment, comparable transactions and lease terms.",
    nextStep: "Ask whether the property is included; commission qualified assessment before creating a separate property thesis.",
    professionalReview: true,
  }],
};
