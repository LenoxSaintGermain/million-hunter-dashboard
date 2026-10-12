import React, { useCallback, useId, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { capitalEvidenceScopeSchema, type CapitalEvidenceScope, type CapitalEvidenceView } from "@shared/capitalEvidenceContext";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

const muted = "text-xs text-[var(--sh-text-secondary)]";
const excerpt = (text: string, limit: number) => text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
export function matchesCapitalEvidenceScope(a: CapitalEvidenceScope, b: CapitalEvidenceScope) {
  return a.decisionRunId === b.decisionRunId && a.revisionId === b.revisionId && a.candidateId === b.candidateId;
}

/** Reads only an explicit revision/candidate binding; never infers from acquisition scores. */
export function CapitalEvidenceInsight({ scope }: { scope: CapitalEvidenceScope | null }) {
  if (!scope || !capitalEvidenceScopeSchema.safeParse(scope).success) return <p className={muted}>No bound public evidence.</p>;
  return <CapitalEvidenceConsumer key={`${scope.decisionRunId}:${scope.revisionId}:${scope.candidateId}`} scope={scope} />;
}
function CapitalEvidenceConsumer({ scope }: { scope: CapitalEvidenceScope }) {
  const [manage, setManage] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <div className="min-w-0 [overflow-wrap:anywhere]"><ConnectedInsight scope={scope} />
    <Button ref={trigger} variant="ghost" className="h-auto min-h-11 max-w-full whitespace-normal rounded-none" aria-expanded={manage} onClick={() => setManage(!manage)}>{manage ? "Close evidence attachment" : "Attach research evidence"}</Button>
    {manage && <div onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setManage(false); trigger.current?.focus(); } }}><CapitalEvidenceBindingManager scope={scope} /></div>}
  </div>;
}

type EvidenceAPI = inferRouterOutputs<AppRouter>["aperture"]["capitalEvidence"];
type ConfirmInput = inferRouterInputs<AppRouter>["aperture"]["capitalEvidence"]["confirmBinding"];
const selectStyle = "block mt-1 min-h-11 w-full min-w-0 max-w-full border border-[var(--sh-border-1)] bg-[var(--sh-surface)] p-2 text-sm text-[var(--sh-text-primary)]";

/** Mounted only by deliberate request; never auto-selects a deal, run or criterion. */
export function CapitalEvidenceBindingManager({ scope }: { scope: CapitalEvidenceScope }) {
  const options = trpc.aperture.capitalEvidence.options.useQuery(scope, { retry: false, refetchOnWindowFocus: false });
  const securities = trpc.aperture.capitalEvidence.securityChoices.useQuery(scope, { retry: false, refetchOnWindowFocus: false });
  const [dealId, setDealId] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [securityId, setSecurityId] = useState("");
  const rows = options.data?.runs ?? [];
  const deals = Array.from(new Map(rows.map(row => [row.dealId, row.dealName])).entries());
  const selected = rows.find(row => row.dealId === Number(dealId) && row.analysisRunId === analysisId);
  const security = !securities.error && !securities.isFetching ? securities.data?.choices.find(item => String(item.id) === securityId) : undefined;
  if (options.error) return <div role="alert"><p>Saved attachment choices could not be loaded.</p><Button variant="outline" onClick={() => void options.refetch()}>Reload choices</Button></div>;
  if (!options.data || options.isFetching) return <p role="status" className={muted}>Loading owned evidence choices…</p>;
  return <section aria-label="Attach research evidence" className="min-w-0 space-y-3 border-y border-[var(--sh-border-1)] py-3">
    <p className={muted}>Create a new decision revision. Existing approvals do not transfer; no order is created.</p>
    <label className="block text-sm">Owned deal<select className={selectStyle} value={dealId} onChange={event => { setDealId(event.target.value); setAnalysisId(""); }}><option value="">Choose a saved deal</option>{deals.map(([id, name]) => <option key={id} value={id}>{excerpt(name, 90)}</option>)}</select></label>
    <label className="block text-sm">Exact saved analysis<select className={selectStyle} value={analysisId} disabled={!dealId} onChange={event => setAnalysisId(event.target.value)}><option value="">Choose a saved run</option>{rows.filter(row => row.dealId === Number(dealId)).map(row => <option key={row.analysisRunId} value={row.analysisRunId}>{row.mode} · {new Date(row.startedAt).toLocaleString()} · {row.analysisRunId.slice(0, 8)}</option>)}</select></label>
    {!rows.length && <p className={muted}>No saved evidence analyses returned for your deals.</p>}
    {options.data.hasMore && <p className={muted}>Showing 20 recent attempts, not all analysis history.</p>}
    <p className={muted}>{options.data.limitation}</p>
    {securities.error ? <div role="alert"><p>Security choices unavailable. No identity has been substituted.</p><Button variant="outline" className="min-h-11" onClick={() => void securities.refetch()}>Reload security choices</Button></div> : securities.isFetching ? <p role="status" className={muted}>Loading security choices…</p> : <>
      <label className="block text-sm">Exact security<select className={selectStyle} value={securityId} onChange={event => setSecurityId(event.target.value)}><option value="">Select issuer explicitly</option>{securities.data?.choices.map(item => <option key={item.id} value={item.id}>{excerpt(item.symbol, 24)} · {item.assetType} · CIK {item.cik || "not recorded"} · security {item.id}</option>)}</select></label>
      <p className={muted}>{securities.data?.limitation}</p>
      {!securities.data?.choices.length && <p className={muted}>No saved security choices returned. No binding can be confirmed.</p>}
    </>}
    {selected && <p className="text-sm">Selected deal: {selected.dealName}</p>}
    {selected && security && <CapitalEvidenceBindingConfirmation key={`${selected.analysisRunId}:${security.id}`} scope={scope} dealId={selected.dealId} analysisRunId={selected.analysisRunId} securityId={security.id} />}
  </section>;
}

function CapitalEvidenceBindingConfirmation(props: { scope: CapitalEvidenceScope; dealId: number; analysisRunId: string; securityId: number }) {
  const choices = trpc.aperture.capitalEvidence.choices.useQuery({ ...props.scope, dealId: props.dealId, analysisRunId: props.analysisRunId, securityId: props.securityId }, { retry: false, refetchOnWindowFocus: false });
  if (choices.error) return <div role="alert"><p>That exact basis is unavailable or changed. No binding was made.</p><Button variant="outline" className="min-h-11" onClick={() => void choices.refetch()}>Reload exact choices</Button></div>;
  if (!choices.data || choices.isFetching) return <p role="status" className={muted}>Validating exact basis…</p>;
  return <CapitalEvidenceConfirmForm key={choices.dataUpdatedAt} scope={props.scope} choices={choices.data} reload={() => void choices.refetch()} />;
}

export function CapitalEvidenceConfirmForm({ scope, choices, reload }: { scope: CapitalEvidenceScope; choices: EvidenceAPI["choices"]; reload: () => void }) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef<{ key: string; value: ConfirmInput } | null>(null);
  const lock = useRef(false);
  const mutation = trpc.aperture.capitalEvidence.confirmBinding.useMutation({ retry: false });
  const utils = trpc.useUtils();
  const pairs = choices.findings.flatMap(finding => {
    const criterion = choices.criteria.find(item => `${item.field}:${item.index}` === mapping[finding.id]);
    return criterion ? [{ findingId: finding.id, field: criterion.field, index: criterion.index }] : [];
  });
  const submit = async () => {
    if (!confirmed || !pairs.length || saved || lock.current) return;
    lock.current = true; setPending(true); setNotice(""); setFailed(false);
    try {
      const payload = { ...scope, expectedLockVersion: choices.expectedLockVersion, binding: { ...choices.binding, criterionBindings: pairs }, confirmed: true as const };
      const key = JSON.stringify(payload);
      if (request.current?.key !== key) request.current = { key, value: { ...payload, requestId: crypto.randomUUID() } };
      const savedRevision = await mutation.mutateAsync(request.current.value);
      setSaved(true); setNotice("New revision saved. Reloading authoritative research state…");
      try {
        await utils.aperture.run.get.invalidate({ id: choices.binding.researchRunId });
        const latest = await utils.aperture.run.get.fetch({ id: choices.binding.researchRunId });
        if (latest.decisionAuthority?.decisionRunId !== savedRevision.decisionRunId || latest.decisionAuthority?.revisionId !== savedRevision.revisionId) setNotice("Binding saved, but the current server revision differs. Reload this page before continuing.");
        else setNotice("New revision confirmed by the server. Fresh review is required; no order was created.");
      }
      catch { setNotice("Revision saved, but the research view could not refresh. Reload this page before continuing."); }
    } catch { setFailed(true); setNotice("Binding was not confirmed. Reload choices if the revision changed; an unchanged retry reuses the same request."); }
    finally { lock.current = false; setPending(false); }
  };
  return <div className="min-w-0 space-y-3">
    <p className="text-sm">Confirm {choices.issuer.symbol} · CIK {choices.issuer.cik} is the same legal entity as the selected deal—not a parent or competitor.</p>
    <details><summary className="min-h-11 cursor-pointer py-3 text-xs">Exact selected basis</summary><dl className="space-y-2 text-xs [overflow-wrap:anywhere]"><div><dt>Deal</dt><dd>{choices.binding.dealId}</dd></div><div><dt>Analysis version</dt><dd>{choices.binding.analysisRunId}</dd></div><div><dt>Security</dt><dd>{choices.issuer.securityId} · {choices.issuer.symbol} · CIK {choices.issuer.cik}</dd></div><div><dt>Current revision</dt><dd>{scope.revisionId}</dd></div></dl></details>
    {choices.findings.map(finding => <label key={finding.id} className="block min-w-0 text-sm"><span>{finding.statement}</span><select aria-label={`Criterion for ${finding.id}`} className={selectStyle} value={mapping[finding.id] ?? ""} disabled={pending || saved} onChange={event => { setMapping(current => ({ ...current, [finding.id]: event.target.value })); setConfirmed(false); }}><option value="">Do not attach this finding</option>{choices.criteria.map(item => <option key={`${item.field}:${item.index}`} value={`${item.field}:${item.index}`}>{item.field} · {excerpt(item.text, 120)}</option>)}</select></label>)}
    {pairs.length > 0 && <div className="space-y-2 text-sm"><p className="font-medium">Selected thesis criteria · full text</p>{pairs.map(pair => <p key={pair.findingId}><span className="font-mono text-xs">{pair.findingId} → </span>{choices.criteria.find(item => item.field === pair.field && item.index === pair.index)?.text}</p>)}</div>}
    <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={pending || saved} onChange={event => setConfirmed(event.target.checked)} /><span>I confirm the same-entity identity and my selected finding-to-thesis mappings. This creates a new revision requiring fresh review, not trade approval.</span></label>
    <Button className="h-auto min-h-11 max-w-full whitespace-normal rounded-none" disabled={!confirmed || !pairs.length || pending || saved} onClick={() => void submit()}>{pending ? "Confirming revision…" : saved ? "Revision saved" : "Confirm and create new revision"}</Button>
    {notice && <p role={failed ? "alert" : "status"} className="text-sm">{notice}</p>}
    {failed && <Button variant="outline" className="min-h-11 rounded-none" onClick={reload}>Reload binding choices</Button>}
  </div>;
}
function ConnectedInsight({ scope }: { scope: CapitalEvidenceScope }) {
  // This read-only consumer is mounted only in CandidateBoard's evidence view.
  // Check expiry/revision changes without polling hidden tabs or invoking providers.
  const query = trpc.aperture.capitalEvidence.context.useQuery(scope, {
    retry: false, refetchOnWindowFocus: false,
    refetchInterval: 60_000, refetchIntervalInBackground: false,
  });
  if (query.error) return <div role="alert" className="text-sm"><p>Bound research could not be read. No result substituted.</p><Button variant="outline" className="min-h-11 rounded-none" onClick={() => void query.refetch()}>Retry evidence read</Button></div>;
  if (query.isFetching) return <p role="status" className={muted}>Reading bound research…</p>;
  if (!query.data) return <p role="status" className={muted}>Bound research unavailable.</p>;
  return <CapitalEvidenceInsightView key={`${scope.revisionId}:${query.data.source?.analysisRunId ?? "none"}`} scope={scope} result={query.data} />;
}

/** Inspection is not a recorded review or gate clearance. */
export function CapitalEvidenceInsightView({ scope, result }: { scope: CapitalEvidenceScope; result: CapitalEvidenceView }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const regionId = useId();
  const closeInspector = () => { setOpen(false); trigger.current?.focus(); };
  const focusInspector = useCallback((node: HTMLDivElement | null) => { node?.focus({ preventScroll: true }); }, []);
  if (!matchesCapitalEvidenceScope(scope, result.scope) || result.authority !== "research_only") return <p role="alert" className={muted}>Evidence context changed. Reopen the current research revision.</p>;
  if (result.status === "unavailable") return <p role={result.reason === "evidence_context_not_bound" ? undefined : "status"} className={muted}>{result.reason === "evidence_context_not_bound" ? "No bound public evidence." : "Bound evidence unavailable; no implication inferred."}</p>;
  const finding = result.findings[0];
  if (!finding || !result.source) return <p role="status" className={muted}>No supported research implication returned.</p>;
  return <section aria-label="Bound research insight" className="min-w-0 border-y border-[var(--sh-border-1)] py-3 text-[var(--sh-text-primary)] [overflow-wrap:anywhere]">
    <p className="font-mono text-xs text-[var(--sh-text-secondary)]">{result.status === "needs_reassessment" ? "Reassessment needed" : "Research context"} · {finding.classification}</p>
    <h3 className="mt-1 font-serif text-lg leading-snug">{excerpt(finding.criterion, 100)}</h3>
    <p className="mt-1 text-sm">{excerpt(finding.statement, 180)}</p>
    <p className={`mt-1 ${muted}`}>SEC metadata only · not trade clearance.{result.findings.length > 1 ? ` ${result.findings.length} bound findings in the basis.` : ""}</p>
    <Button ref={trigger} variant="outline" className="mt-2 h-auto min-h-11 max-w-full whitespace-normal rounded-none border-[var(--sh-border-1)] shadow-none" aria-expanded={open} aria-controls={open ? regionId : undefined} onClick={() => setOpen(!open)}>{open ? "Hide research basis" : "Review research basis"}</Button>
    {open && <div id={regionId} ref={focusInspector} tabIndex={-1} role="region" aria-label="Research basis and receipts" className="mt-3 min-w-0 space-y-3 border-t border-[var(--sh-border-1)] pt-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sh-text-primary)]" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeInspector(); } }}>
      <p className={muted}>Inspection only. No evidence answer, thesis revision or approval is recorded.</p>
      {result.findings.map(item => <details key={item.id} open={item.id === finding.id} className="border-b border-[var(--sh-border-1)]">
        <summary className="min-h-11 cursor-pointer py-3 text-sm">{item.criterion} · {item.classification}</summary>
        <p className="text-sm">{item.statement}</p>
        {item.rationale && <p className="mt-2 text-sm">Basis: {item.rationale}</p>}
        <p className={`mt-2 ${muted}`}>Uncertainty: {item.uncertainty || "Not specified in this saved finding."}</p>
        <p className={`mt-2 ${muted}`}>{item.expiredNow ? "Receipt expired now." : "Receipt not expired at read time."} {item.staleAtRun ? "Already stale when analyzed." : "Not stale when analyzed."}</p>
        <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-xs">Inspect exact receipts · {item.receiptIds.length}</summary>
          {item.citations.map(citation => <blockquote key={citation.id} className="mb-3 border-l border-[var(--sh-border-1)] pl-3 text-sm"><p>{citation.fact}</p>{/^https:\/\/(?:www\.|data\.)?sec\.gov\//i.test(citation.sourceUrl) && <a className="inline-flex min-h-11 items-center underline" href={citation.sourceUrl} target="_blank" rel="noopener noreferrer">SEC source ↗</a>}<p className={muted}>Receipt {citation.receiptId}</p></blockquote>)}
          <p className={muted}>Analysis {item.analysisRunId}</p>
        </details>
      </details>)}
      <p className={muted}>{result.source.limitation}</p>
      <Button variant="ghost" className="h-auto min-h-11 max-w-full whitespace-normal rounded-none" onClick={closeInspector}>Close research basis</Button>
    </div>}
  </section>;
}
