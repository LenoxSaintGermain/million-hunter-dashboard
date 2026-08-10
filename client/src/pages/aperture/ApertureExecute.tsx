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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, CheckCircle2, XCircle, Send, RefreshCw, TrendingUp,
  TrendingDown, Minus, Flag, BarChart3, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDistanceToNow } from "date-fns";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs">
          <span style={{ color: "var(--sh-signal)" }}>{pending.length} pending approval</span>
          <span style={{ color: "var(--sh-fg-muted)" }}>{approved.length} approved</span>
          <span style={{ color: "var(--sh-fg-muted)" }}>{submitted.length} submitted</span>
          <span style={{ color: "oklch(0.55 0.15 145)" }}>{terminal.filter((o) => o.status === "filled").length} filled</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => mirror.mutate()} disabled={mirror.isPending}>
          {mirror.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Mirror fills
        </Button>
      </div>

      {orders?.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--sh-fg-muted)" }}>
          No orders yet. Generate orders from the Candidate Board.
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
                    {o.status}
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
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => reject.mutate({ orderId: o.id })} disabled={reject.isPending}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {o.status === "approved" && (
                    <Button size="sm" className="h-7 text-xs" onClick={() => submit.mutate({ orderId: o.id })} disabled={submit.isPending}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Submit to broker
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
            No monitoring checks yet. Run checks from the Candidate Board.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Alpha Dashboard ───────────────────────────────────────────────────────────

function AlphaDashboard({ runId }: { runId: number }) {
  const { data: alpha, refetch } = trpc.aperture.alpha.get.useQuery({ runId });
  const compute = trpc.aperture.alpha.compute.useMutation({
    onSuccess: () => { toast.success("Alpha metric refreshed"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const pnlColor = (v: number | null | undefined) => v == null ? "var(--sh-fg-muted)" :
    v > 0 ? "oklch(0.55 0.15 145)" : v < 0 ? "var(--sh-red)" : "var(--sh-fg-muted)";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
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
        <>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" style={{ color: alpha.metricBasis === "verified" ? "oklch(0.55 0.15 145)" : "var(--sh-signal)" }}>
              {alpha.metricBasis} basis
            </Badge>
            {alpha.lastComputedAt && (
              <span style={{ color: "var(--sh-fg-muted)" }}>
                Last computed {formatDistanceToNow(alpha.lastComputedAt)} ago
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard
              label="Human Opportunity Set"
              value={String(alpha.humanOpportunitySetCount)}
              sub="symbols you intended to trade"
            />
            <MetricCard
              label="System Added"
              value={String(alpha.systemAddedCount)}
              sub="candidates beyond your plan"
              highlight={alpha.systemAddedCount > 0}
            />
            <MetricCard
              label="System Filled"
              value={String(alpha.systemFilledCount)}
              sub="system candidates you approved"
              highlight={alpha.systemFilledCount > 0}
            />
            <MetricCard
              label="Human P&L"
              value={fmt(alpha.humanPnlCents)}
              sub="intended positions (paper)"
              color={pnlColor(alpha.humanPnlCents)}
            />
            <MetricCard
              label="System P&L"
              value={fmt(alpha.systemPnlCents)}
              sub="system-added positions (paper)"
              color={pnlColor(alpha.systemPnlCents)}
            />
            <MetricCard
              label="Max Drawdown"
              value={alpha.maxDrawdownBps != null ? `${(alpha.maxDrawdownBps / 100).toFixed(1)}%` : "—"}
              sub="full aperture portfolio"
            />
            <MetricCard
              label="HHI Before"
              value={alpha.hhiBefore != null ? alpha.hhiBefore.toFixed(3) : "—"}
              sub="concentration (human plan)"
            />
            <MetricCard
              label="HHI After"
              value={alpha.hhiAfter != null ? alpha.hhiAfter.toFixed(3) : "—"}
              sub="concentration (with system)"
              highlight={alpha.hhiAfter != null && alpha.hhiBefore != null && alpha.hhiAfter < alpha.hhiBefore}
            />
            <MetricCard
              label="Capital Utilization"
              value={fmtPct(alpha.capitalUtilizationPct)}
              sub="deployed / deployable"
            />
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label, value, sub, highlight = false, color,
}: {
  label: string; value: string; sub: string; highlight?: boolean; color?: string;
}) {
  return (
    <Card style={highlight ? { borderColor: "oklch(0.55 0.15 145)" } : undefined}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs mb-1" style={{ color: "var(--sh-fg-muted)" }}>{label}</p>
        <p className="text-2xl font-bold tabular-nums" style={{ color: color ?? "var(--sh-text-primary)" }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>{sub}</p>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApertureExecute() {
  const [, params] = useRoute("/aperture/run/:id/execute");
  const runId = Number(params?.id);

  const { data } = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });
  const run = data?.run;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <DisclaimerBanner />

        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>
            Run #{runId} · Execute & Monitor
          </h1>
          {run && (
            <p className="text-sm mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>
              Status: {run.status} · {run.candidateCount ?? "—"} candidates
            </p>
          )}
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Order Queue</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="alpha">Aperture Alpha</TabsTrigger>
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
