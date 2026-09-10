/** Human evidence capture, not market-data verification or a new risk authority. */
export interface EvidenceQuestionDraft {
  observation: string;
  asOf: string;
  criterion: string;
  sourceUrl: string;
  note: string;
}

export const EMPTY_EVIDENCE_QUESTION: EvidenceQuestionDraft = {
  observation: "", asOf: "", criterion: "", sourceUrl: "", note: "",
};

export function describeEvidenceQuestion(symbol: string, checkLabel: string) {
  // Keep the original label as the durable review identity. Only presentation changes.
  const requirement = checkLabel.replace(/^[A-Z]\s*:\s*/, "").trim();
  const valuation = /^price\s*\/\s*(earnings|sales)$/i.exec(requirement)?.[1]?.toLowerCase();
  return {
    checkLabel,
    requirement,
    question: valuation
      ? `Does ${symbol}’s price / ${valuation} support the thesis at this valuation?`
      : `Does the evidence support this requirement for ${symbol}?`,
    observationHelp: valuation === "earnings"
      ? "Record the P/E ratio and whether it uses trailing or forward earnings. If not meaningful, explain why."
      : valuation === "sales"
        ? "Record the price / sales ratio and the revenue period used."
        : "Record the specific fact or finding, not a general company summary.",
    criterionHelp: valuation
      ? "Use the thesis’s valuation criterion or a sourced comparison, with its basis. No pass threshold is supplied by this label."
      : "State what would satisfy this requirement and why. Do not invent a missing pass condition.",
  };
}

function isSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

/** Fits the existing 1,000-character evidence-review note; never upgrades a provider fact. */
export function evidenceReviewNote(draft: EvidenceQuestionDraft) {
  return [
    "Operator-entered evidence; not independently verified.",
    `Observation: ${draft.observation.trim()}`,
    `As of: ${draft.asOf.trim()}`,
    `Criterion / basis: ${draft.criterion.trim()}`,
    `Source: ${draft.sourceUrl.trim()}`,
    ...(draft.note.trim() ? [`Review note: ${draft.note.trim()}`] : []),
  ].join("\n");
}

export function evidenceQuestionReadiness(draft: EvidenceQuestionDraft, now: number) {
  const issues: string[] = [];
  if (!draft.observation.trim()) issues.push("Observation not supplied");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.asOf) ? Date.parse(`${draft.asOf}T00:00:00Z`) : NaN;
  if (!draft.asOf) issues.push("As of: not supplied");
  else if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== draft.asOf || date > now) issues.push("Use a valid observation date, not a future date");
  if (!draft.criterion.trim()) issues.push("Criterion not supplied");
  if (!draft.sourceUrl.trim()) issues.push("Source not supplied");
  else if (!isSourceUrl(draft.sourceUrl.trim())) issues.push("Use an http or https source link without credentials");
  const note = evidenceReviewNote(draft);
  if (note.length > 1_000) issues.push("Shorten the evidence and note to 1,000 characters total");
  return { canResolve: issues.length === 0, issues, note };
}
