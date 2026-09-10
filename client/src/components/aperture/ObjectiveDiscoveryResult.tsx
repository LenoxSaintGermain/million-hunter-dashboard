import React from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

export type ObjectiveDiscoverySnapshot = inferRouterOutputs<AppRouter>["aperture"]["strategy"]["get"];
export type ObjectiveDiscoveryResultProps = {
  snapshot: ObjectiveDiscoverySnapshot;
  busy: boolean;
  refreshing?: boolean;
  failure?: string | null;
  actionBlockedReason?: string | null;
  onRefresh: () => void;
  onRetry: () => void;
  onStart: () => void;
};

type Receipt = NonNullable<ObjectiveDiscoverySnapshot["receipt"]>;
type Hypothesis = Receipt["result"]["hypotheses"][number];
type Assertion = Hypothesis["causalPath"]["originatingSignal"];
type Source = Assertion["sources"][number];
const surface = { background: "var(--sh-surface)", borderColor: "var(--sh-border-1)" };
const muted = { color: "var(--sh-fg-2)" };
const control = "min-h-11 w-full rounded-md border px-4 py-2 text-sm font-medium sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const disclosure = "min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const words = (value: string) => value.replaceAll("_", " ");
const unique = (values: string[]) => Array.from(new Set(values.filter(value => value.trim())));
const joined = (values: string[], absent: string) => unique(values).join(" · ") || absent;

function Timestamp({ at }: { at: number | null | undefined }) {
  if (at == null || !Number.isFinite(new Date(at).getTime())) return <>Not supplied</>;
  const iso = new Date(at).toISOString();
  return <time dateTime={iso}>{iso.replace("T", " ").replace(".000Z", " UTC")}</time>;
}

function Citation({ url, label }: { url: string; label: string }) {
  // The parser checks URLs too; never make an unsafe retained value navigable.
  let safe = false;
  try {
    const parsed = new URL(url);
    safe = ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch { /* A missing citation stays an explicit gap. */ }
  return safe
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="break-words underline underline-offset-2 focus-visible:outline focus-visible:outline-2">{label}</a>
    : <span>{label} — source link unavailable</span>;
}

function Citations({ sources }: { sources: Source[] }) {
  return <p style={muted}>Sources: {sources.length ? sources.map((source, index) => <React.Fragment key={source.id}>
    {index > 0 && " · "}<Citation url={source.sourceUrl} label={source.sourceName} />
  </React.Fragment>) : "No eligible source citation supplied; evidence is unverified."}</p>;
}

function AssertionRecord({ assertion }: { assertion: Assertion }) {
  return <div className="space-y-1">
    <p>{words(assertion.assertionClass)}: {assertion.statement}</p>
    <Citations sources={assertion.sources} />
    <p>Required conditions: {joined(assertion.requiredConditions, "Not supplied")}</p>
    <p>Unknowns: {joined(assertion.unknowns, "None recorded; not proof of certainty")}</p>
    <p>Contradictions: {joined(assertion.contradictions, "None recorded")}</p>
    <p>Invalidation: {assertion.invalidation || "Not supplied"}</p>
  </div>;
}

function LeadSummary({ hypothesis }: { hypothesis: Hypothesis }) {
  const path = hypothesis.causalPath;
  const uncertainty = unique([...hypothesis.assessment.unknowns, ...path.originatingSignal.unknowns,
    ...path.hops.flatMap(hop => hop.assertion.unknowns), ...hypothesis.reasons.map(words)]);
  const additionalConditions = unique([...path.originatingSignal.requiredConditions,
    ...path.hops.flatMap(hop => [...hop.assertion.requiredConditions, hop.assertion.invalidation, hop.failureCondition, hop.nextFactToVerify])]);
  return <article aria-label={hypothesis.title} className="min-w-0 space-y-2 rounded-lg border p-4" style={surface}>
    <div>
      <p className="text-xs" style={muted}>{words(hypothesis.horizon)} · Research lead · Unverified</p>
      <h3 className="mt-1 text-base font-semibold">{hypothesis.title}</h3>
    </div>
    <p>{hypothesis.whyNow}</p>
    <p><strong>Needs verification:</strong> {uncertainty[0] || "Independent validation has not been completed."}
      {uncertainty.length > 1 && ` ${uncertainty.length - 1} more recorded gaps in details.`}</p>
    <p><strong>Counterargument:</strong> {path.counterargument}</p>
    <p><strong>Invalidated if:</strong> {path.originatingSignal.invalidation || "Invalidation condition not supplied"}</p>
    <p><strong>Reopen when:</strong> {hypothesis.changeCondition || "A change condition is not supplied; review the evidence gaps first."}</p>
    <Citations sources={hypothesis.assessment.sources} />
    <details>
      <summary className={disclosure}>Evidence and conditions · {additionalConditions.length} additional conditions</summary>
      <div className="space-y-2">
        <p>Recorded gaps: {joined(uncertainty, "Independent validation has not been completed.")}</p>
        <AssertionRecord assertion={path.originatingSignal} />
        {path.hops.map(hop => <div key={hop.id} className="space-y-1">
          <p className="font-medium">{hop.from} → {hop.to}</p>
          <AssertionRecord assertion={hop.assertion} />
          <p>Failure condition: {hop.failureCondition}</p>
          <p>Next fact to verify: {hop.nextFactToVerify}</p>
          <p>Timing: {hop.expectedTiming}</p>
        </div>)}
      </div>
    </details>
  </article>;
}

function ReceiptRecord({ receipt }: { receipt: Receipt }) {
  const result = receipt.result;
  return <div className="space-y-4 text-sm leading-6">
    <dl className="grid min-w-0 gap-x-4 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
      <dt>Record</dt><dd>#{receipt.id} · Attempt {receipt.attempt} · {words(result.status)}</dd>
      <dt>Saved</dt><dd><Timestamp at={receipt.createdAt} /></dd>
      <dt>Research as of</dt><dd><Timestamp at={result.asOf} /></dd>
      <dt>Question</dt><dd>{receipt.request.mission}</dd>
      <dt>Scope</dt><dd>{words(receipt.request.searchScope)} · {words(receipt.request.universePolicy)}</dd>
      <dt>Reviewed universe</dt><dd>{joined(result.reviewedUniverse, "No securities recorded as reviewed")}</dd>
      <dt>Requested horizons</dt><dd>{receipt.request.holdingPeriods.map(words).join(" · ")}</dd>
      <dt>Coverage gaps</dt><dd>{joined(result.coverageGaps.map(words), "None recorded; coverage is bounded, not exhaustive")}</dd>
      <dt>Request identity</dt><dd className="break-all">{result.requestId ?? "Not supplied"}</dd>
      <dt>Content fingerprint</dt><dd className="break-all">{result.contentSha256 ?? "Not supplied"}</dd>
    </dl>

    <section aria-label="All hypotheses">
      <h4 className="font-semibold">All hypotheses · Recorded order, not ranked</h4>
      {!result.hypotheses.length && <p>No usable hypothesis records supplied.</p>}
      {result.hypotheses.map(hypothesis => <details key={hypothesis.id} className="border-b" style={{ borderColor: "var(--sh-border-1)" }}>
        <summary className={disclosure}>{hypothesis.title} — {words(hypothesis.disposition)}</summary>
        <div className="space-y-3 pb-4">
          <p>Recorded reasons: {joined(hypothesis.reasons.map(words), "None recorded")}</p>
          <p>Research use: {hypothesis.use === "new_play" ? "New research hypothesis" : "Incremental existing thesis"} · {words(hypothesis.horizon)}</p>
          <p>Why this use: {hypothesis.whyThisUse}</p>
          <p>Why now: {hypothesis.whyNow}</p>
          <p>Why not alternatives: {hypothesis.whyNotAlternatives}</p>
          <p>Change from expectations: {hypothesis.causalPath.whatChangedFromExpectations || "Not supplied"}</p>
          <p>Counterargument: {hypothesis.causalPath.counterargument}</p>
          <p>Reopen when: {hypothesis.changeCondition}</p>
          <p>Review at: <Timestamp at={hypothesis.causalPath.reviewAt} /> · Expires: <Timestamp at={hypothesis.causalPath.expiresAt} /></p>
          <p>Security mapping: {hypothesis.causalPath.securityMapping.entity} · {hypothesis.causalPath.securityMapping.symbol ?? "No symbol supplied"} · {words(hypothesis.causalPath.securityMapping.status)} (not trading eligibility)</p>
          <p>Assessment gaps: {joined(hypothesis.assessment.unknowns, "None recorded")}</p>
          <p>Contradictions: {joined(hypothesis.assessment.contradictions, "None recorded")}</p>
          <AssertionRecord assertion={hypothesis.causalPath.originatingSignal} />
          {hypothesis.causalPath.expectationsBaseline ? <section aria-label="Expectations baseline" className="space-y-1">
            <h5 className="font-semibold">Expectations baseline</h5>
            <p>As of <Timestamp at={hypothesis.causalPath.expectationsBaseline.asOf} /> · Launch {words(hypothesis.causalPath.expectationsBaseline.commercialLaunchStatus)}</p>
            <Citations sources={hypothesis.causalPath.expectationsBaseline.sources} />
            {hypothesis.causalPath.expectationsBaseline.incrementalChange
              ? <AssertionRecord assertion={hypothesis.causalPath.expectationsBaseline.incrementalChange} />
              : <p>No incremental change assertion supplied.</p>}
          </section> : <p>Expectations baseline not supplied.</p>}
          {hypothesis.causalPath.marketMeasurement && <section aria-label="Market measurement" className="space-y-1">
            <h5 className="font-semibold">Market measurement</h5>
            <p>{words(hypothesis.causalPath.marketMeasurement.kind)} · As of <Timestamp at={hypothesis.causalPath.marketMeasurement.asOf} /></p>
            <p>Methodology: {hypothesis.causalPath.marketMeasurement.methodology}</p>
            <p>Coverage: {hypothesis.causalPath.marketMeasurement.coverage}</p>
            <p>Claimed metrics: {joined(hypothesis.causalPath.marketMeasurement.claimedMetrics.map(words), "None supplied")}. Volume observed: {hypothesis.causalPath.marketMeasurement.volumeObserved ? "Yes" : "No"}.</p>
          </section>}
          {hypothesis.causalPath.technologyPermission && <section aria-label="Technology permission record" className="space-y-1">
            <h5 className="font-semibold">Technology permission record</h5>
            <p>Permission {words(hypothesis.causalPath.technologyPermission.permissionStatus)} · Launch {words(hypothesis.causalPath.technologyPermission.commercialLaunchStatus)}</p>
            <p>Capability documented: {hypothesis.causalPath.technologyPermission.technicalCapabilityDocumented ? "Yes" : "No"}. Rights documented: {hypothesis.causalPath.technologyPermission.rightsDocumented ? "Yes" : "No"}. Jurisdiction and product identified: {hypothesis.causalPath.technologyPermission.jurisdictionAndProductIdentified ? "Yes" : "No"}.</p>
            <p>Adoption observed: {hypothesis.causalPath.technologyPermission.adoptionObserved ? "Yes" : "No"}. Financial impact supportable: {hypothesis.causalPath.technologyPermission.financialImpactSupportable ? "Yes" : "No"}.</p>
          </section>}
          <h5 className="font-semibold">Source / calculation record</h5>
          {!hypothesis.causalPath.hops.length && <p>No economic-link calculation supplied. No return or portfolio-risk calculation is inferred.</p>}
          {hypothesis.causalPath.hops.map(hop => <section key={hop.id} aria-label={`${hop.from} to ${hop.to}`} className="space-y-1 border-l-2 pl-3" style={{ borderColor: "var(--sh-border-1)" }}>
            <h6 className="font-medium">{hop.from} → {hop.to}</h6>
            <AssertionRecord assertion={hop.assertion} />
            <p>Mechanism: {words(hop.mechanism.kind)} · Commercial terms {words(hop.mechanism.commercialTermsStatus)}</p>
            <p>Recorded impact: {hop.estimatedImpact ? <>
              {words(hop.estimatedImpact.basis)} · {hop.estimatedImpact.amountCents == null ? "Amount not supplied" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(hop.estimatedImpact.amountCents / 100)}. {hop.estimatedImpact.description}
            </> : "No calculation supplied"}</p>
            <p>Timing: {hop.expectedTiming}</p>
            <p>Next fact to verify: {hop.nextFactToVerify}</p>
            <p>Failure condition: {hop.failureCondition}</p>
          </section>)}
          <p>Independent origins recorded: {hypothesis.assessment.independentOriginCount}; not a probability of profit.</p>
          {hypothesis.assessment.excludedSources.map(({ source, reasons }, index) => <p key={`${source.id}-${index}`}>
            Excluded source: <Citation url={source.sourceUrl} label={source.sourceName} /> — {reasons.map(words).join(" · ")}
          </p>)}
        </div>
      </details>)}
    </section>

    <section aria-label="Rejected and unavailable hypotheses">
      <h4 className="font-semibold">Rejected / unavailable hypotheses</h4>
      {result.rejectedHypotheses.length ? <ul className="list-disc space-y-1 pl-5">{result.rejectedHypotheses.map((item, index) => <li key={`${item.index}-${index}`}>
        {item.id ?? `Unnamed hypothesis at record index ${item.index}`} — {joined(item.reasons.map(words), "Reason not supplied")}
      </li>)}</ul> : <p>No rejection records supplied.</p>}
      {result.issues.map((issue, index) => <p key={index}>Record issue: {words(issue.code)}{issue.path && ` (${issue.path})`}</p>)}
    </section>

    <section aria-label="Source manifest" className="space-y-2">
      <h4 className="font-semibold">Source manifest</h4>
      {!result.context && <p>Source manifest not supplied. Provenance and completeness cannot be confirmed.</p>}
      {result.context && <>
        <p>Provider: {result.context.provider} · {result.context.providerState.status}. Classifier: {result.context.classifierState.status}.</p>
        <p>Provider / classifier gaps: {joined([...result.context.providerState.failures, ...result.context.classifierState.failures].map(words), "None recorded")}</p>
      </>}
      {!result.context?.sources.length && <p>No source records supplied; evidence is unverified.</p>}
      {result.context?.sources.map(source => <div key={source.id} className="space-y-1">
        <Citation url={source.sourceUrl} label={source.sourceName} />
        <p>{source.quality.kind} · {source.quality.basis}</p>
        <p>Origin: {source.originUrl ? <Citation url={source.originUrl} label={source.originId ?? "Origin identity unavailable"} /> : "Not supplied"}</p>
        <p>Observed: <Timestamp at={source.observedAt} /> · Published: <Timestamp at={source.publishedAt} /> · Retrieved: <Timestamp at={source.retrievedAt} /></p>
      </div>)}
      {!!result.context?.citations.length && <p>Retrieval citations: {result.context.citations.map((url, index) => <React.Fragment key={`${url}-${index}`}>
        {index > 0 && " · "}<Citation url={url} label={`Source ${index + 1}`} />
      </React.Fragment>)}</p>}
    </section>
  </div>;
}

/** Controlled presentation only. The parent owns status reads and explicit job actions. */
export function ObjectiveDiscoveryResult({ snapshot, busy, refreshing = false, failure, actionBlockedReason, onRefresh, onRetry, onStart }: ObjectiveDiscoveryResultProps) {
  const { job, receipt, latestAttempt, usingPreviousResult } = snapshot;
  const result = receipt?.result;
  const unavailable = result?.status === "unavailable";
  const missingCompleteResult = job.state === "complete" && (!result || unavailable);
  const failed = !!failure || job.state === "failed" || missingCompleteResult;
  const status = failed ? "failed" : job.state === "not_started" ? "not-started" : job.state;
  const statusLabel = { "not-started": "Not started", running: "Running", failed: "Failed", interrupted: "Interrupted", complete: "Complete" }[status];
  // Never manufacture a rank or promote rejected/unavailable dispositions.
  const leads = !unavailable ? result?.hypotheses.filter(item => item.disposition === "research_lead") ?? [] : [];
  const displayed = leads.slice(0, 3);
  const locked = busy || refreshing;
  const canStart = job.state === "not_started" && !failure && !receipt && !locked && !actionBlockedReason;
  const retryable = (job.state === "failed" || job.state === "interrupted") && job.canRetry;
  const canRetry = retryable && !locked && !actionBlockedReason;
  const message = failure || (missingCompleteResult ? "The completed job has no usable research record. Refresh the saved status; no eligibility is asserted."
    : job.state === "complete" ? "Research recorded; review sources and conditions."
    : job.state === "not_started" ? "Review the saved Mission, then start research explicitly." : job.message);

  return <section aria-label="Research findings" data-discovery-status={status} className="min-w-0 space-y-4 break-words text-sm leading-6" style={{ color: "var(--sh-text-primary)" }}>
    <header className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">Research findings</h2>
        <span className="text-sm font-medium" style={failed || status === "interrupted" ? { color: "var(--sh-red)" } : muted}>{statusLabel}</span>
      </div>
      <p>Paper account: <strong>{snapshot.account.label.trim() || "Name unavailable"}</strong></p>
      {receipt && <p style={muted}>Research as of <Timestamp at={result?.asOf} /></p>}
    </header>

    <div role={failed || status === "interrupted" ? "alert" : "status"} aria-live={failed || status === "interrupted" ? "assertive" : "polite"} className="space-y-1 rounded-lg border px-4 py-3" style={surface}>
      <p>{message}</p>
      {busy && job.state !== "running" && <p>Request in progress; awaiting recorded job status.</p>}
      {usingPreviousResult && <p>Previous result retained · Attempt {receipt?.attempt}. Latest attempt has no usable replacement.</p>}
      {!usingPreviousResult && failed && result && !unavailable && <p>Saved findings are retained; the latest request failed. Current eligibility is not confirmed.</p>}
      {result?.status === "incomplete" && <p>Incomplete research record: evidence or coverage gaps remain.</p>}
      {unavailable && <p>Research evidence is unavailable. This is not a successful empty search.</p>}
    </div>

    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {job.state === "not_started" && !receipt && <button type="button" className={control} style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)", borderColor: "var(--sh-primary)" }} disabled={!canStart} onClick={() => { if (canStart) onStart(); }}>Start research</button>}
      {retryable && <button type="button" className={control} style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)", borderColor: "var(--sh-primary)" }} disabled={!canRetry} onClick={() => { if (canRetry) onRetry(); }}>{job.state === "interrupted" ? "Resume research" : "Retry research"}</button>}
      <button type="button" className={control} style={surface} disabled={locked} onClick={() => { if (!locked) onRefresh(); }}>{refreshing ? "Refreshing status…" : "Refresh status"}</button>
    </div>
    {actionBlockedReason && (retryable || job.state === "not_started") && <p role="status">{actionBlockedReason} Refresh status to check availability; saved findings remain readable.</p>}
    <p style={muted}>Unverified hypotheses, not trade plays. No allocation or order is created. Research validation is not enabled in this release.</p>

    {!!result?.coverageGaps.length && <p><strong>Coverage uncertainty:</strong> {result.coverageGaps.slice(0, 2).map(words).join(" · ")}{result.coverageGaps.length > 2 && ` · ${result.coverageGaps.length - 2} more gaps in the record below.`}</p>}
    {result && !result.context?.sources.length && <p><strong>Source gap:</strong> {result.context ? "No source records supplied; evidence is unverified." : "Source manifest not supplied; provenance cannot be confirmed."}</p>}
    {displayed.length > 0 ? <section aria-label="Research lead summaries" className="space-y-3">
      <p style={muted}>Showing {displayed.length} of {leads.length} research leads in recorded order, not a ranking.</p>
      <div className="grid min-w-0 gap-3 lg:grid-cols-3">{displayed.map(hypothesis => <LeadSummary key={hypothesis.id} hypothesis={hypothesis} />)}</div>
    </section> : <p>{!result ? "No research result is recorded yet." : unavailable ? "No usable research leads can be shown from this attempt." : "No research leads in this bounded record. This is not a portfolio-risk assessment."}</p>}
    {!displayed.length && <p><strong>Reopen when:</strong> {failed || status === "interrupted" || unavailable ? "The saved failure and evidence gaps have been reviewed and a retry is permitted." : status === "running" ? "The job reports a recorded result; refresh status to check." : result ? "New evidence addresses the recorded exclusions or coverage gaps; review the Mission before authorizing further research." : "The saved Mission is reviewed and research is explicitly requested."}</p>}

    <details className="rounded-lg border px-4" style={surface}>
      <summary className={disclosure}>{receipt ? "All hypotheses, rejections & source / calculation record" : "Research job record"}</summary>
      <div className="space-y-4 pb-4">
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt>Account snapshot</dt><dd><Timestamp at={snapshot.account.asOf} /></dd>
          <dt>Job</dt><dd>{job.jobId == null ? "Not started" : `#${job.jobId}`}</dd>
          <dt>Job updated</dt><dd><Timestamp at={job.updatedAt} /></dd>
          <dt>Mission / revision</dt><dd>#{snapshot.decisionRunId} / #{snapshot.decisionRevisionId}</dd>
          <dt>Source draft version</dt><dd>{snapshot.sourceDraftVersion}</dd>
        </dl>
        {receipt && <ReceiptRecord receipt={receipt} />}
      </div>
    </details>
    {usingPreviousResult && latestAttempt && latestAttempt.id !== receipt?.id && <details className="rounded-lg border px-4" style={surface}>
      <summary className={disclosure}>Latest unsuccessful attempt · {latestAttempt.attempt}</summary>
      <div className="pb-4"><ReceiptRecord receipt={latestAttempt} /></div>
    </details>}
  </section>;
}
