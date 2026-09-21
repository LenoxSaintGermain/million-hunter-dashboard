import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
type Selection = { runId: number; candidateId: number; accountId: number; decisionRunId: number; decisionRevisionId: number; budgetCents: number };

export function QuickPlayWorkspace() {
  const [, navigate] = useLocation();
  const [budget, setBudget] = useState(5000);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const ideas = trpc.aperture.quickPlay.list.useQuery({ budgetCents: budget }, { retry: false, refetchOnWindowFocus: false });
  const check = trpc.aperture.quickPlay.preview.useQuery(selection ?? { runId: 0, candidateId: 0, accountId: 0, decisionRunId: 0, decisionRevisionId: 0, budgetCents: budget },
    { enabled: selection != null, retry: false, refetchOnWindowFocus: false, staleTime: 0 });
  const prepare = trpc.aperture.quickPlay.prepare.useMutation({ retry: false, onSuccess: result => navigate(result.url) });
  const current = selection && check.data?.selection.candidateId === selection.candidateId
    && check.data?.selection.budgetCents === budget ? check.data : null;
  const choose = (value: Selection) => { setSelection(value); setAcknowledged(false); prepare.reset(); };
  return <section aria-label="Quick Plays" className="space-y-4">
    <header>
      <h1 className="font-serif text-3xl">Quick Plays</h1>
      <p className="mt-2 text-sm">Short route, same checks. Start with reviewed research, then check current prices and your limits.</p>
      <p className="mt-2 text-sm text-[var(--sh-fg-muted)]">Practice trading · Intraday long shares. Other strategies remain in Research. No automatic orders.</p>
    </header>
    <fieldset disabled={prepare.isPending} className="space-y-2">
      <legend className="text-sm font-semibold">Budget for this trade</legend>
      <div className="flex flex-wrap gap-2">{[2500, 5000, 10000].map(value => <Button key={value} type="button" variant={budget === value ? "default" : "outline"}
        aria-pressed={budget === value} className="min-h-11" onClick={() => { setBudget(value); setSelection(null); setAcknowledged(false); prepare.reset(); }}>{money(value)}</Button>)}</div>
      <p className="text-sm text-[var(--sh-fg-muted)]">This cap can only reduce your saved plan’s allocation. Account risk limits still apply.</p>
    </fieldset>
    {ideas.isLoading && <p role="status">Loading your reviewed ideas…</p>}
    {ideas.isError && <div role="alert"><p>We couldn’t load your research. No order was created.</p><Button className="min-h-11 mt-2" variant="outline" onClick={() => void ideas.refetch()}>Reload ideas</Button></div>}
    {ideas.data && !ideas.isError && <>
      <p className="text-sm text-[var(--sh-fg-muted)]">{ideas.data.disclosure}</p>
      {ideas.data.session !== "regular" && <p role="status" className="rounded-xl border p-4">Regular trading is closed. You can review research; current-price checks resume after the market opens.</p>}
      {!ideas.data.items.length && <div className="rounded-xl border p-4 space-y-2">
        <h2 className="font-semibold">No Quick Play is ready to check.</h2>
        <p className="text-sm">We need a current intraday plan, a matching practice account and completed evidence reviews. Existing orders and positions are unchanged.</p>
        <Button variant="outline" className="min-h-11" onClick={() => navigate(`/aperture/mission?objective=1&capital=${budget / 100}`)}>Research an idea with {money(budget)}</Button>
      </div>}
      <div className="space-y-3">{ideas.data.items.map(item => <article key={`${item.selection.runId}:${item.selection.candidateId}`} className="rounded-xl border p-4 space-y-2">
        <h2 className="font-semibold">{item.symbol} · Long shares</h2>
        <p className="text-sm">Practice account: {item.accountLabel}</p>
        <p className="text-sm text-[var(--sh-fg-muted)]">{item.sourceCount} research sources · Saved {new Date(item.researchAt).toLocaleString()}</p>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" disabled={check.isFetching || prepare.isPending} onClick={() => choose(item.selection)}>Check prices and risk</Button>
          <Button className="min-h-11" variant="outline" onClick={() => navigate(item.reviewUrl)}>Review research</Button>
        </div>
      </article>)}</div>
      {ideas.data.withheld > 0 && <p className="text-sm text-[var(--sh-fg-muted)]">{ideas.data.withheld} research ideas need further review or do not fit this flow. <a className="underline" href="/aperture/runs">Open research</a></p>}
    </>}
    {selection && <section aria-label="Quick Play review" aria-live="polite" className="rounded-xl border p-4 space-y-3">
      <h2 className="font-semibold">Review before preparing an order</h2>
      {check.isFetching && <p role="status">Checking market prices and account limits…</p>}
      {check.isError && <div role="alert"><p>{check.error.message}</p><div className="flex flex-wrap gap-2 mt-2">
        <Button className="min-h-11" variant="outline" onClick={() => { setAcknowledged(false); void check.refetch(); }}>Check again</Button>
        <Button className="min-h-11" variant="outline" onClick={() => navigate(`/aperture/run/${selection.runId}?candidate=${selection.candidateId}&view=evidence`)}>Review this idea</Button>
      </div></div>}
      {current && !check.isError && <>
        <h3 className="font-semibold">Buy {current.qty} {current.symbol} shares · Limit {money(current.entryCents)}</h3>
        <p className="text-sm">{current.accountLabel} · Practice account · {current.brokerId}</p>
        <p>Allocation {money(current.notionalCents)} of {money(budget)} · Planned loss at modeled stop {money(current.plannedLossCents)}</p>
        <p className="text-sm">Modeled stop: {money(current.stopCents)}. Stop execution can differ. This prepares an entry limit order—not a broker stop or take-profit order.</p>
        <p className="text-sm">{current.invalidation}</p>
        <p className="text-sm">Review/exit time: {new Date(current.timeStopAt).toLocaleString()}. No automatic exit is scheduled.</p>
        <p className="text-sm text-[var(--sh-fg-muted)]">Checked {new Date(current.asOf).toLocaleTimeString()} · {current.tapeBasis}</p>
        {!!current.blockers.length && <div role="alert"><p className="font-semibold">Resolve these checks first</p><ul className="list-disc pl-5">{current.blockers.map((block, index) => <li key={index}>{block}</li>)}</ul><a className="underline" href={current.reviewUrl}>Review this idea and its limits</a></div>}
        <details><summary className="min-h-11 cursor-pointer py-3">Why this idea? Sources and modeled targets</summary>
          <p className="text-sm">{current.reason}</p>
          {current.targets.map((target, index) => <p className="text-sm" key={index}>{target.rMultiple}R scenario: {money(target.priceCents)} · {target.basis}</p>)}
          <ul className="list-disc pl-5">{current.sources.map((source, index) => <li key={source}><a href={source} target="_blank" rel="noreferrer" className="underline">Research source {index + 1}</a></li>)}</ul>
        </details>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={acknowledged} disabled={prepare.isPending || check.isFetching} onChange={event => setAcknowledged(event.target.checked)} />I understand this uses simulated money.</label>
        <Button className="min-h-11" disabled={!current.ready || !acknowledged || check.isFetching || prepare.isPending}
          onClick={() => prepare.mutate({ ...current.selection, fingerprint: current.fingerprint, acknowledgement: "PAPER" })}>
          {prepare.isPending ? "Preparing order review…" : "Prepare practice order"}
        </Button>
        {!acknowledged && <p className="text-sm">Confirm practice mode above to prepare the order.</p>}
        <p className="text-sm">Creates an order for review. Approval and sending to the broker are separate actions.</p>
      </>}
      {prepare.isError && <div role="alert"><p>{prepare.error.message}</p><p className="text-sm">If completion is uncertain, inspect the existing order before trying again.</p><Button className="min-h-11 mt-2" variant="outline" onClick={() => navigate(`/aperture/run/${selection.runId}/execute?candidate=${selection.candidateId}`)}>Check this order’s status</Button></div>}
    </section>}
  </section>;
}
