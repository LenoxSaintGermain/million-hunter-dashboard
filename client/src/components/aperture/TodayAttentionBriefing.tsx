import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { attentionBaselineToken, type ApertureAttentionBriefing, type ApertureAttentionItem, type ApertureMotionItem } from "@shared/apertureAttention";

function localTime(value: number | null) {
  return value == null ? "Not scheduled" : new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function BriefRow({ item, onOpen }: { item: ApertureAttentionItem | ApertureMotionItem; onOpen: (href: string) => void }) {
  const attention = "actionLabel" in item;
  return <article className="flex flex-col gap-3 border-t px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)" }}>
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{item.stateLabel}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{attention ? item.title : `${item.symbol} · ${item.detail}`}</p>
      {attention && <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{item.reason}</p>}
    </div>
    <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={() => onOpen(item.href)}>{attention ? item.actionLabel : "View status"}<ArrowRight className="ml-2 h-3.5 w-3.5" /></Button>
  </article>;
}

export function TodayAttentionBriefing({
  attention,
  accountLabel,
  modeLabel,
  loading,
  failed,
  onOpen,
  onRetry,
  onNewMission,
}: {
  attention: ApertureAttentionBriefing | null;
  accountLabel: string;
  modeLabel: string;
  loading: boolean;
  failed: string | null;
  onOpen: (href: string) => void;
  onRetry: () => void;
  onNewMission: () => void;
}) {
  const markSeen = trpc.aperture.desk.markSeen.useMutation();
  const lastMarked = useRef<string | null>(null);
  const visibleChanged = attention?.changed.slice(0, 3) ?? [];
  const visibleMotion = attention?.inMotion.slice(0, 4) ?? [];
  const displayedBaseline = useMemo(() => {
    if (!attention) return null;
    const changed = attention.changed.slice(0, 3);
    const motion = attention.inMotion.slice(0, 4);
    const visibleKeys = new Set([
      attention.primary?.key,
      ...attention.otherCritical.map((item) => item.key),
      ...changed.map((item) => item.key),
      ...motion.map((item) => item.key),
    ].filter((key): key is string => Boolean(key)));
    const snapshot = { ...attention.baseline, items: attention.baseline.items.filter((item) => visibleKeys.has(item.key)) };
    return { snapshot, token: attentionBaselineToken(snapshot) };
  }, [attention]);

  useEffect(() => {
    if (!displayedBaseline || displayedBaseline.snapshot.items.length === 0 || lastMarked.current === displayedBaseline.token) return;
    lastMarked.current = displayedBaseline.token;
    markSeen.mutate(displayedBaseline);
  }, [displayedBaseline, markSeen]);

  return <section aria-labelledby="today-briefing-title" className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <header className="border-b p-4 sm:p-5" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Today · {modeLabel}</p><h1 id="today-briefing-title" className="mt-1 font-serif text-3xl leading-tight">What needs you now.</h1></div>
        <Button variant="ghost" size="sm" className="min-h-11" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Run updated checks</Button>
      </div>
      <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{accountLabel} · {attention?.scopeNote ?? "Status has not loaded."}</p>
    </header>

    {loading && !attention && <div role="status" aria-live="polite" className="p-5 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading the last recorded briefing…</div>}
    {failed && !attention && <div role="alert" className="p-5"><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-red)" }} /><div><p className="font-semibold">Current status could not be verified.</p><p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{failed} An empty result is not treated as an all-clear.</p><Button className="mt-3 min-h-11" onClick={onRetry}>Retry status checks</Button></div></div></div>}

    {attention && <>
      {attention.primary ? <div className="p-4 sm:p-5" style={{ background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))" }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: attention.primary.critical ? "var(--sh-red)" : "var(--sh-signal)" }}>{attention.primary.stateLabel}</p><h2 className="mt-1 font-serif text-2xl">{attention.primary.title}</h2><p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>Why this matters:</strong> {attention.primary.consequence}</p></div>
          <Button className="min-h-11 shrink-0" onClick={() => onOpen(attention.primary!.href)}>{attention.primary.actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </div> : <div className="p-5"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-emerald)" }} /><div><p className="font-semibold">No action needs you now.</p><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{attention.quietMessage}</p></div></div></div>}

      {attention.otherCritical.length > 0 && <section className="border-t" style={{ borderColor: "var(--sh-border-1)" }}><div className="px-4 pt-4"><h2 className="text-sm font-semibold">Other critical issues</h2><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Visible even when a Play Desk filter is active.</p></div>{attention.otherCritical.map((item) => <BriefRow key={item.key} item={item} onOpen={onOpen} />)}</section>}

      {visibleChanged.length > 0 && <details className="border-t" style={{ borderColor: "var(--sh-border-1)" }} open={attention.changeHeading === "Current status"}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">{attention.changeHeading} · {visibleChanged.length}</summary><div className="border-t" style={{ borderColor: "var(--sh-border-1)" }}>{visibleChanged.map((item) => <BriefRow key={item.key} item={item} onOpen={onOpen} />)}</div></details>}

      {visibleMotion.length > 0 && <section className="border-t" style={{ borderColor: "var(--sh-border-1)" }}><div className="px-4 pt-4"><h2 className="text-sm font-semibold">In motion</h2><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Waiting plays, submitted orders, and open positions remain distinct.</p></div>{visibleMotion.map((item) => <BriefRow key={item.key} item={item} onOpen={onOpen} />)}</section>}

      {attention.nextCheckpoint && <footer className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex gap-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><div><p className="text-xs font-semibold">Next checkpoint · {attention.nextCheckpoint.title}</p><p className="mt-1 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{attention.nextCheckpoint.detail}{attention.nextCheckpoint.at ? ` · ${localTime(attention.nextCheckpoint.at)}` : ""}</p></div></div>{attention.nextCheckpoint.href && <Button variant="outline" size="sm" className="min-h-11" onClick={() => onOpen(attention.nextCheckpoint!.href!)}>Open checkpoint</Button>}</footer>}
      <div className="flex justify-end border-t px-4 py-3" style={{ borderColor: "var(--sh-border-1)" }}><Button variant="ghost" size="sm" className="min-h-11" onClick={onNewMission}>{attention.entryState === "start" ? "Start mission" : "Review / revise mission"}</Button></div>
    </>}
  </section>;
}
