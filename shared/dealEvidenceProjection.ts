import { z } from "zod";
import { DEAL_EVIDENCE_FINDINGS_PROMPT_VERSION, dealEvidenceSnapshotSchema, evidenceICOutputSchema, evidenceRedTeamOutputSchema, SEC_ANALYSIS_LIMITATION, type DealEvidenceSnapshot, type EvidenceAnalysisOutput, type EvidenceFinding, type EvidenceCitation } from "./dealEvidence";

/** Shared by storage, model validation and presentation; never calls a provider. */
export function parseEvidenceAnalysisOutput(mode: "red_team" | "ic", raw: unknown, snapshot: DealEvidenceSnapshot, models: string[]): EvidenceAnalysisOutput {
  const output = mode === "ic" ? evidenceICOutputSchema.parse(raw) : evidenceRedTeamOutputSchema.parse(raw);
  const records = "scores" in output ? output.scores : [output];
  const v2 = snapshot.promptVersion === DEAL_EVIDENCE_FINDINGS_PROMPT_VERSION;
  if (v2 !== (output.outputVersion === 2) || records.some(record => v2 ? !record.insights : record.insights !== undefined)) throw new Error("Output version mismatch");
  z.array(z.string().min(1).max(128)).length(mode === "ic" ? 3 : 1).parse(models);
  const catalog = new Map(snapshot.citations.map(citation => [citation.id, citation]));
  if (catalog.size !== snapshot.citations.length) throw new Error("Duplicate source IDs");
  for (const source of snapshot.citations) {
    if (!snapshot.evidence.some(receipt => receipt.receiptId === source.receiptId && receipt.payloadHash === source.payloadHash)) throw new Error("Source version mismatch");
  }
  if ("scores" in output) {
    if (JSON.stringify(output.scores.map(score => score.model)) !== JSON.stringify(models)) throw new Error("Model provenance mismatch");
    const average = output.scores.reduce((sum, score) => sum + score.score, 0) / 3;
    const divergence = Math.sqrt(output.scores.reduce((sum, score) => sum + (score.score - average) ** 2, 0) / 3);
    if (Math.abs(output.consensusScore - average) > 1e-9 || Math.abs(output.divergenceScore - divergence) > 1e-9 || output.divergenceFlag !== (divergence > 0.15)) throw new Error("Consensus mismatch");
  }
  const prose = "scores" in output ? [output.summary, ...output.scores.map(score => score.rationale)] : [output.summary, ...output.redFlags];
  for (const record of records) {
    const findings = record.insights ?? [];
    if (new Set(findings.map(finding => finding.id)).size !== findings.length) throw new Error("Duplicate finding IDs");
    for (const group of [record.citations, ...findings.map(finding => finding.citations)]) {
      const seen = new Set<string>();
      for (const citation of group) {
        if (seen.has(citation.citationId) || catalog.get(citation.citationId)?.fact !== citation.quote) throw new Error("Unsupported citation");
        seen.add(citation.citationId);
      }
    }
    for (const finding of findings) {
      if (finding.action === "inspect_financing" && finding.criterion !== "financing") throw new Error("Action criterion mismatch");
      if (finding.citations.some(citation => !record.citations.some(parent => parent.citationId === citation.citationId))) throw new Error("Finding outside reviewer citations");
      for (const text of [finding.interpretation, finding.rationale, finding.uncertainty]) {
        for (const marker of Array.from(text.matchAll(/\bE\d+(?:F\d+)?\b/g))) {
          if (!finding.citations.some(citation => citation.citationId === marker[0])) throw new Error("Finding marker outside its citations");
        }
      }
      prose.push(finding.interpretation, finding.rationale, finding.uncertainty);
    }
  }
  for (const text of prose) {
    if (/https?:|www\.|\[[^\]]+\]\(|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i.test(text)) throw new Error("Unvalidated source in prose");
    for (const marker of Array.from(text.matchAll(/\bE\d+(?:F\d+)?\b/g))) if (!catalog.has(marker[0])) throw new Error("Unsupported citation marker");
  }
  return output;
}

/** Dates are the router's SuperJSON dates, not locale-dependent strings.
 * This selector is presentation scoping, NOT a substitute for server authorization. */
export type DealEvidenceProjectionRun = {
  id: string; ownerId: number; dealId: number; mode: "red_team" | "ic";
  startedAt: Date; completedAt: Date | null; status: "pending" | "failed" | "complete";
  inputSnapshot: unknown; models: string[]; output: unknown; failureCode: string | null; message: string | null;
};
export type ProjectedDealEvidenceInsight = Omit<EvidenceFinding, "citations" | "action"> & {
  key: string; model: string;
  citations: Array<EvidenceCitation & { quote: string }>;
  action: { type: EvidenceFinding["action"]; dealId: number; runId: string; insightKey: string; receiptIds: string[] };
};
export type DealEvidenceProjection = {
  state: "empty" | "pending" | "failed" | "legacy" | "ready" | "invalid";
  runId: string | null; mode: "red_team" | "ic" | null; message: string;
  limitation: typeof SEC_ANALYSIS_LIMITATION;
  insights: ProjectedDealEvidenceInsight[];
  /** Original validated output, for labeled historical/score inspection only. Never slice into insights. */
  output: EvidenceAnalysisOutput | null;
  freshness: Array<{ receiptId: string; staleAtRun: boolean; expiredNow: boolean; retrievedAt: string; expiresAt: string }>;
};
const base = (state: DealEvidenceProjection["state"], run: DealEvidenceProjectionRun | null, message: string): DealEvidenceProjection => ({ state, runId: run?.id ?? null, mode: run?.mode ?? null, message, limitation: SEC_ANALYSIS_LIMITATION, insights: [], output: null, freshness: [] });
const validDate = (date: unknown): date is Date => date instanceof Date && Number.isFinite(date.getTime());

export function projectDealEvidenceRun(run: DealEvidenceProjectionRun, now: Date): DealEvidenceProjection {
  try {
    z.string().uuid().parse(run.id);
    if (!validDate(now) || !validDate(run.startedAt) || !Number.isInteger(run.ownerId) || run.ownerId < 1 || !["ic", "red_team"].includes(run.mode)) throw new Error("Invalid run");
    const snapshot = dealEvidenceSnapshotSchema.parse(run.inputSnapshot);
    if (snapshot.deal.id !== run.dealId) throw new Error("Wrong deal snapshot");
    const freshness = snapshot.evidence.map(item => {
      if (Date.parse(item.expiresAt) < Date.parse(item.retrievedAt)) throw new Error("Invalid freshness interval");
      return { receiptId: item.receiptId, staleAtRun: item.staleAtRun, expiredNow: now.getTime() >= Date.parse(item.expiresAt), retrievedAt: item.retrievedAt, expiresAt: item.expiresAt };
    });
    if (run.status === "pending") {
      if (run.output !== null || run.completedAt !== null || run.failureCode !== null) throw new Error("Invalid pending run");
      return { ...base("pending", run, "Latest analysis is pending; no prior result substituted."), freshness };
    }
    if (!validDate(run.completedAt) || run.completedAt < run.startedAt) throw new Error("Invalid completion");
    if (run.status === "failed") {
      if (run.output !== null || !run.failureCode || !run.message) throw new Error("Invalid failed run");
      return { ...base("failed", run, "Latest analysis failed; inspect the saved failure. No prior result substituted."), freshness };
    }
    if (run.status !== "complete" || run.failureCode !== null || run.message !== null) throw new Error("Invalid completion state");
    const output = parseEvidenceAnalysisOutput(run.mode, run.output, snapshot, run.models);
    if (output.outputVersion !== 2) return { ...base("legacy", run, "Legacy analysis has run/reviewer citations only. Finding-level support and actions were not recorded."), output, freshness };
    const records = "scores" in output ? output.scores : [{ ...output, model: run.models[0] }];
    const insights = records.flatMap((record, reviewerIndex) => record.insights!.map(finding => {
      const key = `${run.id}:${reviewerIndex + 1}:${finding.id}`;
      const citations = finding.citations.map(reference => ({ ...snapshot.citations.find(citation => citation.id === reference.citationId)!, quote: reference.quote }));
      return { ...finding, key, model: record.model, citations, action: { type: finding.action, dealId: run.dealId, runId: run.id, insightKey: key, receiptIds: Array.from(new Set(citations.map(citation => citation.receiptId))) } };
    }));
    return { ...base("ready", run, "Model interpretations and hypotheses; cited metadata does not verify the inference."), insights, output, freshness };
  } catch { return base("invalid", run, "Saved analysis could not be validated; no prior result substituted."); }
}

export function selectDealEvidenceProjection(runs: readonly DealEvidenceProjectionRun[], scope: { ownerId: number; dealId: number; mode: "red_team" | "ic"; now: Date }): DealEvidenceProjection {
  const scoped = runs.filter(run => run.ownerId === scope.ownerId && run.dealId === scope.dealId && run.mode === scope.mode);
  // An unorderable scoped record is a visible corruption, not permission to use older success.
  if (!validDate(scope.now) || !Number.isInteger(scope.ownerId) || scope.ownerId < 1 || !Number.isInteger(scope.dealId) || scope.dealId < 1 || !["ic", "red_team"].includes(scope.mode) || scoped.some(run => !validDate(run.startedAt) || typeof run.id !== "string")) return base("invalid", null, "Run ordering could not be validated.");
  const latest = [...scoped].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || b.id.localeCompare(a.id))[0];
  return latest ? projectDealEvidenceRun(latest, scope.now) : base("empty", null, "No evidence analysis recorded for this deal and mode.");
}
