import React from "react";
import { useEvidenceExpiry } from "./DealEvidenceExpiry";
import {
  projectDealEvidenceRun,
  type DealEvidenceProjection,
  type ProjectedDealEvidenceInsight,
} from "@shared/dealEvidenceProjection";
import type { DealEvidenceRun } from "../../../server/dealEvidenceRepository";

export type DealEvidenceDestination = "documents" | "capital" | "research";
export type DealEvidenceNavigate = (
  target: DealEvidenceDestination,
  action?: ProjectedDealEvidenceInsight["action"]
) => void;
export interface DealEvidenceInsightProps {
  run: DealEvidenceRun | null;
  projection?: DealEvidenceProjection;
  mode?: "red_team" | "ic";
  loading?: boolean;
  error?: string | null;
  historical?: boolean;
  onNavigate?: DealEvidenceNavigate;
  onInspect: (finding?: ProjectedDealEvidenceInsight) => void;
  onManageInputs: () => void;
  onRetry?: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
}
const actionStyle =
  "min-h-11 max-w-full whitespace-normal rounded-none shadow-none border border-[var(--sh-border)] bg-[var(--sh-primary)] px-3 py-2 text-sm text-[var(--sh-primary-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
const secondary =
  "min-h-11 max-w-full whitespace-normal rounded-none shadow-none px-2 py-2 text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2";
const excerpt = (value: string, length: number) =>
  value.length > length ? value.slice(0, length) + "…" : value;

/** Query-free reading surface. Selection belongs to the parent; projection is shared, not inferred from prose. */
export function DealEvidenceInsight(props: DealEvidenceInsightProps) {
  const now = useEvidenceExpiry(
    props.projection
      ? props.projection.freshness.map(item => item.expiresAt)
      : props.run?.inputSnapshot.evidence.map(item => item.expiresAt) || []
  );
  return <DealEvidenceInsightContent {...props} now={now} />;
}

export function DealEvidenceInsightContent({
  run,
  projection,
  mode,
  loading,
  error,
  historical,
  onInspect,
  onManageInputs,
  onRetry,
  onNavigate,
  headingRef,
  now = Date.now(),
}: DealEvidenceInsightProps & { now?: number }) {
  const recordedBasis =
    projection ?? (run ? projectDealEvidenceRun(run, new Date(now)) : null);
  const basis = recordedBasis && {
    ...recordedBasis,
    freshness: recordedBasis.freshness.map(item => ({
      ...item,
      expiredNow: now >= Date.parse(item.expiresAt),
    })),
  };
  const mismatch = Boolean(
    basis &&
      ((run && basis.runId !== run.id) ||
        (mode && basis.mode && basis.mode !== mode) ||
        (run && run.status !== "complete" && basis.state === "ready"))
  );
  const invalid = mismatch || basis?.state === "invalid";
  const state = basis?.state ?? "empty";
  const readable = !error && !loading && !invalid;
  const findings = readable && state === "ready" ? basis!.insights : [];
  const renderFinding = (
    finding: ProjectedDealEvidenceInsight,
    leading = false
  ) => {
    const navigate = finding.action.type !== "inspect_evidence" && onNavigate;
    return (
      <article
        key={finding.key}
        className="min-w-0 space-y-2"
        aria-label={"Finding: " + finding.criterion.replaceAll("_", " ")}
      >
        <p className="text-xs text-[var(--sh-text-secondary)]">
          {finding.kind === "hypothesis"
            ? "Hypothesis"
            : "Model interpretation"}{" "}
          · {finding.criterion.replaceAll("_", " ")}
        </p>
        <h3
          ref={leading ? headingRef : undefined}
          tabIndex={-1}
          className="font-serif text-lg leading-snug break-words focus-visible:outline focus-visible:outline-2"
        >
          {excerpt(finding.interpretation, 160)}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={actionStyle}
            onClick={() =>
              navigate
                ? onNavigate!(
                    finding.action.type === "inspect_financing"
                      ? "capital"
                      : "documents",
                    finding.action
                  )
                : onInspect(finding)
            }
          >
            {navigate
              ? finding.action.type === "inspect_financing"
                ? "Review financing assumptions"
                : "Review supporting documents"
              : "Inspect this finding’s evidence"}
          </button>
          {navigate && (
            <button
              type="button"
              className={secondary}
              onClick={() => onInspect(finding)}
            >
              Inspect basis
            </button>
          )}
        </div>
      </article>
    );
  };
  return (
    <section
      aria-label="Evidence-informed insight"
      className="min-w-0 space-y-3 border-y border-[var(--sh-border)] py-4 text-[var(--sh-text-primary)]"
    >
      <p className="text-xs text-[var(--sh-text-secondary)]">
        {historical ? "Historical analysis" : "Selected analysis"} ·{" "}
        {(basis?.mode || run?.mode || mode) === "ic" ? "Committee" : "Red Team"}
      </p>
      {!findings.length && (
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="font-serif text-xl focus-visible:outline focus-visible:outline-2"
        >
          {error
            ? "Analysis could not be read"
            : loading
              ? "Reading selected analysis"
              : invalid
                ? "Saved analysis could not be validated"
                : state === "empty"
                  ? "Evidence has not informed an analysis yet"
                  : state === "failed"
                    ? "Analysis failed; the question remains open"
                    : state === "pending"
                      ? "Analysis pending; no conclusion recorded"
                      : "Saved diligence hypothesis"}
        </h3>
      )}
      {(error || invalid) && (
        <p role="alert" className="text-sm break-words">
          {error ||
            (mismatch
              ? "Selected projection does not match this run or mode."
              : basis?.message)}{" "}
          No older success has been substituted.
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm">
          No new result is confirmed.
        </p>
      )}
      {readable && (state === "failed" || state === "pending") && (
        <p role="status" className="text-sm break-words">
          {basis?.message}
        </p>
      )}
      {readable && state === "legacy" && basis?.output && (
        <>
          <p className="text-sm leading-6 break-words">
            {excerpt(basis.output.summary, 240)}
          </p>
          <p className="text-sm text-[var(--sh-text-secondary)]">
            Legacy saved summary: finding-level implications and next steps were
            not recorded. Inspect its basis before deciding.
          </p>
        </>
      )}
      {findings[0] && renderFinding(findings[0], true)}
      {findings.length > 1 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-sm">
            Inspect {findings.length - 1} other recorded findings
          </summary>
          <div className="space-y-5">
            {findings.slice(1).map(finding => renderFinding(finding))}
          </div>
        </details>
      )}
      {readable && basis?.freshness.some(item => item.expiredNow) && (
        <p className="text-sm">
          Source basis expired now; this does not rewrite freshness at run time.
        </p>
      )}
      {readable && basis?.freshness.some(item => item.staleAtRun) && (
        <p className="text-sm">An expired snapshot was used at run time.</p>
      )}
      {!findings.length && (
        <button
          type="button"
          disabled={loading}
          onClick={
            (error || invalid) && onRetry
              ? onRetry
              : run
                ? () => onInspect()
                : onManageInputs
          }
          className={actionStyle}
        >
          {(error || invalid) && onRetry
            ? "Retry saved analysis"
            : run
              ? "Inspect analysis basis"
              : "Choose evidence inputs"}
        </button>
      )}
      <p
        data-evidence-basis
        className="text-xs text-[var(--sh-text-secondary)]"
      >
        {readable && basis?.freshness.length
          ? basis.freshness.length + " saved receipt versions · "
          : ""}
        SEC metadata only—not verified finances or approval.
      </p>
    </section>
  );
}

export function DealEvidenceFindingProof({
  finding,
  onInspectReceipt,
}: {
  finding: ProjectedDealEvidenceInsight;
  onInspectReceipt: (id: string) => void;
}) {
  return (
    <section aria-label="Selected finding proof" className="min-w-0 space-y-3">
      <h4 className="font-serif text-lg break-words">
        {finding.interpretation}
      </h4>
      <p className="text-sm break-words">{finding.rationale}</p>
      <p className="text-sm break-words">Uncertainty: {finding.uncertainty}</p>
      <p className="text-xs text-[var(--sh-text-secondary)]">
        The quoted metadata supports the stated fact, not independent
        verification of the inference. Inspection changes no approval.
      </p>
      {finding.citations.map(citation => (
        <div
          key={citation.id}
          className="space-y-2 border-t border-[var(--sh-border)] py-3"
        >
          <p className="text-sm break-words">{citation.fact}</p>
          <button
            type="button"
            className={secondary}
            onClick={() => onInspectReceipt(citation.receiptId)}
          >
            Inspect exact receipt · {citation.id}
          </button>
        </div>
      ))}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-xs">
          Finding version & model provenance
        </summary>
        <div className="space-y-2 text-xs [overflow-wrap:anywhere]">
          <p>Finding: {finding.key}</p>
          <p>Model: {finding.model}</p>
          {finding.citations.map(citation => (
            <p key={citation.id}>
              Receipt: {citation.receiptId}
              <br />
              Hash: {citation.payloadHash}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
