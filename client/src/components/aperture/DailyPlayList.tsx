import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ChevronDown, CircleSlash2, Compass, FileSearch, GitCompareArrows, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { buildPlayRecipe } from "@shared/playRecipe";
import { orderDailyPlayQueue, researchCoverageLabel } from "@shared/dailyPlayQueue";
import { dailyPlayPrimaryDestination } from "@shared/dailyPlayActions";

export type ScreeningCriteriaKey = "catalyst_14d" | "high_iv" | "macro_hedge";

export const SCREENING_CRITERIA: Record<ScreeningCriteriaKey, {
  label: string;
  tagline: string;
  description: string;
}> = {
  catalyst_14d: {
    label: "Near-term Catalyst (<14d)",
    tagline: "Short-horizon events, earnings releases, and scheduled macro decisions",
    description: "Filters research candidates with a confirmed catalyst event expiring within 14 calendar days.",
  },
  high_iv: {
    label: "High IV / Asymmetric",
    tagline: "Volatile regime, asymmetric skew, and convex risk/reward setups",
    description: "Filters research candidates with elevated implied volatility or defined option structure.",
  },
  macro_hedge: {
    label: "Correlated Macro Hedge",
    tagline: "Negative correlation, factor counterbalance, and systemic portfolio protection",
    description: "Filters research candidates flagged for portfolio hedging and factor counterbalance.",
  },
};
import { easternDateKeyFromEpoch } from "@shared/easternMarketTime";
import { PlayRecipeCard } from "./PlayRecipeCard";
import { ContextHelp } from "./ContextHelp";
import { TodayAttentionBriefing } from "./TodayAttentionBriefing";
import { attentionContextLabel, safeStatusError, type AttentionStatusSource } from "@shared/apertureAttention";

function money(cents: number | null | undefined) {
  return cents == null ? "Not set" : `$${Math.round(cents / 100).toLocaleString()}`;
}

export function IntradayTrigger({ runId, candidateId, holdingPeriod }: { runId: number; candidateId: number; holdingPeriod: string | null }) {
  const enabled = holdingPeriod === "intraday";
  const { data, isLoading, error, refetch } = trpc.aperture.play.trigger.useQuery({ runId, candidateId }, { enabled, staleTime: 30_000 });
  if (!enabled) return <div><p style={{ color: "var(--sh-fg-muted)" }}>Trigger state</p><p className="mt-1 font-semibold" style={{ color: "var(--sh-text-primary)" }}>Not applicable</p><p className="mt-1 leading-5" style={{ color: "var(--sh-fg-muted)" }}>VWAP hold is only evaluated for intraday plays.</p></div>;
  if (error) return <div role="alert"><p className="font-semibold">Trigger could not be verified</p><p className="mt-1 leading-5">{safeStatusError("trigger")} No entry confirmation is implied.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => void refetch()}>Refresh trigger evidence</Button></div>;
  if (isLoading || !data) return <div><p style={{ color: "var(--sh-fg-muted)" }}>VWAP trigger</p><p className="mt-1 font-semibold" style={{ color: "var(--sh-text-primary)" }}>Measuring tape…</p></div>;
  const label = data.state === "confirmed" ? "Confirmed on available tape" : data.state === "rejected" ? "Not holding on available tape" : "Needs terminal confirmation";
  const tone = data.state === "confirmed" ? "oklch(0.55 0.15 145)" : data.state === "rejected" ? "var(--sh-red)" : "var(--sh-signal)";
  const range = data.openingRange;
  return <div><p style={{ color: "var(--sh-fg-muted)" }}>VWAP trigger · 15m hold {data.triggerSide}</p><p className="mt-1 font-semibold" style={{ color: tone }}>{label} · {data.playSide} recipe</p><p className="mt-1 leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.basis}</p>{range && <p className="mt-1 leading-5" style={{ color: "var(--sh-fg-muted)" }}>Opening range: {range.complete ? `${range.widthPct?.toFixed(2) ?? "not measured"}% wide` : range.unavailableReason ?? "still forming"} · {range.feed.toUpperCase()} tape.</p>}</div>;
}

export function DailyPlayList({ onNewMission, onNewResearch, onOpenRun }: {
  onNewMission: () => void;
  onNewResearch: () => void;
  onOpenRun: (runId: number, candidateId: number, view?: string) => void;
}) {
  const [, navigate] = useLocation();
  const { data: playList, isLoading, isFetching: playsRefreshing, error: playsError, refetch: refetchPlays } = trpc.aperture.play.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const desk = trpc.aperture.desk.summary.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const accountQuery = trpc.aperture.account.list.useQuery(undefined, { retry: false });
  const accounts = accountQuery.data;
  const thesisQuery = trpc.thesis.activeCapital.useQuery(undefined, { retry: false });
  const activeCapitalContext = thesisQuery.data;
  const { data: runway } = trpc.aperture.runway.latest.useQuery();
  const currentCashReopen = runway?.latest && "reopenCondition" in runway.latest ? runway.latest.reopenCondition : null;
  const preferredAccount = accounts?.find((account) => account.isPaper && account.brokerId === "alpaca_paper")
    ?? accounts?.find((account) => account.isPaper);
  const accountModeLabel = preferredAccount
    ? preferredAccount.isPaper
      ? "Paper account · human approval required"
      : "Live account · human approval required"
    : accountQuery.isLoading ? "Loading account mode…" : accountQuery.error ? "Account mode unavailable" : "No paper execution account selected";
  const accountLabel = attentionContextLabel({
    value: preferredAccount?.label, loading: accountQuery.isLoading, failed: !!accountQuery.error,
    subject: "paper account", emptyLabel: "No paper execution account selected",
  });
  const thesisLabel = attentionContextLabel({
    value: activeCapitalContext?.thesis?.name, loading: thesisQuery.isLoading, failed: !!thesisQuery.error,
    subject: "active thesis", emptyLabel: "No active Capital thesis",
  });
  const preferredAccountId = preferredAccount?.id;
  const { data: cockpit, refetch: refetchCockpit } = trpc.aperture.cockpit.useQuery(preferredAccountId ? { accountId: preferredAccountId } : undefined, { enabled: preferredAccountId != null });
  const failedSources: AttentionStatusSource[] = [];
  if (desk.error) failedSources.push("status");
  if (accountQuery.error) failedSources.push("account");
  if (thesisQuery.error) failedSources.push("thesis");
  if (playsError) failedSources.push("research");
  const statusErrors = failedSources.map(safeStatusError).join(" ") || null;
  const utils = trpc.useUtils();
  const runsQuery = trpc.aperture.run.list.useQuery(undefined, { retry: false });
  const [activeScreening, setActiveScreening] = useState<ScreeningCriteriaKey | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAllPlays, setShowAllPlays] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [confirmSkipCandidateId, setConfirmSkipCandidateId] = useState<number | null>(null);
  const [decisionAnnouncement, setDecisionAnnouncement] = useState("");
  const decide = trpc.aperture.play.decide.useMutation({
    onSuccess: (_, input) => {
      setReasons((current) => ({ ...current, [input.candidateId]: "" }));
      setConfirmSkipCandidateId(null);
      setExpandedId((current) => current === input.candidateId ? null : current);
      setDecisionAnnouncement(input.decision === "skipped" ? "Permanent skip recorded. The play has been retired and added to the weekly scorecard." : "Defer recorded. This play will return at the next regular market session.");
      void utils.aperture.play.list.invalidate();
    },
  });
  const captureComparison = trpc.aperture.ledger.captureCurrentWindow.useMutation({
    onSuccess: async ({ created }) => {
      await utils.aperture.ledger.list.invalidate();
      setDecisionAnnouncement(created
        ? "Outcome comparison started. Submit, reject, skip, or defer actions from this captured slate will remain in the paper record."
        : "The existing outcome comparison is active for this thesis and session.");
    },
    onError: () => setDecisionAnnouncement(safeStatusError("comparison")),
  });
  const ranked = useMemo(() => orderDailyPlayQueue((playList?.plays ?? [])
    .filter((play) => !play.decision)
    .map((item) => ({
      item,
      recipe: buildPlayRecipe({
        candidate: item.candidate,
        run: item.run,
        reviewedChecks: item.reviews.filter((review) => review.status === "reviewed").map((review) => review.checkLabel),
      }),
      readiness: buildPlayRecipe({
        candidate: item.candidate,
        run: item.run,
        reviewedChecks: item.reviews.filter((review) => review.status === "reviewed").map((review) => review.checkLabel),
      }).readiness,
      catalystDeadlineAt: item.run.catalystDeadlineAt,
    }))), [playList]);

  const screenedCandidates = useMemo(() => {
    if (!activeScreening) return [];
    const list: Array<{
      runId: number;
      candidateId: number;
      symbol: string;
      thesisName: string;
      holdingPeriod: string;
      catalystSummary: string;
      timeRemaining: string;
    }> = [];

    // 1. Inspect plays in current thesis queue
    for (const play of playList?.plays ?? []) {
      let matches = false;
      const deadline = play.run.catalystDeadlineAt;
      const now = Date.now();
      const daysToDeadline = deadline ? Math.ceil((deadline - now) / 86400000) : null;

      if (activeScreening === "catalyst_14d") {
        matches = Boolean(daysToDeadline != null && daysToDeadline <= 14 && daysToDeadline >= 0)
          || play.run.holdingPeriod === "intraday"
          || play.run.holdingPeriod === "catalyst_window";
      } else if (activeScreening === "high_iv") {
        matches = play.run.holdingPeriod === "intraday"
          || Boolean(play.thesisName?.toLowerCase().includes("iv") || play.thesisName?.toLowerCase().includes("vol"));
      } else if (activeScreening === "macro_hedge") {
        matches = Boolean(play.thesisName?.toLowerCase().includes("macro") || play.thesisName?.toLowerCase().includes("hedge"));
      }

      if (matches) {
        list.push({
          runId: play.run.id,
          candidateId: play.candidate.id,
          symbol: play.candidate.symbol,
          thesisName: play.thesisName ?? "Active thesis",
          holdingPeriod: play.run.holdingPeriod ?? "catalyst",
          catalystSummary: play.run.catalystDeadlineAt
            ? `Catalyst window: ${new Date(play.run.catalystDeadlineAt).toLocaleDateString()}`
            : "Active research play candidate",
          timeRemaining: daysToDeadline != null && daysToDeadline >= 0
            ? `${daysToDeadline}d remaining`
            : "Active catalyst",
        });
      }
    }

    // 2. Also inspect runs across all research journeys if queue has none
    if (list.length === 0 && runsQuery.data) {
      for (const run of runsQuery.data) {
        if (!run.actionableSymbol || !run.actionableCandidateId) continue;
        let matches = false;
        const deadline = run.catalystDeadlineAt;
        const now = Date.now();
        const daysToDeadline = deadline ? Math.ceil((deadline - now) / 86400000) : null;

        if (activeScreening === "catalyst_14d") {
          matches = Boolean(daysToDeadline != null && daysToDeadline <= 14 && daysToDeadline >= 0)
            || run.holdingPeriod === "intraday"
            || run.holdingPeriod === "catalyst_window";
        } else if (activeScreening === "high_iv") {
          matches = run.holdingPeriod === "intraday"
            || Boolean(run.thesisName?.toLowerCase().includes("iv") || run.thesisName?.toLowerCase().includes("vol"));
        } else if (activeScreening === "macro_hedge") {
          matches = Boolean(run.thesisName?.toLowerCase().includes("macro") || run.thesisName?.toLowerCase().includes("hedge"));
        }

        if (matches) {
          list.push({
            runId: run.id,
            candidateId: run.actionableCandidateId,
            symbol: run.actionableSymbol,
            thesisName: run.thesisName ?? "Research run",
            holdingPeriod: run.holdingPeriod ?? "catalyst",
            catalystSummary: run.catalystDeadlineAt
              ? `Catalyst window: ${new Date(run.catalystDeadlineAt).toLocaleDateString()}`
              : "Research journey candidate",
            timeRemaining: daysToDeadline != null && daysToDeadline >= 0
              ? `${daysToDeadline}d remaining`
              : "Active horizon",
          });
        }
      }
    }

    return list;
  }, [activeScreening, playList, runsQuery.data]);
  const todayEt = easternDateKeyFromEpoch(Date.now());
  const hasTodayPlay = ranked.some(({ item }) => item.run.catalystDeadlineAt != null
    && easternDateKeyFromEpoch(item.run.catalystDeadlineAt) === todayEt);
  const correlation = cockpit?.headroom.lines.find((line) => line.key === "correlated_planned_risk");
  useEffect(() => {
    const openPrimaryStep = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const queued = ranked.find((play) => play.item.candidate.id === expandedId);
      if (!queued) return;
      const item = queued.item;
      event.preventDefault();
      const recipe = queued.recipe;
      const promotionBlocked = item.decisionAuthority !== "authoritative" || item.decisionBranch === "cash" || item.decisionBranch === "conditional";
      const destination = promotionBlocked ? "evidence" : dailyPlayPrimaryDestination(recipe.readiness);
      setDecisionAnnouncement(promotionBlocked ? `Opening ${item.candidate.symbol}'s research evidence. This run cannot prepare a paper proposal under its own receipt.` : destination === "execute" ? `Opening ${item.candidate.symbol}'s human paper-proposal review. Nothing has been submitted.` : `Opening ${item.candidate.symbol}'s decisive evidence questions.`);
      onOpenRun(item.run.id, item.candidate.id, destination);
    };
    window.addEventListener("keydown", openPrimaryStep);
    return () => window.removeEventListener("keydown", openPrimaryStep);
  }, [expandedId, onOpenRun, ranked]);

  return <section className="space-y-5">
    <TodayAttentionBriefing
      execution={desk.data}
      executionFailed={!!desk.error}
      attention={desk.data?.attention ?? null}
      accountLabel={accountLabel}
      modeLabel={preferredAccount && !preferredAccount.isPaper ? "Execution unavailable" : "Paper"}
      loading={desk.isFetching}
      failed={statusErrors}
      failedSources={failedSources}
      onOpen={navigate}
      onRetry={() => { void Promise.all([desk.refetch(), refetchPlays(), accountQuery.refetch(), thesisQuery.refetch(), ...(preferredAccountId != null ? [refetchCockpit()] : [])]); }}
      onNewMission={onNewMission}
    />
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Decision depth</p>
        <div className="flex items-center gap-1"><h2 className="mt-1 font-serif text-2xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>Research queue</h2><ContextHelp title="What is shown here?" what="Research candidates that still need a choice. Work already in motion remains summarized in the briefing above." next="Open only the play whose evidence or action you need to inspect." align="start" /></div>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Validate a setup, record a skip, or preserve cash without replaying the full research history.</p>
      </div>
      <div className="flex flex-wrap gap-2"><Button className="min-h-11" variant="outline" disabled={!hasTodayPlay || captureComparison.isPending} title={hasTodayPlay ? "Capture today's eligible paper plays before choosing a disposition" : "Available on the declared ET decision date"} onClick={() => captureComparison.mutate({ windowKey: "operator_decision" })}>{captureComparison.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitCompareArrows className="mr-2 h-4 w-4" />}Compare today</Button><Button className="min-h-11" variant="ghost" onClick={onNewResearch}><FileSearch className="mr-2 h-4 w-4" />Research brief</Button></div>
    </header>

    <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Research context · {thesisLabel}</summary>
    <div className="grid gap-px overflow-hidden rounded-xl border sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
      <div className="p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Active thesis</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{thesisLabel}</p></div>
      <div className="p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Account · as of</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{preferredAccount ? `${accountLabel} · account snapshot ${preferredAccount.lastSyncedAt ? new Date(preferredAccount.lastSyncedAt).toLocaleString() : "not measured"}` : accountLabel}</p></div>
      <div className="p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Account mode</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{accountModeLabel}</p></div>
    </div></details>

    {(() => {
      const usedCents = correlation?.usedCents ?? 0;
      const ceilingCents = correlation?.ceilingCents ?? 0;
      const percentUsed = ceilingCents > 0 ? Math.min(100, Math.round((usedCents / ceilingCents) * 100)) : 0;
      return <div className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Dynamic Risk Guardrail</span>
            <p className="mt-0.5 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>
              Cluster Risk Capacity {correlation?.subject ? `· ${correlation.subject}` : ""}
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color: percentUsed > 85 ? "var(--sh-red)" : "var(--sh-text-primary)" }}>
              {correlation?.usedCents != null && correlation.ceilingCents != null ? `${money(usedCents)} / ${money(ceilingCents)}` : "0% committed"}
            </span>
            <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium" style={{ background: percentUsed > 85 ? "color-mix(in srgb, var(--sh-red) 15%, transparent)" : "var(--sh-surface-2)", color: percentUsed > 85 ? "var(--sh-red)" : "var(--sh-fg-muted)" }}>
              {percentUsed}% capacity
            </span>
          </div>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--sh-surface-2)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(2, percentUsed)}%`,
              background: percentUsed > 85 ? "var(--sh-red)" : percentUsed > 50 ? "var(--sh-signal)" : "var(--sh-emerald)",
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>
          <span><strong style={{ color: "var(--sh-text-primary)" }}>Correlated planned-loss budget:</strong> {correlation?.usedCents != null && correlation.ceilingCents != null ? `${money(correlation.usedCents)} committed${correlation.subject ? ` in ${correlation.subject}` : ""} of ${money(correlation.ceilingCents)}.` : correlation?.reason ?? "No planned loss is committed in any cluster today."}</span>
          <span>Theme overlap is not assigned until factual preflight.</span>
        </div>
      </div>;
    })()}

    {runway?.latest?.branch === "cash" && <div className="flex gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 38%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 5%, var(--sh-surface))" }}><CircleSlash2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-signal)" }}>Current decision</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>No new trade · $0 additional planned risk</p><p className="mt-0.5 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{runway.latest.reason ?? "A cash receipt is recorded for this mission."} Reopen: {currentCashReopen ?? "record a new revision"}. Existing positions and portfolio risk are unchanged.</p></div></div>}
    {decisionAnnouncement && <div role="status" className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 38%, var(--sh-border-1))", background: "var(--sh-surface-2)", color: "var(--sh-text-primary)" }}><strong>{decisionAnnouncement === safeStatusError("comparison") ? "Request unconfirmed." : "Decision recorded."}</strong> {decisionAnnouncement}</div>}

    {playsError && <div role="alert" className="rounded-xl border p-4" style={{ borderColor: "var(--sh-red)" }}><p className="font-semibold">Research queue could not be refreshed</p><p className="mt-1 text-sm">{safeStatusError("research")}{playList ? " The last successful queue remains below; eligibility has not been reverified." : " An unavailable queue is not an empty queue."}</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void refetchPlays()}>Retry research queue</Button></div>}
    {playsRefreshing && !isLoading && <p role="status" className="text-sm">Refreshing saved research records…</p>}
    {isLoading && <div role="status" className="flex items-center gap-2 py-6 text-sm" style={{ color: "var(--sh-fg-muted)" }}><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading the saved research queue…</div>}
    {!isLoading && !playsError && playList != null && ranked.length === 0 && (playList.inMotionPlayCount ?? 0) > 0 && <div className="rounded-xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--sh-emerald) 42%, var(--sh-border-1))", background: "var(--sh-surface-2)" }}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-emerald)" }}>Already in motion</p><p className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>{playList?.inMotionPlayCount} active or queued play{playList?.inMotionPlayCount === 1 ? "" : "s"}</p><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>No new research candidate awaits a choice in this thesis queue. Review the briefing above for existing play decisions.</p></div><Button className="min-h-11 shrink-0" onClick={() => window.location.assign("/aperture/plays")}>Open Play Desk <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>}
    {!isLoading && !playsError && playList != null && ranked.length === 0 && (playList.inMotionPlayCount ?? 0) === 0 && <div className="rounded-xl border p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>No research candidate awaiting a choice</p>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>This queue covers the active thesis only. An empty queue does not record a cash decision or change existing positions.{playList.expiredPlayCount ? ` ${playList.expiredPlayCount} past-catalyst candidates are outside this queue.` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" className="min-h-11" onClick={onNewResearch}><Sparkles className="mr-2 h-4 w-4" />Run screening</Button>
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => window.location.assign("/aperture/theses")}><Compass className="mr-2 h-4 w-4" />Switch thesis</Button>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "var(--sh-border-1)" }}>
        <span className="text-xs font-medium" style={{ color: "var(--sh-fg-muted)" }}>Quick screening criteria:</span>
        <button
          type="button"
          onClick={() => setActiveScreening((cur) => cur === "catalyst_14d" ? null : "catalyst_14d")}
          className="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
          style={{
            borderColor: activeScreening === "catalyst_14d" ? "var(--sh-signal)" : "var(--sh-border-1)",
            background: activeScreening === "catalyst_14d" ? "color-mix(in srgb, var(--sh-signal) 12%, var(--sh-surface-2))" : "var(--sh-surface-2)",
            color: activeScreening === "catalyst_14d" ? "var(--sh-signal)" : "var(--sh-text-primary)",
            fontWeight: activeScreening === "catalyst_14d" ? 600 : 500,
          }}
        >
          🔥 Near-term Catalyst (&lt;14d)
        </button>
        <button
          type="button"
          onClick={() => setActiveScreening((cur) => cur === "high_iv" ? null : "high_iv")}
          className="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
          style={{
            borderColor: activeScreening === "high_iv" ? "var(--sh-signal)" : "var(--sh-border-1)",
            background: activeScreening === "high_iv" ? "color-mix(in srgb, var(--sh-signal) 12%, var(--sh-surface-2))" : "var(--sh-surface-2)",
            color: activeScreening === "high_iv" ? "var(--sh-signal)" : "var(--sh-text-primary)",
            fontWeight: activeScreening === "high_iv" ? 600 : 500,
          }}
        >
          ⚡ High IV / Asymmetric
        </button>
        <button
          type="button"
          onClick={() => setActiveScreening((cur) => cur === "macro_hedge" ? null : "macro_hedge")}
          className="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
          style={{
            borderColor: activeScreening === "macro_hedge" ? "var(--sh-signal)" : "var(--sh-border-1)",
            background: activeScreening === "macro_hedge" ? "color-mix(in srgb, var(--sh-signal) 12%, var(--sh-surface-2))" : "var(--sh-surface-2)",
            color: activeScreening === "macro_hedge" ? "var(--sh-signal)" : "var(--sh-text-primary)",
            fontWeight: activeScreening === "macro_hedge" ? 600 : 500,
          }}
        >
          🛡️ Correlated Macro Hedge
        </button>
      </div>

      {activeScreening && (
        <div className="mt-3 rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--sh-border-1)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>
                Screening: {SCREENING_CRITERIA[activeScreening].label}
              </p>
              <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                {SCREENING_CRITERIA[activeScreening].tagline}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ background: "color-mix(in srgb, var(--sh-signal) 15%, transparent)", color: "var(--sh-signal)" }}>
                Live Screen Active
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setActiveScreening(null)}>
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>

          {screenedCandidates.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {screenedCandidates.map((candidate) => (
                <div key={`${candidate.runId}-${candidate.candidateId}`} className="rounded-lg border p-3 flex flex-col justify-between space-y-2.5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-base" style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol}</span>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
                        {candidate.holdingPeriod ?? "catalyst"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium line-clamp-1" style={{ color: "var(--sh-text-primary)" }}>
                      {candidate.thesisName}
                    </p>
                    <p className="mt-0.5 text-[11px] line-clamp-2" style={{ color: "var(--sh-fg-muted)" }}>
                      {candidate.catalystSummary}
                    </p>
                  </div>
                  <div className="pt-2 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--sh-border-1)" }}>
                    <span className="text-[10px] font-mono" style={{ color: "var(--sh-signal)" }}>
                      {candidate.timeRemaining}
                    </span>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => onOpenRun(candidate.runId, candidate.candidateId, "evidence")}>
                      Inspect evidence <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center space-y-2">
              <p className="text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>
                No candidate in current queue meets "{SCREENING_CRITERIA[activeScreening].label}"
              </p>
              <p className="text-xs max-w-md mx-auto" style={{ color: "var(--sh-fg-muted)" }}>
                {SCREENING_CRITERIA[activeScreening].description} You can inspect your broader research journeys or switch active thesis without losing context.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate(`/aperture/runs?filter=${activeScreening}`)}>
                  Open research journeys <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate("/aperture/theses")}>
                  Switch thesis
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>}

    {ranked.length > 0 && <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Queue order reflects readiness, then the nearest live catalyst deadline. It is not a predicted return ranking or a claim that the first play should be taken.</p>}
    <div className="space-y-3">
      {(showAllPlays ? ranked : ranked.slice(0, 3)).map(({ item, recipe: play }) => {
        const expanded = expandedId === item.candidate.id;
        const proposalBlockedReason = item.decisionAuthority !== "authoritative"
          ? "Research-only legacy run. Start from Capital Mission to create an exact thesis, account, and revision binding."
          : item.decisionBranch === "cash"
            ? item.decisionReason ?? "Cash / no-trade is recorded for this run at $0 planned risk."
            : item.decisionBranch === "conditional"
              ? `${item.decisionBlocker ?? "A named gate remains unresolved."}${item.decisionReopenCondition ? ` Reopen when: ${item.decisionReopenCondition}` : ""}`
              : null;
        const mainBlocker = play.blockingReasons[0] ?? "No research blocker was generated; approval is still separate.";
        const reviewedChecks = new Set(item.reviews.filter((review) => review.status === "reviewed").map((review) => review.checkLabel));
        const openChecks = play.requiredChecks.filter((check) => !reviewedChecks.has(check)).length;
        return <article key={item.candidate.id} className="overflow-hidden rounded-xl border" style={{ borderColor: expanded ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <button type="button" aria-controls={`daily-play-detail-${item.candidate.id}`} className="grid min-h-11 w-full gap-3 p-4 text-left sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:p-5" onClick={() => setExpandedId(expanded ? null : item.candidate.id)} aria-expanded={expanded}>
            <div><p className="font-serif text-xl" translate="no" style={{ color: "var(--sh-text-primary)" }}>{item.candidate.symbol}</p><p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{item.run.holdingPeriod ?? "research"}</p></div>
            <div className="min-w-0"><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{item.thesisName ?? "Capital research play"}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{play.readiness === "ready_to_prepare" ? "Ready to prepare for human approval." : mainBlocker}</p></div>
            <div className="flex items-center gap-2 sm:text-right"><span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{researchCoverageLabel(item.candidate.confidenceScore, openChecks)}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} /></div>
          </button>
          {expanded && <div id={`daily-play-detail-${item.candidate.id}`} className="border-t p-4 sm:p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            {proposalBlockedReason && <div className="mb-3 flex gap-3 rounded-lg border px-3 py-3 text-xs leading-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 42%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))", color: "var(--sh-fg-muted)" }}><CircleSlash2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><div><strong style={{ color: "var(--sh-text-primary)" }}>{item.decisionAuthority !== "authoritative" ? "Research-only · no authoritative receipt" : item.decisionBranch === "cash" ? "Cash · $0 planned risk" : "Conditional · proposal held"}</strong><p className="mt-0.5">{proposalBlockedReason}</p></div></div>}
            <PlayRecipeCard candidate={item.candidate} run={item.run} reviewedChecks={item.reviews.filter((review) => review.status === "reviewed").map((review) => review.checkLabel)} alreadyHeld={false} thesisContext={{ name: item.thesisName, rawText: item.thesisRawText }} proposalBlockedReason={proposalBlockedReason} onReviewEvidence={() => onOpenRun(item.run.id, item.candidate.id, "evidence")} onPrepareProposal={() => onOpenRun(item.run.id, item.candidate.id, "execute")} onOpenResearch={() => onOpenRun(item.run.id, item.candidate.id, "research")} />
            <div className="mt-3 grid gap-3 rounded-lg border p-3 text-xs sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <IntradayTrigger runId={item.run.id} candidateId={item.candidate.id} holdingPeriod={item.run.holdingPeriod} />
              <div><p style={{ color: "var(--sh-fg-muted)" }}>Catalyst window</p><p className="mt-1 font-semibold" style={{ color: "var(--sh-text-primary)" }}>{item.run.catalystDeadlineAt ? <time dateTime={new Date(item.run.catalystDeadlineAt).toISOString()}>{new Date(item.run.catalystDeadlineAt).toLocaleString()}</time> : "Not measured"}</p><p className="mt-1 leading-5" style={{ color: "var(--sh-fg-muted)" }}>The deadline bounds this research path; it does not authorize a trade.</p></div>
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--sh-fg-muted)" }}><kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px]" style={{ borderColor: "var(--sh-border-1)" }}>⌘/Ctrl + Enter</kbd> opens this play’s primary next step. It never records a decision or submits an order.</p>
            <p className="mt-3 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Evidence gate: {item.evidenceSummary}</p>
            <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Not taking this play?</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>A skip retires this play permanently. A defer keeps it out of this session only and returns it at the next regular open. Both are decision data for the weekly scorecard.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><div className="flex-1"><label htmlFor={`skip-reason-${item.candidate.id}`} className="sr-only">Reason for skipping or deferring {item.candidate.symbol}</label><Textarea id={`skip-reason-${item.candidate.id}`} aria-describedby={`skip-reason-help-${item.candidate.id}`} value={reasons[item.candidate.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [item.candidate.id]: event.target.value }))} className="min-h-11 text-xs" placeholder="Why cash, delay, or another play is better today…" /><p id={`skip-reason-help-${item.candidate.id}`} className="mt-1 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{(reasons[item.candidate.id] ?? "").trim().length < 3 ? "Add at least 3 characters to record a skip or defer." : "Reason ready to record."}</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" className="min-h-11" disabled={(reasons[item.candidate.id] ?? "").trim().length < 3 || decide.isPending} onClick={() => setConfirmSkipCandidateId(item.candidate.id)}>Record permanent skip</Button><Button type="button" size="sm" variant="ghost" className="min-h-11" disabled={(reasons[item.candidate.id] ?? "").trim().length < 3 || decide.isPending} onClick={() => decide.mutate({ runId: item.run.id, candidateId: item.candidate.id, decision: "deferred", reason: reasons[item.candidate.id] ?? "" })}>Defer to next session</Button></div></div>{confirmSkipCandidateId === item.candidate.id && <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs"><span className="flex-1" style={{ color: "var(--sh-text-primary)" }}>Confirm permanent skip for {item.candidate.symbol}? It will leave Today and remain in the record.</span><Button type="button" size="sm" className="min-h-11" disabled={decide.isPending} onClick={() => decide.mutate({ runId: item.run.id, candidateId: item.candidate.id, decision: "skipped", reason: reasons[item.candidate.id] ?? "" })}>Confirm skip</Button><Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => setConfirmSkipCandidateId(null)}>Cancel</Button></div>}</div>
          </div>}
        </article>;
      })}
    </div>
    {ranked.length > 3 && <details className="rounded-xl border" style={{ borderColor: "var(--sh-border-1)" }} open={showAllPlays} onToggle={(event) => setShowAllPlays(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Grouped remainder · {ranked.length - 3} candidates</summary><div className="border-t px-4 py-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Open only when you need the long tail. The lead play and two alternatives stay above; evidence depth remains inside each packet.</div></details>}
    <p className="sr-only" aria-live="polite">{decisionAnnouncement}</p>
  </section>;
}
