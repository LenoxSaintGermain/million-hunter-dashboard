import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Clock3, Landmark, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatMandatePercentPoints } from "@shared/cockpitPresentation";

type HeadroomLine = {
  key: string;
  label: string;
  subject: string | null;
  usedCents: number | null;
  ceilingCents: number | null;
  remainingCents: number | null;
  usedPct: number | null;
  ceilingPct: number;
  basis: string;
  reason: string | null;
};

function money(cents: number | null | undefined) {
  return cents == null ? null : `$${Math.round(cents / 100).toLocaleString("en-US")}`;
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

function MeasureLine({ line }: { line: HeadroomLine }) {
  const perPlay = line.key === "single_order" || line.key === "planned_risk_per_play";
  const measurable = !perPlay && line.usedCents != null && line.ceilingCents != null;
  const usedPct = measurable ? Math.min(100, Math.max(0, line.usedPct ?? 0)) : null;
  return <div className="space-y-1.5">
    <div className="flex gap-3 text-[11px] leading-4"><span className="min-w-0 flex-1" style={{ color: "var(--sh-text-primary)" }}>{line.label}{line.subject ? ` · ${line.subject}` : ""}</span><span className="shrink-0 font-mono" style={{ color: "var(--sh-fg-muted)" }}>{perPlay ? `ceiling ${money(line.ceilingCents) ?? "not measured"}` : measurable ? `${money(line.usedCents)} / ${money(line.ceilingCents)}` : "not measurable"}</span></div>
    {measurable ? <div className="h-1 overflow-hidden rounded-full" style={{ background: "var(--sh-border-1)" }} aria-label={`${line.label}: ${usedPct?.toFixed(1)}% used`}><div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: usedPct != null && usedPct >= 85 ? "var(--sh-red)" : "var(--sh-signal)" }} /></div> : <p className="text-[10px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{line.reason || (perPlay ? "This is a per-play ceiling, not a running total." : "No measured basis is available.")}</p>}
  </div>;
}

export function CapitalCockpitRail({ runId }: { runId?: number }) {
  const { data, isLoading } = trpc.aperture.cockpit.useQuery(runId ? { runId } : undefined, { refetchInterval: 60_000, refetchIntervalInBackground: true });
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setElapsed((value) => value + 30_000), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  if (isLoading || !data) return <section className="mb-5 animate-pulse rounded-xl border px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Loading paper-research context…</span></section>;

  const boundaryMs = data.session.msToNextBoundary == null ? null : data.session.msToNextBoundary - elapsed;
  const deadlineMs = data.run?.msToCatalystDeadline == null ? null : data.run.msToCatalystDeadline - elapsed;
  const notionalLines = (data.headroom.lines as HeadroomLine[]).filter((line) => !line.key.includes("planned_risk"));
  const riskLines = (data.headroom.lines as HeadroomLine[]).filter((line) => line.key.includes("planned_risk"));

  return <section className="mb-5 overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div className="flex items-center gap-2 border-b px-4 py-2 text-[11px]" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--sh-signal)" }} />Internal research tool — not investment advice. Modeled figures are labeled as such.</div>
    <div className="grid gap-px lg:grid-cols-3" style={{ background: "var(--sh-border-1)" }}>
      <div className="space-y-2 p-4" style={{ background: "var(--sh-surface)" }}><RailHead>Market clock</RailHead><div className="flex items-center gap-2"><Clock3 className="h-4 w-4" style={{ color: data.session.session === "unknown" ? "var(--sh-red)" : "var(--sh-signal)" }} /><p className="text-sm font-semibold capitalize" style={{ color: "var(--sh-text-primary)" }}>{data.session.session.replaceAll("_", " ")}</p></div>{data.session.unavailableReason ? <p className="text-xs leading-5" style={{ color: "var(--sh-red)" }}>{data.session.unavailableReason}</p> : <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.session.nextBoundary?.label ?? "No next boundary recorded"}{boundaryMs != null ? ` in ${duration(boundaryMs)}` : ""}{data.session.halfDay ? " · half day" : ""}</p>}</div>
      <div className="space-y-2 p-4" style={{ background: "var(--sh-surface)" }}><RailHead>Paper account</RailHead><div className="flex items-center gap-2"><Landmark className="h-4 w-4" style={{ color: data.account.isPaper === true ? "oklch(0.55 0.15 145)" : "var(--sh-signal)" }} /><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{data.account.label || "No paper account in scope"}</p></div>{data.account.unavailableReason ? <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.account.unavailableReason}</p> : <div className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}><p>{data.account.isPaper ? "Paper account" : "Account type not stated"} · {syncedLabel(data.account.stalenessMs)}</p><p>Equity {money(data.account.equityValueCents) ?? "not measured"} · cash {money(data.account.cashCents) ?? "not measured"}</p>{data.account.syncError && <p style={{ color: "var(--sh-red)" }}>Sync issue: {data.account.syncError}</p>}</div>}</div>
      <div className="space-y-2 p-4" style={{ background: "var(--sh-surface)" }}><RailHead>Mandate · {data.mandate.version}</RailHead><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Paper-only ceilings use the same mandate that evaluates an order.</p><p className="text-xs" style={{ color: "var(--sh-text-primary)" }}>Single order {money(data.mandate.maxOrderNotionalCents) ?? "not measured"} · planned loss / play {formatMandatePercentPoints(data.mandate.maxPlannedRiskPctPerPlay)} · daily {formatMandatePercentPoints(data.mandate.maxDailyPlannedRiskPct)}</p></div>
    </div>
    <div className="grid gap-px lg:grid-cols-2" style={{ background: "var(--sh-border-1)" }}>
      <div className="space-y-3 p-4" style={{ background: "var(--sh-surface-2)" }}><RailHead>Notional headroom · capital committed</RailHead>{notionalLines.map((line) => <MeasureLine key={line.key} line={line} />)}</div>
      <div className="space-y-3 p-4" style={{ background: "var(--sh-surface-2)" }}><RailHead>Planned-loss headroom · capital at risk</RailHead>{riskLines.map((line) => <MeasureLine key={line.key} line={line} />)}</div>
    </div>
    {data.run && <div className="border-t px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><RailHead>Run preset · #{data.run.runId}</RailHead>{data.run.unavailableReason ? <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.run.unavailableReason}</p> : <div className="mt-1 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4" style={{ color: "var(--sh-fg-muted)" }}><p>{data.run.holdingPeriodLabel || "holding period not measured"}</p><p>{deadlineMs == null ? "catalyst deadline not measured" : deadlineMs < 0 ? `catalyst window expired ${duration(-deadlineMs)} ago` : `catalyst deadline in ${duration(deadlineMs)}`}</p><p>Liquidity floor {data.run.liquidityFloorAdvUsd == null ? "not measured" : `$${Math.round(data.run.liquidityFloorAdvUsd).toLocaleString("en-US")}`}</p><p>Single-name cap {data.run.maxSingleNamePct == null ? "not measured" : `${data.run.maxSingleNamePct.toFixed(1)}%`}</p><p className="sm:col-span-2 lg:col-span-4">Invalidation: {data.run.invalidationRule || "not measured"}</p>{data.run.providerGaps === null ? <p className="sm:col-span-2 lg:col-span-4">Provider availability was not recorded for this run.</p> : data.run.providerGaps.length ? <p className="sm:col-span-2 lg:col-span-4">Provider gaps: {data.run.providerGaps.join(", ")}</p> : <p className="sm:col-span-2 lg:col-span-4">Every provider recorded for this run was live.</p>}</div>}</div>}
  </section>;
}
