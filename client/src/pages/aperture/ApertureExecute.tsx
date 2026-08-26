/**
 * Aperture Execute — Phase 2 UI.
 *
 * Three panels in one page:
 *   1. Order Queue — pending_approval orders awaiting human action
 *   2. Monitoring — post-entry catalyst / thesis-invalidation checks
 *   3. Aperture Alpha — the honest product metric
 *
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 * Paper only. No live capital.
 */
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, XCircle, Send, RefreshCw, TrendingUp,
  TrendingDown, Minus, Flag, BarChart3, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { PaperProposalForm } from "@/components/aperture/PaperProposalForm";
import { format, formatDistanceToNow } from "date-fns";

const DISCLAIMER = "Internal research tool — not investment advice. Paper only — no real capital.";

function DisclaimerBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
      style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
      {DISCLAIMER}
    </div>
  );
}

function fmt(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

// ── Order Queue ───────────────────────────────────────────────────────────────

function OrderQueue({ runId }: { runId: number }) {
  const { data: orders, refetch } = trpc.aperture.order.list.useQuery({ runId });
  const approve = trpc.aperture.order.approve.useMutation({
    onSuccess: () => { toast.success("Order approved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const reject = trpc.aperture.order.reject.useMutation({
    onSuccess: () => { toast.success("Order rejected"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = trpc.aperture.order.submit.useMutation({
    onSuccess: () => { toast.success("Order submitted to broker"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const mirror = trpc.aperture.order.mirrorFills.useMutation({
    onSuccess: ({ updated }) => { toast.success(`${updated} fill(s) mirrored`); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const pending = orders?.filter((o) => o.status === "pending_approval") ?? [];
  const approved = orders?.filter((o) => o.status === "approved") ?? [];
  const submitted = orders?.filter((o) => o.status === "submitted") ?? [];
  const terminal = orders?.filter((o) => ["filled", "rejected", "cancelled"].includes(o.status)) ?? [];

  const statusColor = (s: string) => s === "filled" ? "oklch(0.55 0.15 145)" :
    s === "rejected" || s === "cancelled" ? "var(--sh-red)" :
    s === "approved" ? "var(--sh-signal)" : "var(--sh-fg-muted)";
  const statusLabel = (status: string) => ({
    pending_approval: "Waiting for your review",
    approved: "Ready to submit to Alpaca Paper",
    submitted: "Sent to Alpaca Paper",
    filled: "Paper trade executed",
    rejected: "Not approved",
    cancelled: "Cancelled",
  }[status] ?? status.replaceAll("_", " "));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs">
          <span style={{ color: "var(--sh-signal)" }}>{pending.length} waiting for review</span>
          <span style={{ color: "var(--sh-fg-muted)" }}>{approved.length} ready to submit</span>
          <span style={{ color: "var(--sh-fg-muted)" }}>{submitted.length} sent to paper broker</span>
          <span style={{ color: "oklch(0.55 0.15 145)" }}>{terminal.filter((o) => o.status === "filled").length} executed</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => mirror.mutate()} disabled={mirror.isPending}>
          {mirror.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Mirror fills
        </Button>
      </div>

      {orders?.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--sh-fg-muted)" }}>
          No paper orders yet. A reviewed research decision must be translated into an order before it can enter this queue.
        </p>
      )}

      <div className="space-y-2">
        {orders?.map((o) => (
          <Card key={o.id}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm" style={{ color: "var(--sh-text-primary)" }}>{o.symbol}</span>
                  <Badge variant="outline" className="text-xs" style={{ color: o.side === "buy" ? "oklch(0.55 0.15 145)" : "var(--sh-red)" }}>
                    {o.side.toUpperCase()}
                  </Badge>
                  <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                    {o.qty ? `${o.qty} shares` : fmt(o.notionalCents)} · {o.orderType} · {o.timeInForce}
                  </span>
                  <Badge variant="outline" className="text-xs" style={{ color: statusColor(o.status) }}>
                    {statusLabel(o.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {o.status === "filled" && o.filledAvgPriceCents && (
                    <span className="text-xs" style={{ color: "oklch(0.55 0.15 145)" }}>
                      filled @ {fmt(o.filledAvgPriceCents)}/sh
                    </span>
                  )}
                  {o.status === "pending_approval" && (
                    <>
                      <Button size="sm" className="h-7 text-xs" onClick={() => approve.mutate({ orderId: o.id })} disabled={approve.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve proposal
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => reject.mutate({ orderId: o.id })} disabled={reject.isPending}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Do not approve
                      </Button>
                    </>
                  )}
                  {o.status === "approved" && (
                    <Button size="sm" className="h-7 text-xs" onClick={() => submit.mutate({ orderId: o.id })} disabled={submit.isPending}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Send to Alpaca Paper
                    </Button>
                  )}
                  <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                    {formatDistanceToNow(o.createdAt)} ago
                  </span>
                </div>
              </div>
              {o.rejectionReason && (
                <p className="text-xs mt-1" style={{ color: "var(--sh-red)" }}>Reason: {o.rejectionReason}</p>
              )}
              {o.dispatchError && (
                <p className="mt-2 rounded border px-3 py-2 text-xs leading-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 45%, var(--sh-border-1))", color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>Broker response unresolved.</strong> The stable paper-order ID is being reconciled. Do not submit another order or change this mission disposition yet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Monitoring Panel ──────────────────────────────────────────────────────────

function MonitoringPanel({ runId }: { runId: number }) {
  const { data: checks, refetch } = trpc.aperture.monitor.list.useQuery({ runId });
  const { data: flagged } = trpc.aperture.monitor.flagged.useQuery({ runId });
  const runCheck = trpc.aperture.monitor.run.useMutation({
    onSuccess: (results) => {
      const flaggedCount = results.filter((r) => r.flagged).length;
      toast.success(`${results.length} checks run, ${flaggedCount} flagged`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const checkTypeColor = (t: string) => t === "thesis_invalidation" ? "var(--sh-red)" :
    t === "catalyst" ? "oklch(0.55 0.15 145)" :
    t === "earnings" ? "var(--sh-signal)" : "var(--sh-fg-muted)";

  return (
    <div className="space-y-4">
      {flagged && flagged.length > 0 && (
        <div className="p-3 rounded-lg" style={{ background: "oklch(0.97 0.02 30)", border: "1px solid var(--sh-signal)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Flag className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--sh-signal)" }}>
              {flagged.length} flagged check{flagged.length !== 1 ? "s" : ""} require operator review
            </span>
          </div>
          {flagged.slice(0, 3).map((c) => (
            <p key={c.id} className="text-xs ml-6" style={{ color: "var(--sh-text-primary)" }}>
              <span className="font-mono">{c.symbol}</span> · {c.checkType.replace("_", " ")} · {c.finding}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {checks?.map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold" style={{ color: "var(--sh-text-primary)" }}>{c.symbol}</span>
                    <Badge variant="outline" className="text-xs" style={{ color: checkTypeColor(c.checkType) }}>
                      {c.checkType.replace("_", " ")}
                    </Badge>
                    {c.flagged && <Flag className="h-3.5 w-3.5" style={{ color: "var(--sh-signal)" }} />}
                  </div>
                  <p className="text-xs" style={{ color: c.flagged ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>
                    {c.finding ?? "No finding."}
                  </p>
                  {(c.citations as string[])?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(c.citations as string[]).slice(0, 2).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs underline" style={{ color: "var(--sh-signal)" }}>
                          [{i + 1}]
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs shrink-0" style={{ color: "var(--sh-fg-muted)" }}>
                  {formatDistanceToNow(c.checkedAt)} ago
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {checks?.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: "var(--sh-fg-muted)" }}>
              No monitoring checks yet. Add a reviewed paper position, then use this surface to challenge its catalyst and invalidation conditions.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Alpha Dashboard ───────────────────────────────────────────────────────────
//
// The pilot scorecard, rendered as an evidence document rather than a wall of
// tiles. Order is the argument:
//
//   1. what this run can actually claim (sample sufficiency leads)
//   2. the horizon the figures cover
//   3. process metrics, or return metrics — whichever the sample supports
//   4. the operator's filter on the system's candidates
//   5. the slippage assumption, permanently attached to every P&L figure
//
// Every field on aperture_alpha is nullable: rows computed before the scorecard
// migration carry null. Null renders as an explicit "not measured" — never 0,
// never a bare dash.

const NOT_MEASURED = "not measured";

const SUFFICIENCY_LABEL: Record<string, string> = {
  process_only: "process only",
  indicative: "indicative",
  edge_capable: "edge capable",
};

const HOLDING_LABEL: Record<string, string> = {
  intraday: "intraday",
  overnight: "overnight",
  swing: "swing",
  catalyst_window: "catalyst window",
};

const BASELINE_LABEL: Record<string, string> = {
  human_intended: "the operator's own plan",
  cash_only: "holding cash",
};

/** Signed currency. Sign is the only thing carrying colour in the return ledger. */
function fmtSigned(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  const sign = cents > 0 ? "+" : cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtBps(bps: number | null | undefined): string | null {
  if (bps == null) return null;
  const sign = bps > 0 ? "+" : bps < 0 ? "-" : "";
  return `${sign}${(Math.abs(bps) / 100).toFixed(2)}%`;
}

function fmtCount(n: number | null | undefined): string | null {
  return n == null ? null : String(n);
}

function fmtDay(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  try {
    return format(ms, "d MMM");
  } catch {
    return null;
  }
}

const signColor = (v: number | null | undefined) =>
  v == null || v === 0 ? "var(--sh-fg-muted)" : v > 0 ? "var(--sh-emerald)" : "var(--sh-red)";

/** Section rule — a hairline label, not a card header. */
function LedgerHead({ label, aside }: { label: string; aside?: React.ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-1"
      style={{ borderColor: "var(--sh-border-1)" }}
    >
      <span
        className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em]"
        style={{ color: "var(--sh-fg-muted)" }}
      >
        {label}
      </span>
      {aside}
    </div>
  );
}

/**
 * One tight ledger line: label left, figure right-aligned in tabular monospace.
 * `value === null` means the server did not send the field, and the line says so.
 */
function Line({
  label,
  value,
  unit,
  color,
  note,
}: {
  label: string;
  value: string | null;
  unit?: string;
  color?: string;
  note?: string | null;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 border-b py-1"
      style={{ borderColor: "var(--sh-border-1)" }}
    >
      <div className="min-w-0 flex-1">
        <span className="text-xs" style={{ color: "var(--sh-text-primary)" }}>
          {label}
        </span>
        {note && (
          <span className="ml-2 text-[0.68rem]" style={{ color: "var(--sh-fg-muted)" }}>
            {note}
          </span>
        )}
      </div>
      <div className="shrink-0 whitespace-nowrap text-right">
        {value == null ? (
          <span className="text-[0.7rem] italic" style={{ color: "var(--sh-fg-muted)" }}>
            {NOT_MEASURED}
          </span>
        ) : (
          <>
            <span
              className="font-mono text-sm font-semibold tabular-nums"
              style={{ color: color ?? "var(--sh-text-primary)" }}
            >
              {value}
            </span>
            {unit && (
              <span className="ml-1 font-mono text-[0.65rem]" style={{ color: "var(--sh-fg-muted)" }}>
                {unit}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** A declared gap or a source note. Prose under a ledger, never a tooltip. */
function Note({ text, tone = "neutral" }: { text: string | null | undefined; tone?: "neutral" | "gap" }) {
  if (!text) {
    return (
      <p className="mt-1.5 text-[0.68rem] italic leading-5" style={{ color: "var(--sh-fg-muted)" }}>
        {NOT_MEASURED} — this run carries no note for this field.
      </p>
    );
  }
  return (
    <p
      className="mt-1.5 text-[0.68rem] leading-5"
      style={{
        color: tone === "gap" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)",
        borderLeft: tone === "gap" ? "2px solid var(--sh-signal)" : undefined,
        paddingLeft: tone === "gap" ? "0.5rem" : undefined,
      }}
    >
      {text}
    </p>
  );
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em]"
      style={{ color, borderColor: color }}
    >
      {text}
    </span>
  );
}

function AlphaDashboard({ runId }: { runId: number }) {
  const { data: alpha, refetch } = trpc.aperture.alpha.get.useQuery({ runId });
  const { data: dailyPlays } = trpc.aperture.play.list.useQuery();
  const compute = trpc.aperture.alpha.compute.useMutation({
    onSuccess: () => { toast.success("Alpha metric refreshed"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const recordedDecisions = (dailyPlays?.plays ?? []).filter((play) => play.run.id === runId && play.decision);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>Aperture Alpha</h3>
          <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
            Honest product metric — measured from real paper outcomes, never asserted.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => compute.mutate({ runId })} disabled={compute.isPending}>
          {compute.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Recompute
        </Button>
      </div>

      {!alpha ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>
              No alpha data yet. Click Recompute after orders are filled.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Scorecard alpha={alpha} />
      )}
      <section className="space-y-2 rounded-lg border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
        <LedgerHead label="Recorded trader decisions · selectivity is part of the process" />
        {recordedDecisions.length ? <div className="mt-2 space-y-2">{recordedDecisions.map((play) => <div key={play.decision!.id} className="rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><span className="font-mono font-semibold" style={{ color: "var(--sh-text-primary)" }}>{play.candidate.symbol}</span><span className="ml-2 uppercase tracking-[0.1em]" style={{ color: "var(--sh-signal)" }}>{play.decision!.decision}</span><p className="mt-1 leading-5" style={{ color: "var(--sh-fg-muted)" }}>{play.decision!.reason}</p></div>)}</div> : <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>No skip or defer was recorded for this run. This is not evidence that every surfaced play was actionable; it only means no trader decision was saved.</p>}
      </section>
    </div>
  );
}

type AlphaRow = NonNullable<inferRouterOutputs<AppRouter>["aperture"]["alpha"]["get"]>;

function Scorecard({ alpha }: { alpha: AlphaRow }) {
  const sufficiency = alpha.sampleSufficiency ?? null;
  // Null sufficiency is treated the same as process_only: an unrecorded sample
  // size cannot license a return headline.
  const returnMayLead = sufficiency === "indicative" || sufficiency === "edge_capable";

  const sufficiencyColor =
    sufficiency === "edge_capable" ? "var(--sh-emerald)"
      : sufficiency === "indicative" ? "var(--sh-signal)"
      : "var(--sh-fg-muted)";

  const basisColor =
    alpha.metricBasis === "verified" ? "var(--sh-emerald)"
      : alpha.metricBasis === "mixed" ? "var(--sh-signal)"
      : "var(--sh-fg-muted)";

  const benchmarkColor =
    alpha.benchmarkBasis === "verified" ? "var(--sh-emerald)"
      : alpha.benchmarkBasis === "modeled" ? "var(--sh-signal)"
      : "var(--sh-fg-muted)";

  // ── Horizon strip ──────────────────────────────────────────────────────────
  const horizonParts: string[] = [];
  if (alpha.horizonDays != null) {
    horizonParts.push(`over ${alpha.horizonDays.toFixed(alpha.horizonDays < 10 ? 1 : 0)} days`);
  }
  if (alpha.holdingPeriod) horizonParts.push(HOLDING_LABEL[alpha.holdingPeriod] ?? alpha.holdingPeriod);
  const startDay = fmtDay(alpha.horizonStartAt);
  const endDay = fmtDay(alpha.horizonEndAt);
  if (startDay && endDay) horizonParts.push(`${startDay} → ${endDay}`);

  const returnLedger = (
    <section>
      <LedgerHead
        label={returnMayLead ? "Return · measured against" : "Return · secondary at this sample size"}
        aside={<Chip text={`${alpha.metricBasis} basis`} color={basisColor} />}
      />
      {!returnMayLead && (
        <p className="mt-1.5 text-[0.68rem] leading-5" style={{ color: "var(--sh-fg-muted)" }}>
          Shown for completeness. At this sample size these figures are not the finding — the process
          ledger above is.
        </p>
      )}
      <div className="mt-1">
        <Line
          label="System P&L"
          note="system-added positions, human-filtered"
          value={fmtSigned(alpha.systemPnlCents)}
          color={signColor(alpha.systemPnlCents)}
        />
        <Line
          label="Human P&L"
          note="operator's intended positions"
          value={fmtSigned(alpha.humanPnlCents)}
          color={signColor(alpha.humanPnlCents)}
        />
        <Line
          label="Baseline"
          note={alpha.baselineKind ? BASELINE_LABEL[alpha.baselineKind] ?? alpha.baselineKind : undefined}
          value={fmtSigned(alpha.baselinePnlCents)}
          color={signColor(alpha.baselinePnlCents)}
        />
        <Line
          label="Benchmark"
          note={alpha.benchmarkSymbol ?? "no symbol declared"}
          value={fmtBps(alpha.benchmarkReturnBps)}
          color={signColor(alpha.benchmarkReturnBps)}
          unit={alpha.benchmarkBasis ?? undefined}
        />
      </div>
      <Note text={alpha.baselineNote} />
      <Note
        text={alpha.benchmarkNote}
        tone={alpha.benchmarkBasis == null || alpha.benchmarkBasis === "unknown" ? "gap" : "neutral"}
      />
    </section>
  );

  const selectionFilter = (
    <section>
      <LedgerHead label="Operator filter · what reached a fill" />
      <div className="mt-1">
        <Line label="System candidates surfaced" value={fmtCount(alpha.systemSurfacedCount)} />
        <Line label="Approved and filled" value={fmtCount(alpha.systemFilledCount)} />
        <Line label="Declined by operator" value={fmtCount(alpha.systemDeclinedCount)} />
      </div>
      <Note text={alpha.selectionBiasNote} tone="gap" />
    </section>
  );

  const processLedger = (
    <section>
      <LedgerHead label="Process · aperture width, concentration, guardrails" />
      <div className="mt-1">
        <Line
          label="Human opportunity set"
          note="symbols the operator intended"
          value={fmtCount(alpha.humanOpportunitySetCount)}
        />
        <Line
          label="System added"
          note="candidates beyond the plan"
          value={fmtCount(alpha.systemAddedCount)}
        />
        <Line
          label="Concentration before → after"
          note="HHI, lower is wider"
          value={
            alpha.hhiBefore != null && alpha.hhiAfter != null
              ? `${alpha.hhiBefore.toFixed(3)} → ${alpha.hhiAfter.toFixed(3)}`
              : null
          }
          color={
            alpha.hhiBefore != null && alpha.hhiAfter != null && alpha.hhiAfter < alpha.hhiBefore
              ? "var(--sh-emerald)"
              : undefined
          }
        />
        <Line
          label="Max drawdown"
          note="full aperture portfolio"
          value={alpha.maxDrawdownBps != null ? `${(alpha.maxDrawdownBps / 100).toFixed(1)}%` : null}
          color={alpha.maxDrawdownBps != null && alpha.maxDrawdownBps > 0 ? "var(--sh-red)" : undefined}
        />
        <Line
          label="Capital utilization"
          note="deployed / deployable"
          value={alpha.capitalUtilizationPct != null ? fmtPct(alpha.capitalUtilizationPct) : null}
        />
        <Line label="Filled orders" value={fmtCount(alpha.filledOrderCount)} />
        <Line label="Closed trades" note="exits only — an open position is not yet right or wrong" value={fmtCount(alpha.closedTradeCount)} />
      </div>
    </section>
  );

  return (
    <div className="space-y-5">
      {/* 1 ── The claim the data can carry. Everything else is subordinate. */}
      <section
        className="rounded-lg border p-3"
        style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--sh-fg-muted)" }}
          >
            What this run can claim
          </span>
          <Chip
            text={sufficiency ? SUFFICIENCY_LABEL[sufficiency] ?? sufficiency : NOT_MEASURED}
            color={sufficiencyColor}
          />
        </div>
        {alpha.sampleNote ? (
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-text-primary)" }}>
            {alpha.sampleNote}
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 italic" style={{ color: "var(--sh-fg-muted)" }}>
            Sample sufficiency {NOT_MEASURED} for this run — it was computed before the pilot
            scorecard existed. Recompute to record it. Until then no claim, process or edge, is
            supported by this panel.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.68rem] tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>
          <span>
            closed trades{" "}
            <span style={{ color: alpha.closedTradeCount == null ? undefined : "var(--sh-text-primary)" }}>
              {fmtCount(alpha.closedTradeCount) ?? NOT_MEASURED}
            </span>
          </span>
          <span>
            filled orders{" "}
            <span style={{ color: alpha.filledOrderCount == null ? undefined : "var(--sh-text-primary)" }}>
              {fmtCount(alpha.filledOrderCount) ?? NOT_MEASURED}
            </span>
          </span>
        </div>
      </section>

      {/* 2 ── The window the figures cover. */}
      <section>
        <LedgerHead label="Horizon" />
        <p className="mt-1 font-mono text-xs tabular-nums" style={{ color: "var(--sh-text-primary)" }}>
          {horizonParts.length > 0 ? (
            horizonParts.join(" · ")
          ) : (
            <span className="italic" style={{ color: "var(--sh-fg-muted)" }}>
              {NOT_MEASURED} — no horizon was recorded, so every figure below is undated.
            </span>
          )}
        </p>
      </section>

      {/* 3 ── Process leads unless the sample can support a return claim. */}
      {returnMayLead ? (
        <>
          {returnLedger}
          {selectionFilter}
          {processLedger}
        </>
      ) : (
        <>
          {processLedger}
          {returnLedger}
          {selectionFilter}
        </>
      )}

      {/* 4 ── The slippage assumption travels with the P&L. Not a tooltip. */}
      <section
        className="rounded-lg border p-3"
        style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
          <div className="min-w-0">
            <p
              className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--sh-fg-muted)" }}
            >
              Slippage assumption — applies to every P&L figure above
            </p>
            <p className="mt-1 text-[0.7rem] leading-5" style={{ color: "var(--sh-text-primary)" }}>
              {alpha.slippageAssumption ?? (
                <span className="italic" style={{ color: "var(--sh-fg-muted)" }}>
                  {NOT_MEASURED} — no slippage assumption is recorded for this run, so the P&L above
                  carries no stated execution basis.
                </span>
              )}
            </p>
          </div>
        </div>
      </section>

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.65rem]"
        style={{ color: "var(--sh-fg-muted)" }}
      >
        <Chip text={`${alpha.metricBasis} basis`} color={basisColor} />
        <Chip
          text={alpha.benchmarkBasis ? `benchmark ${alpha.benchmarkBasis}` : `benchmark ${NOT_MEASURED}`}
          color={benchmarkColor}
        />
        <span>
          {alpha.lastComputedAt
            ? `last computed ${formatDistanceToNow(alpha.lastComputedAt)} ago`
            : `last computed ${NOT_MEASURED}`}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApertureExecute() {
  const [, params] = useRoute("/aperture/run/:id/execute");
  const runId = Number(params?.id);
  const [, navigate] = useLocation();

  const { data } = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });
  const run = data?.run;
  const candidateId = Number(new URLSearchParams(window.location.search).get("candidate"));
  const proposalCandidate = Number.isFinite(candidateId) && candidateId > 0 ? data?.candidates.find((candidate) => candidate.id === candidateId) : undefined;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <DisclaimerBanner />

        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(`/aperture/run/${runId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>
              Decision follow-through
            </h1>
          </div>
          {run && (
            <p className="text-sm mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>
              Run #{runId} · Paper-only follow-through after evidence and posture review
            </p>
          )}
        </div>

        {data?.brief && (
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Current human decision</p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>{data.brief.nextDecision.title}</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{data.brief.nextDecision.detail}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/aperture/run/${runId}`)}>Return to decision brief</Button>
            </div>
          </div>
        )}

        {proposalCandidate && <PaperProposalForm runId={runId} candidate={proposalCandidate} account={data?.paperContext?.account} run={run} onReturnToBrief={() => navigate(`/aperture/run/${runId}?view=evidence`)} onProposalCreated={() => navigate(`/aperture/run/${runId}/execute`)} />}

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Paper order review</TabsTrigger>
            <TabsTrigger value="monitoring">Thesis monitoring</TabsTrigger>
            <TabsTrigger value="alpha">Measured outcomes</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-4">
            <OrderQueue runId={runId} />
          </TabsContent>
          <TabsContent value="monitoring" className="mt-4">
            <MonitoringPanel runId={runId} />
          </TabsContent>
          <TabsContent value="alpha" className="mt-4">
            <AlphaDashboard runId={runId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
