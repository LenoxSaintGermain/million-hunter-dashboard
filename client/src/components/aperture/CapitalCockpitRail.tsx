import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Clock3, Info, Landmark, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatMandatePercentPoints } from "@shared/cockpitPresentation";
import { buildCockpitRailSummary, type CockpitHeadroomLine } from "@shared/cockpitRailSummary";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BasisMark, StateMark } from "./DecisionVisualLanguage";

type HeadroomLine = CockpitHeadroomLine;

function money(cents: number | null | undefined) {
  return cents == null ? null : `$${Math.round(cents / 100).toLocaleString()}`;
}

function duration(ms: number | null | undefined) {
  if (ms == null) return null;
  const absolute = Math.max(0, ms);
  const hours = Math.floor(absolute / 3_600_000);
  const minutes = Math.floor((absolute % 3_600_000) / 60_000);
  return `${hours ? `${hours}h ` : ""}${minutes}m`;
}

function syncedLabel(stalenessMs: number | null) {
  if (stalenessMs == null) return "never synced";
  if (stalenessMs < 60_000) return "synced just now";
  if (stalenessMs < 3_600_000) return `synced ${Math.floor(stalenessMs / 60_000)}m ago`;
  return `synced ${Math.floor(stalenessMs / 3_600_000)}h ago`;
}

function RailHead({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{children}</p>;
}

function RailHelp({ label, children }: { label: string; children: ReactNode }) {
  return <TooltipProvider delayDuration={120}><Tooltip><TooltipTrigger asChild><button type="button" aria-label={label} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-[280px]"><p className="text-xs leading-5">{children}</p></TooltipContent></Tooltip></TooltipProvider>;
}

function MeasureLine({ line }: { line: HeadroomLine }) {
  const perPlay = line.key === "single_order" || line.key === "planned_risk_per_play";
  const measurable = !perPlay && line.usedCents != null && line.ceilingCents != null;
  const usedPct = measurable ? Math.min(100, Math.max(0, line.usedPct ?? 0)) : null;
  return <div className="space-y-1.5">
    <div className="flex gap-3 text-[11px] leading-4"><span className="min-w-0 flex-1" style={{ color: "var(--sh-text-primary)" }}>{line.label}{line.subject ? ` · ${line.subject}` : ""}</span><span className="shrink-0 font-mono tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>{perPlay ? `ceiling ${money(line.ceilingCents) ?? "not measured"}` : measurable ? `${money(line.usedCents)} / ${money(line.ceilingCents)}` : "not measurable"}</span></div>
    {measurable ? <div className="h-1 overflow-hidden rounded-full" style={{ background: "var(--sh-border-1)" }} role="progressbar" aria-label={`${line.label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPct ?? 0} aria-valuetext={`${usedPct?.toFixed(1)}% used`}><div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: usedPct != null && usedPct >= 85 ? "var(--sh-red)" : "var(--sh-signal)" }} /></div> : <p className="text-[10px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{line.reason || (perPlay ? "This is a per-play ceiling, not a running total." : "No measured basis is available.")}</p>}
  </div>;
}

export function CapitalCockpitRail({ runId }: { runId?: number }) {
  const { data: accounts } = trpc.aperture.account.list.useQuery();
  const preferredAccountId = accounts?.find((account) => account.isPaper && account.brokerId === "alpaca_paper")?.id
    ?? accounts?.find((account) => account.isPaper)?.id
    ?? null;
  const cockpitInput = useMemo(() => runId ? { runId } : preferredAccountId ? { accountId: preferredAccountId } : undefined, [runId, preferredAccountId]);
  const { data, isLoading } = trpc.aperture.cockpit.useQuery(cockpitInput, { refetchInterval: 60_000, refetchIntervalInBackground: true });
  const preference = trpc.aperture.cockpitPreference.get.useQuery();
  const setPreference = trpc.aperture.cockpitPreference.set.useMutation();
  const [clockNow, setClockNow] = useState(() => Date.now());
  const responseAt = useRef(Date.now());
  const preferenceApplied = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [sortMode, setSortMode] = useState<"severity" | "impact">("severity");
  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    responseAt.current = Date.now();
    setClockNow(responseAt.current);
  }, [data?.session.msToNextBoundary, data?.run?.msToCatalystDeadline]);
  const summary = useMemo(
    () => data ? buildCockpitRailSummary(data.headroom.lines as HeadroomLine[], data.account.stalenessMs) : null,
    [data],
  );
  useEffect(() => {
    if (preferenceApplied.current || preference.data == null) return;
    preferenceApplied.current = true;
    setExpanded(preference.data.expanded);
  }, [preference.data]);
  if (isLoading || !data || !summary) return <section className="mb-5 animate-pulse motion-reduce:animate-none rounded-xl border px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Loading paper-research context…</span></section>;

  const elapsedMs = Math.max(0, clockNow - responseAt.current);
  const boundaryMs = data.session.msToNextBoundary == null ? null : data.session.msToNextBoundary - elapsedMs;
  const deadlineMs = data.run?.msToCatalystDeadline == null ? null : data.run.msToCatalystDeadline - elapsedMs;
  const changeExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    setPreference.mutate({ expanded: next });
  };
  const sortLines = (lines: HeadroomLine[]) => [...lines].sort((left, right) => {
    if (sortMode === "impact") return (right.usedCents ?? -1) - (left.usedCents ?? -1);
    const leftUtilization = left.usedCents != null && left.ceilingCents ? left.usedCents / left.ceilingCents : -1;
    const rightUtilization = right.usedCents != null && right.ceilingCents ? right.usedCents / right.ceilingCents : -1;
    return rightUtilization - leftUtilization;
  });
  const notionalLines = sortLines(summary.expandedLines.filter((line) => !line.key.includes("planned_risk")));
  const riskLines = sortLines(summary.expandedLines.filter((line) => line.key.includes("planned_risk")));
  const bindingText = summary.binding
    ? `${summary.binding.label}${summary.binding.subject ? ` · ${summary.binding.subject}` : ""} ${(summary.bindingUtilizationPct ?? 0).toFixed(1)}%`
    : "no ceiling is measurable yet";
  const staleText = summary.accountStale
    ? `ceilings are measured against ${syncedLabel(data.account.stalenessMs)} equity`
    : syncedLabel(data.account.stalenessMs);
  const severityColor = summary.severity === "critical" ? "var(--sh-red)" : summary.severity === "warning" || summary.accountStale ? "var(--sh-signal)" : "var(--sh-fg-muted)";
  const bindingUtilization = Math.min(100, Math.max(0, summary.bindingUtilizationPct ?? 0));
  const bindingHeadroom = Math.max(0, 100 - bindingUtilization);

  return <section className="mb-5 overflow-hidden rounded-xl border" style={{ borderColor: summary.severity === "critical" ? severityColor : "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div className="flex min-h-11 items-center gap-2 border-b px-3 text-[11px]" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><StateMark state="rule_qualified" label="Paper-only operator instrument" compact /><RailHelp label="Explain paper-only boundary">This operator surface records research context and human review. It does not submit an order.</RailHelp></div>
    <div className="flex min-h-12 flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-0 sm:py-0" style={{ background: summary.severity === "critical" ? "color-mix(in srgb, var(--sh-red) 5%, var(--sh-surface))" : "var(--sh-surface)" }}>
      <div className="flex min-w-0 items-center gap-2 py-1 sm:flex-1 sm:border-r sm:px-3" style={{ borderColor: "var(--sh-border-1)" }}><StateMark state={data.session.session === "unknown" ? "unknown" : "researchable"} label={data.session.session.replaceAll("_", " ")} compact /><span className="truncate text-xs" style={{ color: "var(--sh-text-primary)" }}>· {data.session.nextBoundary?.label.toLowerCase() ?? "boundary —"}{boundaryMs != null ? ` ${duration(boundaryMs)}` : ""}</span><RailHelp label="Explain market boundary">Market timing context only; it is not a trade signal.</RailHelp></div>
      <div className="flex min-w-0 items-center gap-2 py-1 sm:flex-1 sm:border-r sm:px-3" style={{ borderColor: "var(--sh-border-1)" }}><StateMark state={summary.accountStale ? "stale" : "rule_qualified"} label={data.account.label || "Paper account —"} compact /><span className="truncate text-xs" style={{ color: summary.accountStale ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>· {staleText}</span><RailHelp label="Explain account freshness">Paper-account freshness controls the quality of measured ceilings.</RailHelp></div>
      <div className="flex min-w-0 items-center gap-2 py-1 sm:flex-[1.35] sm:px-3"><StateMark state={summary.severity === "critical" ? "blocked" : summary.severity === "unmeasurable" ? "unknown" : "rule_qualified"} label={summary.binding?.label ?? "Tightest constraint"} compact /><div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full" style={{ background: "var(--sh-border-1)" }} role="progressbar" aria-label="Tightest constraint utilization" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bindingUtilization} aria-valuetext={`${bindingUtilization.toFixed(0)}% used; ${bindingHeadroom.toFixed(0)}% headroom`}><div className="h-full rounded-full" style={{ width: `${bindingUtilization}%`, background: severityColor }} /></div><BasisMark basis="measured" label={`${bindingUtilization.toFixed(0)}% / ${bindingHeadroom.toFixed(0)}%`} /><RailHelp label="Explain tightest constraint">{summary.binding ? `${money(summary.binding.usedCents)} used against ${money(summary.binding.ceilingCents)} from ${summary.binding.basis}.` : "No measurable running ceiling."}</RailHelp><button type="button" aria-expanded={expanded} aria-controls="cockpit-rail-detail" aria-label={expanded ? "Hide instrument detail" : "Show instrument detail"} onClick={changeExpanded} className="rounded px-1.5 py-1 text-[11px] font-semibold" style={{ color: "var(--sh-text-primary)" }}>{expanded ? "Hide" : "Detail"}<ChevronDown className={`ml-1 inline h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} /></button></div>
    </div>
    {summary.severity === "critical" && !expanded && <div className="border-t px-4 py-1.5 text-[11px]" style={{ borderColor: "color-mix(in srgb, var(--sh-red) 35%, var(--sh-border-1))", color: "var(--sh-red)" }}>Constraint blocks new exposure that relies on this headroom. Existing paper positions are unchanged.</div>}
    {expanded && <div id="cockpit-rail-detail">
    <div className="grid gap-px lg:grid-cols-3" style={{ background: "var(--sh-border-1)" }}>
      <div className="space-y-2 p-4" style={{ background: "var(--sh-surface)" }}><RailHead>Market clock</RailHead><div className="flex items-center gap-2"><Clock3 className="h-4 w-4" style={{ color: data.session.session === "unknown" ? "var(--sh-red)" : "var(--sh-signal)" }} /><p className="text-sm font-semibold capitalize" style={{ color: "var(--sh-text-primary)" }}>{data.session.session.replaceAll("_", " ")}</p></div>{data.session.unavailableReason ? <p className="text-xs leading-5" style={{ color: "var(--sh-red)" }}>{data.session.unavailableReason}</p> : <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.session.nextBoundary?.label ?? "No next boundary recorded"}{boundaryMs != null ? ` in ${duration(boundaryMs)}` : ""}{data.session.halfDay ? " · half day" : ""}</p>}</div>
      <div className="space-y-2 p-4" style={{ background: "var(--sh-surface)" }}><RailHead>Paper account</RailHead><div className="flex min-w-0 items-center gap-2"><Landmark className="h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><p className="min-w-0 truncate text-sm font-semibold" title={data.account.label || "No paper account in scope"} style={{ color: "var(--sh-text-primary)" }}>{data.account.label || "No paper account in scope"}</p></div>{data.account.unavailableReason ? <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.account.unavailableReason}</p> : <div className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}><p style={{ color: summary.accountStale ? "var(--sh-signal)" : undefined }}>{data.account.isPaper ? "Paper account" : "Account type not stated"} · {staleText}{summary.accountStale ? " — play ceilings may be stale" : ""}</p><p className="tabular-nums">Equity {money(data.account.equityValueCents) ?? "not measured"} · cash {money(data.account.cashCents) ?? "not measured"}</p>{data.account.syncError && <p style={{ color: "var(--sh-red)" }}>Sync issue: {data.account.syncError}</p>}</div>}</div>
      <div className="space-y-2 p-4" style={{ background: "var(--sh-surface)" }}><RailHead>Mandate · {data.mandate.version}</RailHead><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Paper-only ceilings use the same mandate that evaluates an order.</p><p className="text-xs" style={{ color: "var(--sh-text-primary)" }}>Single order {money(data.mandate.maxOrderNotionalCents) ?? "not measured"} · planned loss / play {formatMandatePercentPoints(data.mandate.maxPlannedRiskPctPerPlay)} · daily {formatMandatePercentPoints(data.mandate.maxDailyPlannedRiskPct)}</p></div>
    </div>
    <div className="flex items-center justify-between gap-3 border-t px-4 py-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><RailHead>Constraint detail</RailHead><div className="flex items-center gap-1 text-[11px]" aria-label="Constraint ordering"><span style={{ color: "var(--sh-fg-muted)" }}>Order</span><button type="button" aria-pressed={sortMode === "severity"} onClick={() => setSortMode("severity")} className="rounded px-1.5 py-1" style={{ background: sortMode === "severity" ? "var(--sh-surface-3)" : undefined, color: "var(--sh-text-primary)" }}>severity</button><button type="button" aria-pressed={sortMode === "impact"} onClick={() => setSortMode("impact")} className="rounded px-1.5 py-1" style={{ background: sortMode === "impact" ? "var(--sh-surface-3)" : undefined, color: "var(--sh-text-primary)" }}>impact</button></div></div>
    <div className="grid gap-px lg:grid-cols-2" style={{ background: "var(--sh-border-1)" }}>
      <div className="space-y-3 p-4" style={{ background: "var(--sh-surface-2)" }}><RailHead>Notional headroom · capital committed</RailHead>{notionalLines.map((line) => <MeasureLine key={line.key} line={line} />)}</div>
      <div className="space-y-3 p-4" style={{ background: "var(--sh-surface-2)" }}><RailHead>Planned-loss headroom · capital at risk</RailHead>{riskLines.map((line) => <MeasureLine key={line.key} line={line} />)}</div>
    </div>
    {summary.duplicatedUnclassifiedCluster && <p className="border-t px-4 py-2 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>The largest correlated cluster equals the largest name because no sector fact is recorded; it is shown once above rather than double-counted.</p>}
    {data.run && <div className="border-t px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><RailHead>Run preset · #{data.run.runId}</RailHead>{data.run.unavailableReason ? <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.run.unavailableReason}</p> : <div className="mt-1 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4" style={{ color: "var(--sh-fg-muted)" }}><p>{data.run.holdingPeriodLabel || "holding period not measured"}</p><p>{deadlineMs == null ? "catalyst deadline not measured" : deadlineMs < 0 ? `catalyst window expired ${duration(-deadlineMs)} ago` : `catalyst deadline in ${duration(deadlineMs)}`}</p><p className="tabular-nums">Liquidity floor {data.run.liquidityFloorAdvUsd == null ? "not measured" : `$${Math.round(data.run.liquidityFloorAdvUsd).toLocaleString()}`}</p><p className="tabular-nums">Single-name cap {data.run.maxSingleNamePct == null ? "not measured" : `${data.run.maxSingleNamePct.toFixed(1)}%`}</p><p className="sm:col-span-2 lg:col-span-4">Invalidation: {data.run.invalidationRule || "not measured"}</p>{data.run.providerGaps === null ? <p className="sm:col-span-2 lg:col-span-4">Provider availability was not recorded for this run.</p> : data.run.providerGaps.length ? <p className="sm:col-span-2 lg:col-span-4">Provider gaps: {data.run.providerGaps.join(", ")}</p> : <p className="sm:col-span-2 lg:col-span-4">Every provider recorded for this run was live.</p>}</div>}</div>}
    </div>}
  </section>;
}
