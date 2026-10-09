import { singleOrderLimit } from "@shared/singleOrderLimit";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActiveThesisSelect } from "./ActiveThesisSelect";
import { ChevronDown, Clock3, Info, Landmark, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { snapshotSyncAvailability, snapshotAgeLabel } from "@shared/snapshotAge";
import { SYNC_NOW_TITLE, SyncNowButton } from "./SnapshotSyncNow";
import { invalidateAccountRefreshReads } from "@/lib/accountRefreshInvalidation";
import { formatMandatePercentPoints } from "@shared/cockpitPresentation";
import { apertureLanguage, practiceAccountLabel, accountFundsLabel } from "@shared/apertureLanguage";
import { buildCockpitRailSummary, type CockpitHeadroomLine } from "@shared/cockpitRailSummary";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BasisMark, StateMark } from "./DecisionVisualLanguage";
import { PortfolioPortrait } from "./PortfolioPortrait";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";
import { MicroTooltip } from "./MicroTooltip";
import { ConstraintResolverCard } from "./ConstraintResolverCard";
import { LimitBars } from "./LimitBars";

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
  return snapshotAgeLabel(stalenessMs);
}

function RailHead({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>{children}</p>;
}

function RailHelp({ label, children }: { label: string; children: ReactNode }) {
  return <TooltipProvider delayDuration={120}><Tooltip><TooltipTrigger asChild><button type="button" aria-label={label} className="flex shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ minHeight: 44, minWidth: 44 }}><Info className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-[280px]"><p className="text-xs leading-5">{children}</p></TooltipContent></Tooltip></TooltipProvider>;
}

function MeasureLine({ line }: { line: HeadroomLine }) {
  const perPlay = line.key === "single_order" || line.key === "planned_risk_per_play";
  const measurable = !perPlay && line.usedCents != null && line.ceilingCents != null;
  const usedPct = measurable ? Math.min(100, Math.max(0, line.usedPct ?? 0)) : null;
  return <div className="space-y-1.5">
    <div className="flex gap-3 text-[11px] leading-4"><span className="min-w-0 flex-1" style={{ color: "var(--sh-text-primary)" }}>{line.label}{line.subject ? ` · ${line.subject}` : ""}</span><span className="shrink-0 font-mono tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>{line.key === "single_order" ? `ceiling ${singleOrderLimit([line], null, null).ceilingCents == null ? "not measured" : singleOrderLimit([line], null, null).value}` : perPlay ? `ceiling ${money(line.ceilingCents) ?? "not measured"}` : measurable ? `${money(line.usedCents)} / ${money(line.ceilingCents)}` : "not measurable"}</span></div>
    {measurable ? <div className="relative h-6 border-b" style={{ borderColor: "var(--sh-border-1)" }} role="meter" aria-label={`${line.label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPct ?? 0} aria-valuetext={`${line.usedPct?.toFixed(1) ?? usedPct}% used; ceiling ${money(line.ceilingCents)}`}><div className="absolute bottom-0 h-3 border" style={{ width: `${usedPct}%`, background: "var(--sh-surface-2)", borderColor: usedPct != null && usedPct >= 85 ? "var(--sh-red)" : "var(--sh-fg-muted)" }} /><span className="absolute right-0 top-0 h-6 border-r-2 border-dashed" style={{ borderColor: "var(--sh-fg-muted)" }} /></div> : <p className="text-[11px] italic leading-4 border-b border-dashed pb-2" style={{ color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}>{line.reason || (perPlay ? "This is a per-play ceiling, not a running total." : "Wanted: measured exposure against an approved ceiling.")}</p>}
  </div>;
}

function ConnectedPortfolioPortrait({ accountId, ...props }: Omit<React.ComponentProps<typeof PortfolioPortrait>, "holdings" | "loading" | "failed"> & { accountId: number | null }) {
  const positions = trpc.aperture.account.getPositions.useQuery({ accountId: accountId ?? 0 }, { enabled: accountId != null, retry: false, refetchInterval: 60_000, refetchIntervalInBackground: false });
  return <PortfolioPortrait {...props} holdings={positions.data} loading={positions.isFetching} failed={positions.isError} />;
}

export function CapitalCockpitRail({ runId, compactOnly = false, visualHero = false, editorialContext = false }: { runId?: number; compactOnly?: boolean; visualHero?: boolean; editorialContext?: boolean }) {
  const { isGuided } = useExperienceMode();
  const accountQuery = trpc.aperture.account.list.useQuery(undefined, { retry: false });
  const accounts = accountQuery.data;
  const preferredAccountId = accounts?.find((account) => account.isPaper && account.brokerId === "alpaca_paper")?.id
    ?? accounts?.find((account) => account.isPaper)?.id
    ?? accounts?.[0]?.id
    ?? 1;
  const cockpitInput = useMemo(() => runId ? { runId } : preferredAccountId ? { accountId: preferredAccountId } : undefined, [runId, preferredAccountId]);
  // Do not ask for an unscoped cockpit while the operator's account is still
  // loading. That response can falsely claim no account on a cold device.
  const cockpitQuery = trpc.aperture.cockpit.useQuery(cockpitInput, { enabled: !!runId || (!accountQuery.isLoading && !accountQuery.error), retry: false, refetchInterval: 60_000, refetchIntervalInBackground: false });
  const { data, isLoading } = cockpitQuery;
  const syncTarget = snapshotSyncAvailability({ accountId: data?.account.accountId, brokerId: data?.account.brokerId });
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
    if (compactOnly || preferenceApplied.current || preference.data == null) return;
    preferenceApplied.current = true;
    setExpanded(preference.data.expanded);
  }, [compactOnly, preference.data]);
  const deskQuery = (trpc.aperture as any)?.desk?.summary?.useQuery ? (trpc.aperture as any).desk.summary.useQuery(undefined, { retry: false, refetchOnWindowFocus: false }) : { data: null };
  const utils = typeof (trpc as any).useUtils === "function" ? (trpc as any).useUtils() : null;
  const syncMutation = (trpc.aperture as any)?.account?.sync?.useMutation ? (trpc.aperture as any).account.sync.useMutation({
    onSuccess: async (_data: any, variables: any) => {
      const targetId = variables?.id ?? preferredAccountId ?? 1;
      if (utils?.aperture) {
        await invalidateAccountRefreshReads(utils.aperture, targetId);
      }
      cockpitQuery.refetch();
      accountQuery.refetch();
    },
  }) : null;

  const [syncing, setSyncing] = useState(false);
  const handleRapidSync = async () => {
    // Sync the account whose age is shown; never fall back to a guessed id.
    const targetId = syncTarget.accountId;
    if (syncing || targetId == null) return;
    setSyncing(true);
    const toastId = "rapid-broker-sync";
    try {
      toast.loading("Synchronizing broker balances & marks...", { id: toastId });
      if (syncMutation?.mutateAsync) {
        await syncMutation.mutateAsync({ id: targetId });
      }
      if (utils?.aperture) {
        await invalidateAccountRefreshReads(utils.aperture, targetId);
      }
      await Promise.allSettled([cockpitQuery.refetch(), accountQuery.refetch()]);
      toast.success("Broker snapshot synced. No order was created or changed.", { id: toastId });
    } catch (err: any) {
      toast.error(`Broker sync failed: ${err?.message ?? "Network error"}`, { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  if ((!runId && accountQuery.error) || cockpitQuery.error) return <section role="alert" className="mb-5 rounded-xl border px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><p className="text-sm">Account limits could not be verified. We can’t confirm how much risk is available.</p><button type="button" className="mt-2 min-h-11 rounded border px-3 text-sm" onClick={() => { void accountQuery.refetch(); void cockpitQuery.refetch(); }}>Retry account details</button></section>;
  if ((!runId && accountQuery.isLoading) || isLoading || !data || !summary) return <section role="status" className="mb-5 animate-pulse motion-reduce:animate-none rounded-xl border px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Loading account details…</span></section>;

  const elapsedMs = Math.max(0, clockNow - responseAt.current);
  const boundaryMs = data.session.msToNextBoundary == null ? null : data.session.msToNextBoundary - elapsedMs;
  const deadlineMs = data.run?.msToCatalystDeadline == null ? null : data.run.msToCatalystDeadline - elapsedMs;
  const changeExpanded = () => {
    if (compactOnly) return;
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
  const singleOrderLimitView = singleOrderLimit(data.headroom.lines as HeadroomLine[], data.mandate.maxOrderNotionalCents, (data.headroom as { equityCents?: number | null }).equityCents ?? null);
  const notionalLines = sortLines(summary.expandedLines.filter((line) => !line.key.includes("planned_risk")));
  const riskLines = sortLines(summary.expandedLines.filter((line) => line.key.includes("planned_risk")));
  // Measured 2026-09-12: the long form needed ~490px in a 299px cell and was
  // clipped by 168px on every route. The fact is the sync age; that ceilings are
  // measured against it is what the adjacent RailHelp is for.
  const staleText = syncedLabel(data.account.stalenessMs);
  const severityColor = summary.severity === "critical" ? "var(--sh-red)" : summary.severity === "warning" || summary.accountStale ? "var(--sh-signal)" : "var(--sh-fg-muted)";
  const bindingUtilization = Math.min(100, Math.max(0, summary.bindingUtilizationPct ?? 0));
  const bindingHeadroom = Math.max(0, 100 - bindingUtilization);
  const bindingSubject = summary.binding?.subject ?? "No dominant holding identified";
  const bindingRemainingCents = summary.binding?.remainingCents
    ?? (summary.binding?.usedCents != null && summary.binding.ceilingCents != null
      ? summary.binding.ceilingCents - summary.binding.usedCents
      : null);
  const bindingThresholdText = summary.binding?.usedCents != null && summary.binding.ceilingCents != null
    ? `${bindingSubject} uses ${money(summary.binding.usedCents)} of ${money(summary.binding.ceilingCents)}. Remaining allowance: ${money(Math.max(0, bindingRemainingCents ?? 0))}. Once exhausted, ${bindingSubject} must fall below ${money(summary.binding.ceilingCents)} to unlock more. Any higher ceiling must be changed in account risk settings.`
    : "The current account limit is unavailable.";

  const equityCents = data.account.equityValueCents;
  const cashCents = data.account.cashCents;
  const buyingPowerCents = data.account.buyingPowerCents ?? cashCents;
  const unrealizedCents = deskQuery.data?.account?.unrealizedPnlCents ?? null;

  const rail = <section className="mb-5 overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: summary.severity === "critical" ? severityColor : "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    {/* Executive Cockpit Ticker Tape (Desktop) */}
    <div className="hidden sm:block">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-3.5 py-2 text-xs" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
        <div className="flex items-center gap-2.5">
          <StateMark state={data.account.isPaper === true ? "rule_qualified" : "unknown"} label={practiceAccountLabel(data.account.isPaper)} compact />
          <RailHelp label="About account mode">Practice trading uses simulated money. Viewing this account does not send an order.</RailHelp>
          <div className="h-3.5 w-px" style={{ background: "var(--sh-border-1)" }} />
          {/* Ambient Staleness Pill with inline 1-click refresh */}
          <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: summary.accountStale ? "color-mix(in srgb, var(--sh-signal) 12%, transparent)" : "color-mix(in srgb, var(--sh-emerald) 12%, transparent)", color: summary.accountStale ? "var(--sh-signal)" : "var(--sh-emerald)" }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: summary.accountStale ? "var(--sh-signal)" : "var(--sh-emerald)" }} />
            <span>Broker snapshot · {staleText}</span>
            {syncTarget.canSync ? <button
              type="button"
              onClick={handleRapidSync}
              disabled={syncing}
              title={SYNC_NOW_TITLE}
              className="ml-0.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider underline underline-offset-2 hover:bg-black/10 disabled:cursor-wait"
            >
              <RefreshCw aria-hidden="true" className={`h-2.5 w-2.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </button> : syncTarget.reason && <span>· {syncTarget.reason}</span>}
          </div>
          {/* The one active-thesis selector, same control as the context strip */}
          <div className="h-3.5 w-px" style={{ background: "var(--sh-border-1)" }} />
          <div className="flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
            <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>Thesis:</span>
            <ActiveThesisSelect variant="inline" />
          </div>
        </div>

        {/* Live Capital & Risk Metrics Glance */}
        <div className="flex items-center gap-4 text-[11px] tabular-nums font-mono">
          <div><MicroTooltip termKey="cash"><span style={{ color: "var(--sh-fg-muted)" }}>Account value: </span></MicroTooltip><span className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>{money(equityCents) ?? "Not available"}</span></div>
          <div><MicroTooltip termKey="buying_power"><span style={{ color: "var(--sh-fg-muted)" }}>{accountFundsLabel(data.account.buyingPowerCents)}: </span></MicroTooltip><span className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>{money(buyingPowerCents) ?? "Not available"}</span></div>
          {unrealizedCents != null && (
            <div>
              <MicroTooltip termKey="unrealized_pnl"><span style={{ color: "var(--sh-fg-muted)" }}>Unrealized: </span></MicroTooltip>
              <span className="font-semibold" style={{ color: unrealizedCents >= 0 ? "var(--sh-emerald)" : "var(--sh-red)" }}>
                {unrealizedCents >= 0 ? "+" : ""}{money(unrealizedCents)}
              </span>
            </div>
          )}
          {!compactOnly && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls="cockpit-rail-detail"
              aria-label={expanded ? "Hide account details" : "Show account details"}
              onClick={changeExpanded}
              className="flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-sans font-medium transition-colors hover:bg-black/5"
              style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}
            >
              <span>{expanded ? "Hide details" : apertureLanguage.accountDetails}</span>
              <ChevronDown className={`h-3 w-3 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Grid Row */}
      <div className="grid min-h-11 gap-px" style={{ background: "var(--sh-border-1)" }}>
        <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.15fr]" style={{ background: "var(--sh-border-1)" }}>
          <div className="flex min-w-0 items-center gap-2 px-3 py-2" style={{ background: "var(--sh-surface)" }}>
            <StateMark state={data.session.session === "unknown" ? "unknown" : "researchable"} label={data.session.session.replaceAll("_", " ")} compact />
            <span className="truncate text-xs" style={{ color: "var(--sh-text-primary)" }}>· {data.session.nextBoundary?.label.toLowerCase() ?? "boundary —"}{boundaryMs != null ? ` ${duration(boundaryMs)}` : ""}</span>
            <RailHelp label="Explain market boundary">Market timing context only; it is not a trade signal.</RailHelp>
          </div>
          <div className="flex min-w-0 items-center gap-2 px-3 py-2" style={{ background: "var(--sh-surface)" }}>
            <StateMark state={summary.accountStale ? "stale" : "rule_qualified"} label={data.account.label || "Paper account —"} compact />
            <span className="truncate text-xs" style={{ color: summary.accountStale ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>· {staleText}</span>
            <RailHelp label="Explain account freshness">Account limits use this saved account value. Refresh the account before relying on outdated limits.</RailHelp>
          </div>
          <div className="flex min-w-0 items-center gap-2 px-3 py-2" style={{ background: summary.severity === "critical" ? "color-mix(in srgb, var(--sh-red) 5%, var(--sh-surface))" : "var(--sh-surface)" }}>
            <StateMark state={summary.severity === "critical" ? "blocked" : summary.severity === "unmeasurable" ? "unknown" : "rule_qualified"} label="Portfolio constraint" compact />
            <span className="min-w-0 truncate text-xs font-semibold" title={summary.binding ? `${summary.binding.label} · ${bindingSubject}` : "No measurable constraint"} style={{ color: "var(--sh-text-primary)" }}>{summary.binding ? bindingSubject : "Not measured"}</span>
            <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full" style={{ background: "var(--sh-border-1)" }} role="progressbar" aria-label="Tightest constraint utilization" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bindingUtilization} aria-valuetext={`${bindingUtilization.toFixed(0)}% used; ${bindingHeadroom.toFixed(0)}% headroom`}>
              <div className="h-full rounded-full" style={{ width: `${bindingUtilization}%`, background: severityColor }} />
            </div>
            <BasisMark basis="measured" label={`${bindingUtilization.toFixed(0)}% / ${bindingHeadroom.toFixed(0)}%`} />
            <RailHelp label={`Explain ${bindingSubject} headroom`}>{bindingThresholdText}</RailHelp>
            <span className="font-mono text-[10px] tabular-nums font-semibold" style={{ color: severityColor }}>{bindingUtilization.toFixed(0)}% used</span>
          </div>
        </div>
      </div>
    </div>

    {/* Mobile Cockpit Header */}
    <div className="sm:hidden">
      <div className="flex min-h-11 items-center gap-2 border-b px-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
        <StateMark state={data.account.isPaper === true ? "rule_qualified" : "unknown"} label={practiceAccountLabel(data.account.isPaper)} compact />
        <span className="min-w-0 flex-1 truncate text-[11px]" title={`${data.account.label || "Paper account"} · ${staleText}`} style={{ color: summary.accountStale ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>{data.account.label || "Paper account"} · {staleText}</span>
        {syncTarget.canSync && <SyncNowButton onSync={handleRapidSync} syncing={syncing} className="ml-0 shrink-0" />}
        <span className="max-w-[7rem] shrink-0 truncate text-[11px] font-semibold" title={data.activeThesis?.name ?? "No active thesis"} style={{ color: "var(--sh-text-primary)" }}>Thesis {data.activeThesis?.name ?? "—"}</span>
      </div>
      <div className="flex min-h-11 items-center gap-2 px-3" style={{ background: summary.severity === "critical" ? "color-mix(in srgb, var(--sh-red) 5%, var(--sh-surface))" : "var(--sh-surface)" }}>
        <StateMark state={summary.severity === "critical" ? "blocked" : summary.severity === "unmeasurable" ? "unknown" : "rule_qualified"} label="Constraint" compact />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={summary.binding ? `${summary.binding.label} · ${bindingSubject}` : "No measurable constraint"} style={{ color: "var(--sh-text-primary)" }}>{summary.binding ? bindingSubject : "Not measured"}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums" style={{ color: severityColor }}>{bindingUtilization.toFixed(0)}% used</span>
        {!compactOnly && <button type="button" aria-expanded={expanded} aria-controls="cockpit-rail-detail" aria-label={expanded ? "Hide account details" : "Show account details"} onClick={changeExpanded} className="min-h-11 shrink-0 rounded px-2 py-1 text-[11px] font-semibold" style={{ color: "var(--sh-text-primary)" }}>{expanded ? "Hide" : "Detail"}<ChevronDown className={`ml-1 inline h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} /></button>}
      </div>
    </div>

    {/* Portfolio Constraint Note & Guided Resolver */}
    {summary.severity === "critical" && (
      <>
        <div className="flex items-center justify-between border-t px-3 py-1 text-[11px] leading-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}>
          <div className="flex items-center gap-1.5 truncate">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-mono font-medium text-[10px] text-amber-500 uppercase shrink-0">Portfolio Note:</span>
            <span className="truncate text-[11px]">
              {bindingSubject} uses {bindingUtilization.toFixed(0)}% of its ceiling, leaving {bindingHeadroom.toFixed(0)}%. New exposure that relies on {bindingSubject} is blocked; existing positions are unchanged.
            </span>
          </div>
          <button type="button" onClick={changeExpanded} className="ml-2 shrink-0 font-mono text-[10px] underline hover:text-[var(--sh-text-primary)]" style={{ color: "var(--sh-fg-muted)" }}>
            {expanded ? "Hide" : "Limits"}
          </button>
        </div>
        {isGuided && (
          <div className="border-t p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <ConstraintResolverCard line={summary.binding} />
          </div>
        )}
      </>
    )}
    {expanded && !compactOnly && <div id="cockpit-rail-detail">
    <div className="grid gap-px lg:grid-cols-3" style={{ background: "var(--sh-border-1)" }}>
      <div className="space-y-2 p-4" style={{ background: "var(--sh-surface)" }}><RailHead>Market clock</RailHead><div className="flex items-center gap-2"><Clock3 className="h-4 w-4" style={{ color: data.session.session === "unknown" ? "var(--sh-red)" : "var(--sh-signal)" }} /><p className="text-sm font-semibold capitalize" style={{ color: "var(--sh-text-primary)" }}>{data.session.session.replaceAll("_", " ")}</p></div>{data.session.unavailableReason ? <p className="text-xs leading-5" style={{ color: "var(--sh-red)" }}>{data.session.unavailableReason}</p> : <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.session.nextBoundary?.label ?? "No next boundary recorded"}{boundaryMs != null ? ` in ${duration(boundaryMs)}` : ""}{data.session.halfDay ? " · half day" : ""}</p>}</div>
      <div className="space-y-2 p-4" style={{ background: "var(--sh-surface)" }}><RailHead>Paper account</RailHead><div className="flex min-w-0 items-center gap-2"><Landmark className="h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><p className="min-w-0 truncate text-sm font-semibold" title={data.account.label || "No account selected"} style={{ color: "var(--sh-text-primary)" }}>{data.account.label || "No account selected"}</p></div>{data.account.unavailableReason ? <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.account.unavailableReason}</p> : <div className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}><p style={{ color: summary.accountStale ? "var(--sh-signal)" : undefined }}>{data.account.isPaper ? "Paper account" : "Account type not stated"} · {staleText}{summary.accountStale ? " — play ceilings may be stale" : ""}</p><p className="tabular-nums">Equity {money(data.account.equityValueCents) ?? "not measured"} · cash {money(data.account.cashCents) ?? "not measured"}</p>{data.account.syncError && <p style={{ color: "var(--sh-red)" }}>Sync issue: {data.account.syncError}</p>}</div>}</div>
      <div className="space-y-2 p-4" style={{ background: "var(--sh-surface)" }}><RailHead><MicroTooltip termKey="single_order_ceiling">Account limits · {data.mandate.version}</MicroTooltip></RailHead><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>These account limits also apply when an order is checked.</p><p className="text-xs" style={{ color: "var(--sh-text-primary)" }}>Single order {singleOrderLimitView.value} · planned loss / play {formatMandatePercentPoints(data.mandate.maxPlannedRiskPctPerPlay)} · daily {formatMandatePercentPoints(data.mandate.maxDailyPlannedRiskPct)}</p><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{singleOrderLimitView.explanation}</p></div>
    </div>
    <div className="flex items-center justify-between gap-3 border-t px-4 py-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><RailHead>Constraint detail</RailHead><div className="flex items-center gap-1 text-[11px]" aria-label="Constraint ordering"><span style={{ color: "var(--sh-fg-muted)" }}>Order</span><button type="button" aria-pressed={sortMode === "severity"} onClick={() => setSortMode("severity")} className="rounded px-1.5 py-1" style={{ background: sortMode === "severity" ? "var(--sh-surface-3)" : undefined, color: "var(--sh-text-primary)" }}>severity</button><button type="button" aria-pressed={sortMode === "impact"} onClick={() => setSortMode("impact")} className="rounded px-1.5 py-1" style={{ background: sortMode === "impact" ? "var(--sh-surface-3)" : undefined, color: "var(--sh-text-primary)" }}>impact</button></div></div>
    <div className="grid gap-px lg:grid-cols-2" style={{ background: "var(--sh-border-1)" }}>
      <div className="space-y-3 p-4" style={{ background: "var(--sh-surface-2)" }}><RailHead><MicroTooltip termKey="notional_exposure">Notional headroom · capital committed</MicroTooltip></RailHead>{notionalLines.map((line) => <MeasureLine key={line.key} line={line} />)}</div>
      <div className="space-y-3 p-4" style={{ background: "var(--sh-surface-2)" }}><RailHead><MicroTooltip termKey="planned_loss_limit">Planned-loss headroom · capital at risk</MicroTooltip></RailHead>{riskLines.map((line) => <MeasureLine key={line.key} line={line} />)}</div>
    </div>
    {summary.duplicatedUnclassifiedCluster && <p className="border-t px-4 py-2 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>The largest correlated cluster equals the largest name because no sector fact is recorded; it is shown once above rather than double-counted.</p>}
    {data.run && <div className="border-t px-4 py-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><RailHead>Run preset · #{data.run.runId}{data.run.thesisName ? ` (${data.run.thesisName})` : ""}</RailHead>{data.run.unavailableReason ? <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.run.unavailableReason}</p> : <div className="mt-1 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4" style={{ color: "var(--sh-fg-muted)" }}><p>{data.run.holdingPeriodLabel || "holding period not measured"}</p><p>{deadlineMs == null ? "catalyst deadline not measured" : deadlineMs < 0 ? `catalyst window expired ${duration(-deadlineMs)} ago` : `catalyst deadline in ${duration(deadlineMs)}`}</p><p className="tabular-nums">Liquidity floor {data.run.liquidityFloorAdvUsd == null ? "not measured" : `$${Math.round(data.run.liquidityFloorAdvUsd).toLocaleString()}`}</p><p className="tabular-nums">Single-name cap {data.run.maxSingleNamePct == null ? "not measured" : `${data.run.maxSingleNamePct.toFixed(1)}%`}</p><p className="sm:col-span-2 lg:col-span-4">Invalidation: {data.run.invalidationRule || "not measured"}</p>{data.run.providerGaps === null ? <p className="sm:col-span-2 lg:col-span-4">Provider availability was not recorded for this run.</p> : data.run.providerGaps.length ? <p className="sm:col-span-2 lg:col-span-4">Provider gaps: {data.run.providerGaps.join(", ")}</p> : <p className="sm:col-span-2 lg:col-span-4">Every provider recorded for this run was live.</p>}</div>}</div>}
    </div>}
  </section>;
  if (editorialContext) return <section className="capital-context" aria-label="Account context">
    <div className="capital-context-strip">
      <div><span className="capital-context-label">{practiceAccountLabel(data.account.isPaper)}</span><strong>{money(equityCents) ?? "Value unavailable"}</strong><small>Broker snapshot · {staleText}{syncTarget.canSync ? <SyncNowButton onSync={handleRapidSync} syncing={syncing} /> : syncTarget.reason ? ` · ${syncTarget.reason}` : null}</small></div>
      <ActiveThesisSelect />
      <div className="capital-context-limit" style={{ borderColor: severityColor }}>
        <span className="capital-context-label">Your limits</span>
        <LimitBars lines={data.headroom.lines as HeadroomLine[]} />
        <small>{summary.accountStale ? "Measured from stale account numbers. Sync first." : summary.binding && summary.severity !== "quiet" ? `Tightest holding limit: ${bindingSubject} at ${bindingUtilization.toFixed(0)}%.` : "Saved limits. Checks run again on every order."}</small>
      </div>
    </div>
    <details className="capital-context-controls"><summary>Account controls & evidence <span aria-hidden="true">↗</span></summary>{rail}</details>
  </section>;
  return visualHero ? <><ConnectedPortfolioPortrait key={data.account.accountId ?? "unknown"} accountId={data.account.accountId} account={data.account} thesis={data.activeThesis?.name ?? null} binding={summary.binding} now={clockNow} syncAction={syncTarget.canSync ? <SyncNowButton onSync={handleRapidSync} syncing={syncing} tone="inherit" /> : syncTarget.reason ? <span> · {syncTarget.reason}</span> : null}/><details className="portrait-machinery"><summary>Account controls, market clock & all constraints</summary>{rail}</details></> : rail;
}
