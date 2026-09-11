import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AttentionDecisionCard, FindingEvidence } from "./AttentionDecisionCard";
import { MonitoringFindingReview } from "./MonitoringFindingReview";
import { InlineGateReview, inlineGateTarget } from "./InlineGateReview";
import { inlineMonitoringTarget } from "@shared/monitoringFinding";
import { AttentionSourceRecovery } from "./AttentionSourceRecovery";
import { paperInstrumentDisplayLabel, parseOccOptionSymbol } from "@shared/paperInstrument";
import { arbitrateTodayRead, displayedAttentionBaseline, safeStatusError, type AttentionStatusSource, type ApertureAttentionBriefing, type ApertureAttentionItem, type ApertureMotionItem } from "@shared/apertureAttention";

function localTime(value: number | null) {
  return value == null ? "Not scheduled" : new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function BriefRow({ item, fingerprint, changed, onOpen }: { item: ApertureAttentionItem | ApertureMotionItem; fingerprint?: string; changed?: boolean; onOpen: (href: string) => void }) {
  const attention = "actionLabel" in item;
  if (attention) return <AttentionDecisionCard item={item} compact fingerprint={fingerprint} onOpen={onOpen} />;
  const parsed = parseOccOptionSymbol(item.symbol);
  const label = parsed ? paperInstrumentDisplayLabel({ symbol: item.symbol, instrumentType: parsed.instrumentType }) : item.symbol;
  return <article data-attention-key={item.key} data-attention-fingerprint={fingerprint} className="flex flex-col gap-3 border-t px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)" }}>
    <div className="min-w-0">
      <p className="text-xs font-semibold" style={{ color: "var(--sh-signal)" }}>{item.stateLabel}{changed ? " · Changed since your last review" : ""}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{`${label} · ${item.detail}`}</p>
    </div>
    <Button variant="outline" size="sm" className="min-h-11 shrink-0 whitespace-normal" onClick={() => onOpen(item.href)}>View status<ArrowRight className="ml-2 h-3.5 w-3.5 shrink-0" /></Button>
  </article>;
}

export function TodayAttentionBriefing({
  attention,
  accountLabel,
  modeLabel,
  loading,
  failed,
  failedSources,
  onOpen,
  onRetry,
  onNewMission,
}: {
  attention: ApertureAttentionBriefing | null;
  accountLabel: string;
  modeLabel: string;
  loading: boolean;
  failed: string | null;
  failedSources?: AttentionStatusSource[];
  onOpen: (href: string) => void;
  onRetry: () => void;
  onNewMission: () => void;
}) {
  const markSeen = trpc.aperture.desk.markSeen.useMutation();
  const root = useRef<HTMLElement>(null);
  const sent = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  const [seenError, setSeenError] = useState(false);
  const [seenRetry, setSeenRetry] = useState(0);
  const [changesOpen, setChangesOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [allMotion, setAllMotion] = useState(false);
  const [allCritical, setAllCritical] = useState(false);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [inlineTask, setInlineTask] = useState<ApertureAttentionItem | null>(null);
  const [observed, setObserved] = useState<Map<string, string>>(() => new Map());
  const read = useMemo(() => arbitrateTodayRead({ briefing: attention, refreshing: loading, failed: !!failed, failedSources, primaryKey }), [attention, loading, failed, failedSources, primaryKey]);
  const layout = read.layout;
  const primary = layout?.primary ?? null;
  const visibleChanged = layout?.changed ?? [];
  const visibleMotion = allMotion ? layout?.inMotion ?? [] : layout?.inMotion.slice(0, 4) ?? [];
  // §4 Screen A caps the briefing at three ranked alternatives. The remainder
  // is counted and one click away, never dropped.
  const criticalCap = 3;
  const visibleCritical = allCritical ? layout?.otherCritical ?? [] : layout?.otherCritical.slice(0, criticalCap) ?? [];
  const fingerprints = useMemo(() => new Map(attention?.baseline.items.map(item => [item.key, item.fingerprint]) ?? []), [attention]);
  const changedKeys = new Set(attention?.changeHeading === "Changed since your last review" ? attention.changed.map(item => item.key) : []);
  const quiet = read.quiet;
  useEffect(() => { setPrimaryKey(primary?.key ?? null); }, [primary?.key]);

  // Mounted below the fold or inside collapsed details is not Seen. Without
  // viewport observation, navigation works but no automatic Seen write is made.
  useEffect(() => {
    if (!read.canRecordSeen || !attention || !root.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (document.visibilityState !== "visible") return;
      const displayed = entries.filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      if (!displayed.length) return;
      setObserved(previous => {
        const next = new Map(previous);
        for (const entry of displayed) {
          const node = entry.target as HTMLElement;
          const key = node.dataset.attentionKey;
          const fingerprint = node.dataset.attentionFingerprint;
          if (key && fingerprint) next.set(key, fingerprint);
        }
        return next;
      });
    }, { threshold: 0.5 });
    const observe = () => {
      observer.disconnect();
      if (document.visibilityState === "visible") root.current?.querySelectorAll("[data-attention-key]").forEach(node => observer.observe(node));
    };
    observe();
    document.addEventListener("visibilitychange", observe);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", observe); };
  }, [attention, changesOpen, tasksOpen, allMotion, primary?.key, read.canRecordSeen]);

  const displayedBaseline = useMemo(() => attention ? displayedAttentionBaseline(attention, observed) : null, [attention, observed]);
  useEffect(() => {
    if (!read.canRecordSeen || !displayedBaseline?.snapshot.items.length || inFlight.current || seenError) return;
    if (displayedBaseline.snapshot.items.every(item => sent.current.get(item.key) === item.fingerprint)) return;
    inFlight.current = true;
    markSeen.mutate(displayedBaseline, {
      onSuccess: () => { for (const item of displayedBaseline.snapshot.items) sent.current.set(item.key, item.fingerprint); },
      onError: () => setSeenError(true),
      onSettled: () => { inFlight.current = false; setSeenRetry(value => value + 1); },
    });
  }, [displayedBaseline, markSeen, seenError, seenRetry, read.canRecordSeen]);

  const openTask = (item: ApertureAttentionItem) => {
    if (item.kind === "status_unavailable") onRetry();
    else if ((item.evidence && inlineMonitoringTarget(item.href)) || inlineGateTarget(item)) setInlineTask(item);
    else onOpen(item.href);
  };
  const inlineReview = (item: ApertureAttentionItem) => {
    if (!inlineTask || inlineTask.key !== item.key) return null;
    const gateTarget = inlineGateTarget(inlineTask);
    if (gateTarget) return <section aria-label="Review gate here" className="border-t p-4" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold">{inlineTask.title}</h3><Button variant="ghost" className="min-h-11" onClick={() => setInlineTask(null)}>Close review</Button></div>
      <InlineGateReview key={inlineTask.href} target={gateTarget} onRevise={() => onOpen(inlineTask.href)} />
    </section>;
    const target = inlineMonitoringTarget(inlineTask.href);
    if (!target || !inlineTask.evidence) return null;
    return <section aria-label="Review finding here" className="border-t p-4" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold">{inlineTask.title}</h3><Button variant="ghost" className="min-h-11" onClick={() => setInlineTask(null)}>Close review</Button></div>
      <p className="text-sm leading-5">{inlineTask.reason}</p>
      <FindingEvidence evidence={inlineTask.evidence} expanded />
      <MonitoringFindingReview key={inlineTask.href} target={target} />
    </section>;
  };
  const row = (item: ApertureAttentionItem | ApertureMotionItem) => <div key={item.key}><BriefRow item={item} fingerprint={fingerprints.get(item.key)} changed={changedKeys.has(item.key)} onOpen={() => "kind" in item ? openTask(item) : onOpen(item.href)} />{"kind" in item && inlineReview(item)}</div>;
  const notice = read.state === "loading" ? { title: "Loading the last recorded briefing…", detail: "Existing work is unchanged. Wait for saved status before choosing a next step." }
    : read.state === "refreshing" ? { title: "Refreshing recorded status.", detail: "The last successful briefing remains below; it is not a current all-clear. The refresh is already in progress." }
      : read.state === "failed" ? { title: "Current status could not be verified.", detail: `An empty result is not treated as an all-clear.${attention ? " Last successful records remain below." : ""} Retry status refresh to reconcile what is available.` }
        : read.state === "partial" ? { title: "Status is partially available.", detail: attention?.sourceIssues?.length ? `${Array.from(new Set(attention.sourceIssues.map(issue => issue.source === "monitoring" ? "Monitoring" : issue.label))).join(" · ")} needs verification. Recovery below.` : "Missing source not identified in this saved snapshot. Refresh status to identify the gap." }
          : read.state === "stale" ? { title: "Some play evidence is out of date.", detail: "The findings below remain unresolved. Fresh checks are needed before relying on them; refreshing status only reloads saved records." }
            : read.state === "empty" ? { title: "No verified briefing is available.", detail: "Refresh status to retrieve recorded work. This does not mean no work exists." } : null;
  const failedDetail = failed && read.state !== "refreshing" && read.state !== "loading"
    ? (failedSources?.length ? failedSources : ["status" as const]).map(safeStatusError).join(" ") : null;

  return <section ref={root} aria-labelledby="today-briefing-title" aria-busy={read.busy} data-read-state={read.state} className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <header className="border-b p-4" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h1 id="today-briefing-title" className="font-serif text-2xl leading-tight sm:text-3xl">At a glance</h1><p className="mt-1 text-xs leading-5"><span className="font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-signal)" }}>Today · {modeLabel}</span><span style={{ color: "var(--sh-fg-muted)" }}> · {accountLabel}</span></p></div>
        <Button variant="ghost" size="sm" className="min-h-11 min-w-11 shrink-0 aria-disabled:opacity-50" aria-label={read.busy ? "Refreshing status" : read.state === "failed" ? "Retry status refresh" : "Refresh status"} aria-disabled={read.busy} onClick={() => { if (!read.busy) onRetry(); }}><RefreshCw aria-hidden="true" className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{read.busy ? "Refreshing status…" : read.state === "failed" ? "Retry status refresh" : "Refresh status"}</span></Button>
      </div>
    </header>

    {notice && <div data-status-notice role={read.state === "failed" ? "alert" : "status"} className="flex gap-3 p-4">
      {!read.busy && <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-signal)" }} />}
      <div><p className="font-semibold">{notice.title}</p><p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{notice.detail}</p>{failedDetail && <p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{failedDetail}</p>}</div>
    </div>}

    {attention && <>
      {primary ? <AttentionDecisionCard item={primary} prominent fingerprint={fingerprints.get(primary.key)} busy={primary.kind === "status_unavailable" && loading} onOpen={() => openTask(primary)} /> : quiet ? <div data-quiet-status className="flex gap-3 p-4"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-emerald)" }} /><div><p className="font-semibold">No new action identified.</p><p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>{attention.quietMessage}</p></div></div> : null}
      {primary && inlineReview(primary)}

      {visibleMotion.length > 0 && <section className="border-t" style={{ borderColor: "var(--sh-border-1)" }}><div className="px-4 pt-4"><h2 className="text-sm font-semibold">In motion · {layout!.inMotion.length}</h2></div>{visibleMotion.map(row)}{layout!.inMotion.length > 4 && <Button variant="ghost" className="m-2 min-h-11" onClick={() => setAllMotion(value => !value)}>{allMotion ? "Show fewer statuses" : `Show ${layout!.inMotion.length - 4} more statuses`}</Button>}</section>}
      {(layout?.otherCritical.length ?? 0) > 0 && <section aria-label="Other critical issues" className="border-t" style={{ borderColor: "var(--sh-border-1)" }}><div className="px-4 pt-4"><h2 className="text-sm font-semibold">Other critical issues · {layout!.otherCritical.length}</h2><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>All authorized plays, regardless of thesis or instrument filters.</p></div>{visibleCritical.map(row)}{layout!.otherCritical.length > criticalCap && <Button variant="ghost" className="m-2 min-h-11" onClick={() => setAllCritical(value => !value)}>{allCritical ? "Show fewer critical issues" : `Show ${layout!.otherCritical.length - criticalCap} more critical issues`}</Button>}</section>}

      <AttentionSourceRecovery issues={attention.sourceIssues ?? []} onOpen={onOpen} onRetry={onRetry} busy={read.busy} />

      {(layout?.otherAttention.length ?? 0) > 0 && <details open={tasksOpen} onToggle={event => setTasksOpen(event.currentTarget.open)} className="border-t" style={{ borderColor: "var(--sh-border-1)" }}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Other pending decisions · {layout!.otherAttention.length}</summary>{tasksOpen && layout!.otherAttention.map(row)}</details>}

      {visibleChanged.length > 0
        ? <details className="border-t" style={{ borderColor: "var(--sh-border-1)" }} open={changesOpen} onToggle={event => setChangesOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">{attention.changeHeading} · {visibleChanged.length}</summary>{changesOpen && <div className="border-t" style={{ borderColor: "var(--sh-border-1)" }}>{visibleChanged.map(row)}</div>}</details>
        : <div data-change-baseline className="border-t px-4 py-3 text-sm leading-5" style={{ borderColor: "var(--sh-border-1)" }}><span className="font-semibold">{attention.changeHeading} · 0</span><span style={{ color: "var(--sh-fg-muted)" }}>{attention.changeHeading === "Current status"
          ? " — this is the first recorded baseline, so there is no earlier review to compare against."
          : ` — nothing changed since your last review${attention.baseline?.capturedAt ? ` on ${localTime(attention.baseline.capturedAt)}` : ""}. Timestamp-only churn is ignored.`}</span></div>}


      {attention.nextCheckpoint && <footer aria-label="Next checkpoint" className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex gap-3"><Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><div><p className="text-sm font-semibold">{attention.nextCheckpoint.title}</p><p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>{attention.nextCheckpoint.detail}{attention.nextCheckpoint.at ? ` · ${localTime(attention.nextCheckpoint.at)}` : ""}</p></div></div>{attention.nextCheckpoint.href && <Button variant="outline" size="sm" className="min-h-11" onClick={() => onOpen(attention.nextCheckpoint!.href!)}>Open checkpoint</Button>}</footer>}
      <div className="space-y-3 border-t px-4 py-3" style={{ borderColor: "var(--sh-border-1)" }}>
        <p className="text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>{attention.monitoringNote}</p>
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm">Status details</summary><p className="pb-2 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>{attention.scopeNote}</p></details>
        {seenError && <div role="status" className="text-sm">Your displayed-status baseline was not saved. This does not acknowledge or resolve any finding.<Button variant="outline" className="mt-2 min-h-11 sm:ml-2" onClick={() => { setSeenError(false); setSeenRetry(value => value + 1); }}>Retry saving viewed status</Button></div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button data-put-capital-to-work className="min-h-11" onClick={() => onOpen("/aperture/deploy")}>Put capital to work<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Button>
          {attention.entryState !== "start" && <Button variant="ghost" size="sm" className="min-h-11" onClick={onNewMission}>Review / revise mission</Button>}
        </div>
      </div>
    </>}
  </section>;
}
