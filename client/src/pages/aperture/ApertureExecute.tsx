/**
 * Aperture Execute — Phase 2 UI.
 *
 * Three lifecycle panels in one page:
 *   1. Paper ticket — pending_approval orders awaiting human action
 *   2. Check whether thesis still holds — post-entry catalyst / thesis-invalidation checks
 *   3. Outcome & notes — the honest product metric and decision record
 *
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 * Paper only. No live capital.
 */
import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { useRoute, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, XCircle, Send, RefreshCw, TrendingUp,
  TrendingDown, Minus, Flag, BarChart3, Loader2, Sparkles, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MonitoringFindingCard } from "@/components/aperture/MonitoringFindingCard";
import { MonitoringFindingReview, revealMonitoringFinding } from "@/components/aperture/MonitoringFindingReview";
import { monitoringFindingHref, monitoringFindingVersion, parseMonitoringFindingSelection, selectMonitoringFinding, resolvedFindingVersions, isFindingResolved, type MonitoringFindingRoute, type VersionedMonitoringFinding } from "@shared/monitoringFinding";
import { PaperProposalForm } from "@/components/aperture/PaperProposalForm";
import { ManualOrderTicketModal } from "@/components/aperture/ManualOrderTicketModal";
import { PositionSummaryBar } from "@/components/aperture/PositionSummaryBar";
import { TacticalFlankRadar } from "@/components/aperture/TacticalFlankRadar";
import { PositionExitModal, type ExitTarget } from "@/components/aperture/PositionExitModal";
import { DecisionStepLock, decisionAuthorityAllowsDownstream } from "@/components/aperture/DecisionStepLock";
import { format, formatDistanceToNow } from "date-fns";
import { normalizeStringList } from "@shared/stringList";
import { getEvidenceReviewReadiness } from "@shared/evidenceReview";
import { monitoringFindingPresentation, monitoringReviewState, partitionMonitoringHistory } from "@shared/monitoringState";
import { isOptionInstrument, paperInstrumentLabel } from "@shared/paperInstrument";

const DISCLAIMER = "Internal research tool — not investment advice. Paper only — no real capital.";

function DisclaimerBanner() {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium leading-5 sm:items-center sm:px-4"
      style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0" style={{ color: "var(--sh-signal)" }} />
      <span className="min-w-0">{DISCLAIMER}</span>
    </div>
  );
}

function fmt(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function orderInstrumentLabel(order: {
  symbol: string;
  instrumentType?: "shares" | "long_call" | "long_put" | null;
  underlyingSymbol?: string | null;
  optionExpirationDate?: string | null;
  optionStrikePriceCents?: number | null;
}): string {
  return paperInstrumentLabel({
    symbol: order.symbol,
    instrumentType: order.instrumentType ?? "shares",
    underlyingSymbol: order.underlyingSymbol,
    optionExpirationDate: order.optionExpirationDate,
    optionStrikePriceCents: order.optionStrikePriceCents,
  });
}

function orderSizeLabel(order: { instrumentType?: string | null; qty?: number | null; notionalCents?: number | null }): string {
  if (order.qty != null) {
    const unit = isOptionInstrument(order.instrumentType) ? (order.qty === 1 ? "contract" : "contracts") : (order.qty === 1 ? "share" : "shares");
    return `${order.qty} ${unit}`;
  }
  return fmt(order.notionalCents);
}

// ── Order Queue ───────────────────────────────────────────────────────────────

function OrderQueue({ runId, focusCandidateId, requestedOrderId, ticketBuilderActive = false }: { runId: number; focusCandidateId?: number; requestedOrderId?: number | null; ticketBuilderActive?: boolean }) {
  type Order = NonNullable<inferRouterOutputs<AppRouter>["aperture"]["order"]["list"]>[number];
  const [, navigate] = useLocation();
  const search = useSearch();
  const targetHighlightId = requestedOrderId ?? Number(new URLSearchParams(search).get("order") || 0);
  const [confirmation, setConfirmation] = useState<{ kind: "approve" | "submit"; order: Order } | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [rejection, setRejection] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [gateError, setGateError] = useState<{ orderId: number; title: string; violations: string[] } | null>(null);
  const { data: orders, refetch } = trpc.aperture.order.list.useQuery({ runId });

  const handleOrderError = (orderId: number, e: { message?: string }) => {
    const rawMsg = e.message || "Order action failed";
    const clean = rawMsg.replace(/^order blocked by the mandate:\s*/i, "").trim();
    const violations = clean.split(";").map((s) => s.trim()).filter(Boolean);
    if (violations.length > 1 || rawMsg.toLowerCase().includes("mandate") || rawMsg.toLowerCase().includes("gate")) {
      toast.error("Trade requires review. Check safety suggestions below.");
      setGateError({ orderId, title: "Trade Safety Check: Suggested Adjustments", violations });
    } else {
      toast.error(rawMsg);
      setGateError({ orderId, title: "Action Needs Review", violations: [rawMsg] });
    }
  };

  const approve = trpc.aperture.order.approve.useMutation({
    onSuccess: () => { toast.success("Order approved"); setGateError(null); refetch(); },
    onError: (e, variables) => handleOrderError(variables.orderId, e),
  });
  const reject = trpc.aperture.order.reject.useMutation({
    onSuccess: () => { toast.success("Order rejected"); setGateError(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = trpc.aperture.order.submit.useMutation({
    onSuccess: () => { toast.success("Paper order accepted or queued by the broker"); setGateError(null); refetch(); },
    onError: (e, variables) => handleOrderError(variables.orderId, e),
  });
  const mirror = trpc.aperture.order.mirrorFills.useMutation({
    onSuccess: ({ updated }) => { toast.success(`${updated} fill(s) mirrored`); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const scopedOrders = focusCandidateId == null ? (orders ?? []) : (orders ?? []).filter((order) => order.candidateId === focusCandidateId);
  const otherRunOrders = focusCandidateId == null ? [] : (orders ?? []).filter((order) => order.candidateId !== focusCandidateId);
  const pending = scopedOrders.filter((o) => o.status === "pending_approval");
  const approved = scopedOrders.filter((o) => o.status === "approved");
  const submitted = scopedOrders.filter((o) => o.status === "submitted");
  const terminal = scopedOrders.filter((o) => ["filled", "rejected", "cancelled"].includes(o.status));
  const nextAction = ticketBuilderActive
    ? "No ticket created yet. Choose your setup and sizing terms above to build a paper trade."
    : pending.length
    ? "Step 1 of 2: Review and Approve your simulated trade. Once approved, you can send it to your paper broker."
    : approved.length
      ? "Step 2 of 2: Review the named paper destination, then explicitly send the order. Current checks must pass."
      : submitted.length
        ? "Paper broker accepted the order; no complete fill is recorded yet. Check order status before taking another action."
        : terminal.some((order) => order.status === "filled")
          ? "Position is open. Track your play and review whether your thesis holds."
          : "Ready for your next play. Pick a candidate from your research to prepare a paper trade.";

  const statusColor = (s: string) => s === "filled" ? "oklch(0.55 0.15 145)" :
    s === "rejected" || s === "cancelled" ? "var(--sh-red)" :
    s === "approved" ? "var(--sh-signal)" : "var(--sh-fg-muted)";
  const statusLabel = (status: string) => ({
    pending_approval: "Waiting for your review",
    approved: "Ready to submit to the named paper account",
    submitted: "Accepted / queued at paper broker",
    filled: "Paper trade executed",
    rejected: "Not approved",
    cancelled: "Cancelled",
  }[status] ?? status.replaceAll("_", " "));
  const requiredConfirmation = confirmation?.kind === "submit" ? "SUBMIT PAPER" : "APPROVE PAPER";
  const confirmAction = () => {
    if (!confirmation || confirmationText !== requiredConfirmation) return;
    const targetOrder = confirmation.order;
    if (confirmation.kind === "approve") {
      approve.mutate(
        { orderId: targetOrder.id, paperConfirmation: "APPROVE PAPER" },
        {
          onSuccess: () => {
            setConfirmation(null);
            setConfirmationText("");
          },
        }
      );
    } else {
      submit.mutate(
        { orderId: targetOrder.id, paperConfirmation: "SUBMIT PAPER" },
        {
          onSuccess: () => {
            setConfirmation(null);
            setConfirmationText("");
          },
        }
      );
    }
  };

  return (
    <div className="space-y-4">
      <div role="status" className="rounded-lg border px-4 py-3 text-sm leading-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 38%, var(--sh-border-1))", background: "var(--sh-surface-2)", color: "var(--sh-text-primary)" }}><strong>Next:</strong> {nextAction}</div>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-xs sm:flex sm:flex-wrap" aria-label="Paper ticket status summary">
          <span className="min-w-0" style={{ color: "var(--sh-signal)" }}>{pending.length} waiting for review</span>
          <span className="min-w-0" style={{ color: "var(--sh-fg-muted)" }}>{approved.length} ready to submit</span>
          <span className="min-w-0" style={{ color: "var(--sh-fg-muted)" }}>{submitted.length} accepted / queued</span>
          <span className="min-w-0" style={{ color: "oklch(0.55 0.15 145)" }}>{terminal.filter((o) => o.status === "filled").length} executed</span>
        </div>
        <Button variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => mirror.mutate()} disabled={mirror.isPending}>
          {mirror.isPending ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 mr-1" />}
          Mirror fills
        </Button>
      </div>

      {scopedOrders.length === 0 && (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>
             {ticketBuilderActive
               ? "No paper proposal yet. Follow the guarded action above; proposal, approval, and paper submission remain separate steps."
               : "No paper orders yet. A reviewed research decision must be translated into an order before it can enter this queue."}
          </p>
          <Button
            type="button"
            className="min-h-11 font-semibold"
            onClick={() => setManualModalOpen(true)}
          >
            + Stage Discretionary Paper Ticket
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {scopedOrders.map((o) => {
          const isTargetTicket = Boolean(targetHighlightId && o.id === targetHighlightId);
          return (
            <Card
              key={o.id}
              ref={isTargetTicket ? (el) => el?.scrollIntoView({ behavior: "smooth", block: "center" }) : undefined}
              className={`min-w-0 overflow-hidden transition-all duration-300 ${isTargetTicket ? "ring-2 ring-[var(--sh-signal)] shadow-md" : ""}`}
              style={isTargetTicket ? { borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))" } : undefined}
            >
              <CardContent className="min-w-0 pb-3 pt-3">
                {isTargetTicket && (
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--sh-signal)" }}>
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>Target Staged Ticket</span>
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                    <span className="min-w-0 break-words font-mono text-sm font-bold" style={{ color: "var(--sh-text-primary)" }}>{orderInstrumentLabel(o)}</span>
                    <Badge variant="outline" className="text-xs" style={{ color: o.side === "buy" ? "oklch(0.55 0.15 145)" : "var(--sh-red)" }}>
                      {o.side.toUpperCase()}
                    </Badge>
                    <span className="min-w-0 basis-full break-words text-xs sm:basis-auto" style={{ color: "var(--sh-fg-muted)" }}>
                      {orderSizeLabel(o)} · {o.orderType} · {o.timeInForce}
                    </span>
                    <Badge variant="outline" className="max-w-full whitespace-normal text-left text-xs" style={{ color: statusColor(o.status) }}>
                      {statusLabel(o.status)}
                    </Badge>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                    {o.status === "filled" && o.filledAvgPriceCents && (
                      <span className="text-xs tabular-nums" style={{ color: "oklch(0.55 0.15 145)" }}>
                        filled @ {fmtPrice(o.filledAvgPriceCents)}{isOptionInstrument(o.instrumentType) ? " premium" : "/share"}
                      </span>
                    )}
                    {o.status === "pending_approval" && (
                      <>
                        <Button size="sm" className="min-h-11 w-full text-xs sm:w-auto" onClick={() => { setConfirmation({ kind: "approve", order: o }); setConfirmationText("APPROVE PAPER"); }} disabled={approve.isPending}>
                          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 mr-1" /> Approve paper ticket
                        </Button>
                        <Button variant="outline" size="sm" className="min-h-11 w-full text-xs sm:w-auto" onClick={() => { setRejection(o); setRejectionReason(""); }} disabled={reject.isPending}>
                          <XCircle aria-hidden="true" className="h-3.5 w-3.5 mr-1" /> Pass on this trade
                        </Button>
                      </>
                    )}
                    {o.status === "approved" && (
                      <Button size="sm" className="min-h-11 w-full text-xs sm:w-auto" onClick={() => { setConfirmation({ kind: "submit", order: o }); setConfirmationText("SUBMIT PAPER"); }} disabled={submit.isPending}>
                        <Send aria-hidden="true" className="h-3.5 w-3.5 mr-1" /> Send order to broker / queue
                      </Button>
                    )}
                    <span className="text-xs tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>
                      {formatDistanceToNow(o.updatedAt, { addSuffix: true })}
                    </span>
                  </div>
                </div>
                {o.reason && (
                  <p className="mt-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                    {o.reason}
                  </p>
                )}
                {o.rejectionReason && (
                  <p className="mt-2 break-words text-xs" style={{ color: "var(--sh-red)" }}>Reason: {o.rejectionReason}</p>
                )}
                {gateError && gateError.orderId === o.id && (
                  <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-red-400">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                        <span>{gateError.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGateError(null)}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium underline"
                      >
                        Dismiss
                      </button>
                    </div>
                    <ul className="space-y-1.5 pl-1">
                      {gateError.violations.map((v, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-red-200/90 leading-relaxed">
                          <span className="text-red-400 font-mono select-none">•</span>
                          <span>{v}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {o.dispatchError && (
                  <p className="mt-2 rounded border px-3 py-2 text-xs leading-5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 45%, var(--sh-border-1))", color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>Broker response unresolved.</strong> The stable paper-order ID is being reconciled. Do not submit another order or change this mission disposition yet.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {otherRunOrders.length > 0 && focusCandidateId != null && (
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
          <span>{otherRunOrders.length} other paper order{otherRunOrders.length === 1 ? "" : "s"} in this research run.</span>
          <Button variant="ghost" size="sm" className="min-h-11 w-full shrink-0 sm:w-auto" onClick={() => navigate("/aperture/plays")}>Monitor in Play Desk</Button>
        </div>
      )}
      <AlertDialog open={confirmation != null} onOpenChange={(open) => { if (!open) { setConfirmation(null); setConfirmationText(""); } }}>
        <AlertDialogContent className="max-h-[90vh] w-[calc(100%_-_2rem)] max-w-[calc(100%_-_2rem)] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.kind === "submit" ? "Send paper order to broker" : "Approve this paper trade"}</AlertDialogTitle>
            <AlertDialogDescription>
              Paper only. Confirming reruns pricing, evidence, and risk checks. Eligible closed-market limit DAY orders may queue for the next eligible regular session. Acceptance is not a fill.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation && (
            <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)" }}>
              <div><span className="block text-xs text-muted-foreground">Instrument</span><strong>{orderInstrumentLabel(confirmation.order)} · {confirmation.order.side.toUpperCase()}</strong>{isOptionInstrument(confirmation.order.instrumentType) && <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">Contract: {confirmation.order.symbol}</span>}</div>
              <div><span className="block text-xs text-muted-foreground">Size</span><strong>{orderSizeLabel(confirmation.order)}</strong></div>
              <div><span className="block text-xs text-muted-foreground">Order</span><strong>{confirmation.order.orderType.toUpperCase()} · {confirmation.order.timeInForce.toUpperCase()}{confirmation.order.limitPriceCents ? ` · limit ${fmtPrice(confirmation.order.limitPriceCents)}` : ""}</strong></div>
              <div><span className="block text-xs text-muted-foreground">{isOptionInstrument(confirmation.order.instrumentType) ? "Premium / protection" : "Entry / protective stop"}</span><strong>{isOptionInstrument(confirmation.order.instrumentType) ? `${fmtPrice(confirmation.order.entryPriceCents)} premium · fully defined by debit` : `${fmtPrice(confirmation.order.entryPriceCents)} / ${fmtPrice(confirmation.order.stopPriceCents)}`}</strong></div>
              <div><span className="block text-xs text-muted-foreground">{isOptionInstrument(confirmation.order.instrumentType) ? "Planned premium risk" : "Planned loss at modeled stop — execution may differ"}</span><strong>{fmt(confirmation.order.plannedRiskCents)}</strong></div>
              <div><span className="block text-xs text-muted-foreground">Review check-in time</span><strong>{confirmation.order.timeStopAt ? format(confirmation.order.timeStopAt, "PP p") : "Not recorded"}</strong></div>
              <div className="sm:col-span-2"><span className="block text-xs text-muted-foreground">Exit / Invalidation trigger</span><strong>{confirmation.order.invalidationCondition || "Not recorded"}</strong></div>
              <div className="sm:col-span-2 rounded-md p-3" style={{ background: "var(--sh-surface-2)" }}>
                <span className="block text-xs text-muted-foreground">Destination broker account</span>
                <strong>{confirmation.order.destinationAccount?.label ?? "Unavailable"}</strong>
                <span className="block break-all text-xs text-muted-foreground">{confirmation.order.destinationAccount?.brokerId ?? "unknown broker"} · account {confirmation.order.destinationAccount?.externalAccountId ?? "not bound"}</span>
                <span className="block text-xs text-muted-foreground">Portfolio context: {confirmation.order.portfolioContextAccount?.label ?? "Unavailable"}</span>
              </div>
            </div>
          )}
          {gateError && gateError.orderId === confirmation?.order.id && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{gateError.title}</span>
              </div>
              <ul className="space-y-1.5 pl-1">
                {gateError.violations.map((v, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-red-200/90 leading-relaxed">
                    <span className="text-red-400 font-mono select-none">•</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="paper-confirmation" className="text-sm font-medium">Safety confirmation code: <span className="font-mono font-semibold">{requiredConfirmation}</span></label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-primary hover:underline"
                onClick={() => setConfirmationText(requiredConfirmation)}
              >
                Auto-fill "{requiredConfirmation}"
              </Button>
            </div>
            <Input id="paper-confirmation" className="min-h-11 font-mono tracking-wider font-semibold uppercase" autoComplete="off" value={confirmationText} onChange={(event) => setConfirmationText(event.target.value.toUpperCase())} />
            <p className="text-[11px] text-muted-foreground">Simulated paper trading only. No real money will be charged or placed at risk.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Go back</AlertDialogCancel>
            <Button className="min-h-11" onClick={confirmAction} disabled={confirmationText !== requiredConfirmation || approve.isPending || submit.isPending}>
              {(approve.isPending || submit.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmation?.kind === "submit" ? "Send Order to Broker / Queue" : "Confirm Approval"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={rejection != null} onOpenChange={(open) => { if (!open) { setRejection(null); setRejectionReason(""); } }}>
        <AlertDialogContent className="w-[calc(100%_-_2rem)] max-w-[calc(100%_-_2rem)] overflow-x-hidden sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Pass on this trade ({rejection?.symbol})</AlertDialogTitle>
            <AlertDialogDescription>Records your note on why you passed on this trade. Your capital remains safe and no order is placed.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="paper-rejection-reason" className="text-sm font-medium">Why are you passing on this trade?</label>
            <textarea id="paper-rejection-reason" rows={4} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className="min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} placeholder="e.g. Waiting for Monday open momentum, spread is wider than expected, preserving cash..." />
            <p className="text-xs text-muted-foreground">At least 10 characters. Be specific enough to learn from tomorrow.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Go back</AlertDialogCancel>
            <Button variant="outline" className="min-h-11" disabled={!rejection || rejectionReason.trim().length < 10 || reject.isPending} onClick={() => { if (!rejection) return; reject.mutate({ orderId: rejection.id, reason: rejectionReason.trim() }); setRejection(null); setRejectionReason(""); }}>Record decision & keep cash safe</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ManualOrderTicketModal
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        initialValues={{ runId, candidateId: focusCandidateId }}
      />
    </div>
  );
}

export function MonitoringPanel({ runId, candidate, thesisSummary, order, selection, onOpenFinding, contextState = "ready", onRetryContext }: {
  runId: number; candidate?: { id: number; symbol: string }; thesisSummary?: string | null;
  order?: NonNullable<inferRouterOutputs<AppRouter>["aperture"]["order"]["list"]>[number];
  selection: MonitoringFindingRoute;
  onOpenFinding: (href: string) => void;
  contextState?: "loading" | "failed" | "ready";
  onRetryContext?: () => void;
}) {
  const selectedElement = useRef<HTMLDivElement>(null);
  const focusedVersion = useRef<string | null>(null);
  const interrupted = useRef(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [hedgeModalOpen, setHedgeModalOpen] = useState(false);

  const selectionKey = selection && !("invalid" in selection) ? `${selection.orderId}:${selection.findingId}:${selection.findingVersion}` : null;
  useEffect(() => {
    interrupted.current = false;
    const interrupt = () => { interrupted.current = true; };
    window.addEventListener("pointerdown", interrupt); window.addEventListener("keydown", interrupt); window.addEventListener("wheel", interrupt, { passive: true });
    return () => { window.removeEventListener("pointerdown", interrupt); window.removeEventListener("keydown", interrupt); window.removeEventListener("wheel", interrupt); };
  }, [selectionKey]);
  const query = trpc.aperture.monitor.list.useQuery(
    { runId, candidateId: candidate?.id ?? -1 }, { enabled: candidate != null },
  );
  const checks = query.data;

  const reviewsQuery = ((trpc.aperture?.monitor?.reviews as any)?.listAll ?? (trpc.aperture?.monitor?.reviews as any)?.list)?.useQuery
    ? ((trpc.aperture?.monitor?.reviews as any)?.listAll ?? (trpc.aperture?.monitor?.reviews as any)?.list).useQuery(
        { runId },
        { refetchOnWindowFocus: false }
      )
    : { data: undefined };
  const resolvedVersions = resolvedFindingVersions(reviewsQuery.data?.receipts);
  const isCheckResolved = (check: VersionedMonitoringFinding) =>
    resolvedVersions.has(`${check.id}:${monitoringFindingVersion(check)}`);

  // No account/order-linked quote source is available here. Never substitute a
  // position sharing an underlying, or a synthetic mark, for this exact order.
  const currentPosition = undefined;

  const [timedOut, setTimedOut] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, []);

  const runCheck = trpc.aperture.monitor.run.useMutation({
    onSuccess: (results) => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      setTimedOut(false);
      setCheckError(null);
      const reviewCount = results.filter((result) => monitoringReviewState(result).needsReview).length;
      toast.success(`${results.length} checks run, ${reviewCount} require review`);
      void query.refetch();
      void reviewsQuery.refetch();
    },
    onError: (e) => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      setTimedOut(false);
      setCheckError(e.message);
      toast.error(e.message);
    },
  });
  const canCheck = Boolean(contextState === "ready" && candidate && order?.status === "filled");
  const runScopedChecks = () => {
    if (!candidate || !canCheck || runCheck.isPending) return;
    setTimedOut(false);
    setCheckError(null);
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);

    // A slow response is not cancellation. Keep the request pending to prevent
    // duplicate checks while the server may still be writing evidence.
    checkTimeoutRef.current = setTimeout(() => {
      setTimedOut(true);
      toast.info("Checks are taking longer than expected. The request is still pending.");
    }, 18_000);

    runCheck.mutate({ runId, candidateId: candidate.id, symbol: candidate.symbol,
      thesisSummary: [order?.reason, thesisSummary].filter(Boolean).join(" · ") || `Monitor ${candidate.symbol} against the recorded paper thesis and its invalidation conditions.`,
    });
  };

  const cancelScopedCheck = () => {
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    setTimedOut(false);
    setCheckError(null);
  };
  const { current: currentChecks, history: previousChecks } = partitionMonitoringHistory(checks ?? []);
  const selected = selectMonitoringFinding(checks ?? [], selection);
  const selectedCheck = selected.check;
  const selectedOrderMatches = Boolean(order && selection && !("invalid" in selection) && order.id === selection.orderId);
  const showSelected = selectedCheck && selectedOrderMatches;
  useEffect(() => {
    if (!showSelected || !selectionKey || focusedVersion.current === selectionKey || !selectedElement.current) return;
    focusedVersion.current = selectionKey;
    revealMonitoringFinding(selectedElement.current, interrupted.current);
  }, [showSelected, selectionKey, contextState]);
  const reviewItems = currentChecks.filter((check) => monitoringReviewState(check).needsReview && !isCheckResolved(check));

  const [activeFlankKey, setActiveFlankKey] = useState<string>("catalyst");
  useEffect(() => {
    if (selectedCheck?.checkType) {
      setActiveFlankKey(selectedCheck.checkType);
    }
  }, [selectedCheck?.checkType]);

  const hasMismatchedSelection = Boolean(
    selection && (!selectedCheck || !selectedOrderMatches)
  );

  const focusedCheck = hasMismatchedSelection
    ? null
    : showSelected && selectedCheck
    ? selectedCheck
    : currentChecks.find((c) => c.checkType === activeFlankKey) ?? null;
  const isFocusedHistorical = Boolean(showSelected && selected.historical);

  if (contextState === "loading") return <p role="status">Loading selected play and order… No checks are being run.</p>;
  const contextError = contextState === "failed" ? <div role="alert" className="rounded-lg border p-4"><p>Selected play or order could not refresh. No monitoring eligibility is confirmed.</p>{onRetryContext && <Button variant="outline" className="mt-2 min-h-11" onClick={onRetryContext}>Retry play and order</Button>}</div> : null;
  if (contextError && (!candidate || !order)) return contextError;

  // A filled order alone is not a verified current holding available to exit.
  // Use the portfolio's reconciled position flow; do not invent a target here.
  const exitTarget: ExitTarget | null = null;

  return <div className="space-y-4">
    {contextError}

    {/* Above-the-fold Active Position Management Cockpit */}
    {order && (
      <PositionSummaryBar
        order={order}
        position={currentPosition}
        thesisSummary={thesisSummary}
      />
    )}

    {/* Master-Detail Split Pane */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Left Pane (Master: 5 cols): Tactical Flank Radar Selector */}
      <div className="lg:col-span-5 space-y-4">
        <TacticalFlankRadar
          checks={checks ?? []}
          order={order}
          candidate={candidate}
          runId={runId}
          selectedKey={activeFlankKey}
          onSelectFlank={(key) => {
            setActiveFlankKey(key);
            const targetCheck = currentChecks.find((c) => c.checkType === key);
            if (targetCheck && order && candidate) {
              onOpenFinding(monitoringFindingHref({ ...targetCheck, runId, candidateId: candidate.id, orderId: order.id }));
            }
          }}
          resolvedFindingKeys={resolvedVersions}
          onOpenFinding={onOpenFinding}
          onRefreshAll={canCheck ? runScopedChecks : undefined}
          refreshing={runCheck.isPending}
        />

        {/* Sourced Checks Trigger & Lifecycle Notice */}
        <section className="rounded-lg border p-4 space-y-2.5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <h2 className="text-sm font-semibold">Thesis checks · {order ? orderInstrumentLabel(order) : candidate?.symbol ?? "Select a play"}</h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary font-medium w-fit">
              {order?.status === "filled" ? "Paper fill recorded" : "Recorded order context"}
            </span>
          </div>
          <p className="text-xs leading-5" style={{ color: "var(--sh-text-secondary)" }}>
            Check this play’s catalyst and invalidation. Checks run on demand; reading a finding does not acknowledge or resolve it.
          </p>
          {(timedOut || checkError || runCheck.isError) && (
            <div role="alert" className="rounded-lg border p-3 text-xs space-y-2" style={{ borderColor: "var(--sh-red)", background: "color-mix(in srgb, var(--sh-red) 8%, var(--sh-surface))" }}>
              <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--sh-red)" }}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{timedOut ? "Checks are still pending." : "Check execution could not complete."}</span>
              </div>
              <p style={{ color: "var(--sh-fg-muted)" }}>
                {timedOut
                  ? "The provider is taking longer than expected. This request may still save evidence. Do not start another check. No order action is performed."
                  : checkError || runCheck.error?.message || "Market data feed error occurred."}
              </p>
              <Button variant="outline" size="sm" className="min-h-11 text-xs" disabled={runCheck.isPending} onClick={runScopedChecks}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry sourced checks
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full min-h-11"
            disabled={!canCheck || runCheck.isPending}
            onClick={runScopedChecks}
          >
            {runCheck.isPending ? <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="mr-1.5 h-4 w-4" />}
            {runCheck.isPending ? "Checking this play…" : timedOut || checkError || runCheck.isError ? "Retry sourced checks" : "Run sourced checks"}
          </Button>

          {runCheck.isPending ? (
            <div className="flex items-center justify-between text-xs pt-1">
              <span style={{ color: "var(--sh-fg-muted)" }}>Connecting to live market search…</span>
              <span>Leaving this view does not cancel the server request.</span>
            </div>
          ) : (
            <p className="text-xs" role="status" style={{ color: "var(--sh-fg-muted)" }}>
              {!canCheck ? "New monitoring checks require a verified open fill. Review the order status first." : "Creates new monitoring evidence for this play only. Does not submit, hedge, or exit an order."}
            </p>
          )}
        </section>

        {query.isLoading && <p role="status" className="text-sm">Loading recorded checks…</p>}
        {query.isError && <div role="alert" className="rounded-lg border p-4"><p>Recorded monitoring could not load. Available records are retained; no all-clear is established.</p><Button variant="outline" className="mt-2 min-h-11" disabled={query.isFetching} onClick={() => void query.refetch()}>Retry saved status</Button></div>}
        {selection && contextState === "ready" && !query.isLoading && !query.isError && (!selectedCheck || !selectedOrderMatches) && <div role="alert" className="rounded-lg border p-4"><p>The exact finding or selected order could not be matched. No other finding has been substituted, and no review was saved.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => void query.refetch()}>Reload recorded checks</Button><p className="mt-2 text-sm">Open a specific finding below, or return to Play Desk to recover the selected order.</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => onOpenFinding("/aperture/plays")}>Return to Play Desk</Button></div>}
        {!query.isLoading && !query.isError && checks?.length === 0 && <p className="text-sm">No monitoring checks recorded for this play. No conclusion about its current thesis is available.</p>}
      </div>

      {/* Right Pane (Detail: 7 cols): Focused Inspection Card & Action Cockpit */}
      <div className="lg:col-span-7 space-y-4">
        {/* Needs review counter banner */}
        {reviewItems.length > 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <p role="status" className="font-semibold text-amber-500">
                {reviewItems.length} check{reviewItems.length === 1 ? " needs" : "s need"} review. Open the evidence beside each finding.
              </p>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">Action required</span>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <p role="status" className="font-semibold">
                {query.isLoading ? "Loading recorded checks…" : query.isError ? "Monitoring status unavailable." : "No unresolved review tasks in the loaded records. This is not a current thesis verification."}
              </p>
            </div>
          </div>
        )}

        {/* Focused Finding Card & Review Actions */}
        {focusedCheck ? (
          <div
            ref={selectedElement}
            tabIndex={-1}
            data-selected-monitoring-finding={focusedCheck.id}
            className="scroll-mt-28 rounded-xl outline-offset-4 space-y-3"
            aria-label="Selected monitoring finding"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-tight uppercase" style={{ color: "var(--sh-fg-muted)" }}>
                {isFocusedHistorical ? "Selected historical finding" : "Selected check"} · {isCheckResolved(focusedCheck) ? "Review recorded" : monitoringFindingPresentation({ check: focusedCheck, instrument: order }).stateLabel}
              </p>
              {isCheckResolved(focusedCheck) && (
                <Badge variant="outline" className="text-xs border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                  Review recorded
                </Badge>
              )}
            </div>
            {isFocusedHistorical && (
              <p className="text-xs text-muted-foreground">
                A newer check exists below. This is the exact version you opened, not a current market claim.
              </p>
            )}

            {/* Operational Threat Impact Assessment */}
            <div className="rounded-lg border p-3 text-xs space-y-1.5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <div className="flex items-center gap-1.5 font-bold" style={{ color: "var(--sh-text-primary)" }}>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Direct Risk Boundary Assessment</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>
                Compare this finding with the recorded invalidation rule. Current stop proximity is not measured in this view; no automatic exit occurs.
              </p>
            </div>

            <MonitoringFindingCard
              check={focusedCheck}
              instrument={order}
              rationale={order?.reason ?? thesisSummary}
              onRefresh={canCheck ? runScopedChecks : undefined}
              refreshing={runCheck.isPending}
              hideImplication={true}
              isResolved={isCheckResolved(focusedCheck)}
            />

            {order && candidate && (
              <MonitoringFindingReview
                key={`${focusedCheck.id}:${monitoringFindingVersion(focusedCheck)}`}
                target={{
                  runId,
                  candidateId: candidate.id,
                  orderId: order.id,
                  findingId: focusedCheck.id,
                  findingVersion: monitoringFindingVersion(focusedCheck),
                }}
              />
            )}
          </div>
        ) : (
          <div className="rounded-xl border p-8 text-center space-y-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
            <Info className="mx-auto h-8 w-8" />
            <h3 className="text-sm font-semibold">No finding selected</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Select a recorded check or run sourced checks. Missing evidence does not establish that the thesis still holds.
            </p>
          </div>
        )}

        {/* Other active checks list */}
        {currentChecks.filter(check => focusedCheck ? check.id !== focusedCheck.id : true).length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-muted-foreground">Other active checks for this play:</p>
            <div className="space-y-3">
              {currentChecks.filter(check => check.id !== focusedCheck?.id).map((check) => (
                <div key={check.id}>
                  <MonitoringFindingCard
                    check={check}
                    instrument={order}
                    rationale={order?.reason ?? thesisSummary}
                    onRefresh={canCheck ? runScopedChecks : undefined}
                    refreshing={runCheck.isPending}
                    hideImplication={true}
                    isResolved={isCheckResolved(check)}
                  />
                  {order && candidate && (
                    <Button
                      variant="outline"
                      className="mt-2 min-h-11"
                      onClick={() => onOpenFinding(monitoringFindingHref({ ...check, runId, candidateId: candidate.id, orderId: order.id }))}
                    >
                      Review this finding
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Version History Drawer */}
        {previousChecks.length > 0 && (
          <details className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <summary className="min-h-11 cursor-pointer font-semibold flex items-center justify-between text-sm">
              <span>Version History ({previousChecks.length}) · Previous checks · {previousChecks.length}</span>
              <span className="text-xs font-normal" style={{ color: "var(--sh-fg-muted)" }}>Archived checks · Click to expand</span>
            </summary>
            <p className="my-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Historical versions, not additional current review tasks. No finding is acknowledged or erased.</p>
            <div className="space-y-3 pt-2">
              {previousChecks.filter(check => !showSelected || check.id !== selectedCheck.id).map(check => (
                <div key={check.id}>
                  <MonitoringFindingCard check={check} instrument={order} rationale={order?.reason ?? thesisSummary} hideImplication={true} />
                  {order && candidate && (
                    <Button variant="outline" className="mt-2 min-h-11" onClick={() => onOpenFinding(monitoringFindingHref({ ...check, runId, candidateId: candidate.id, orderId: order.id }))}>
                      Review this recorded version
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
    {!query.isLoading && !query.isError && checks?.length === 0 && <p className="text-sm">No monitoring checks recorded for this play. No conclusion about its current thesis is available.</p>}

    {exitModalOpen && (
      <PositionExitModal
        open={exitModalOpen}
        onOpenChange={setExitModalOpen}
        target={exitTarget}
        onSuccess={() => {
          setExitModalOpen(false);
          toast.success("Paper exit draft saved; submission is separate.");
          void query.refetch();
        }}
      />
    )}

    {hedgeModalOpen && (
      <ManualOrderTicketModal
        open={hedgeModalOpen}
        onOpenChange={setHedgeModalOpen}
        initialValues={{
          symbol: order?.underlyingSymbol ?? order?.symbol ?? "",
          direction: "short",
          runId,
          candidateId: candidate?.id,
        }}
      />
    )}
  </div>;
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
          <h3 className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>Outcome &amp; notes</h3>
          <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
            Aperture Alpha is measured from real paper outcomes, never asserted.
          </p>
        </div>
        <Button variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => compute.mutate({ runId })} disabled={compute.isPending}>
          {compute.isPending ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 mr-1" />}
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
  const search = useSearch();
  const findingSelection = parseMonitoringFindingSelection(search);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [lifecycleTab, setLifecycleTab] = useState<"orders" | "monitoring" | "alpha">(() => {
    const requested = new URLSearchParams(window.location.search).get("lifecycle");
    return requested === "monitoring" || requested === "alpha" ? requested : "orders";
  });
  useEffect(() => {
    const requested = new URLSearchParams(search).get("lifecycle");
    if (requested === "monitoring" || requested === "alpha") setLifecycleTab(requested);
  }, [search]);
  const openLifecycle = (tab: "orders" | "monitoring" | "alpha") => {
    setLifecycleTab(tab);
    window.requestAnimationFrame(() => document.getElementById("paper-lifecycle")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const runQuery = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });
  const ordersQuery = trpc.aperture.order.list.useQuery({ runId }, { enabled: !!runId });
  const { data } = runQuery;
  const { data: runOrders } = ordersQuery;
  const monitoringContextState = runQuery.isError || ordersQuery.isError ? "failed"
    : runQuery.isLoading || ordersQuery.isLoading ? "loading" : "ready";
  if (monitoringContextState !== "ready") {
    return <DashboardLayout><section aria-live="polite" className="mx-auto max-w-5xl space-y-3 p-6">
      <h1 className="text-xl font-semibold">{monitoringContextState === "failed" ? "Ticket status unavailable" : "Loading your existing ticket…"}</h1>
      <p>No new ticket or order has been created. Existing orders are unchanged.</p>
      {monitoringContextState === "failed" && <Button onClick={() => { void runQuery.refetch(); void ordersQuery.refetch(); }}>Retry ticket status</Button>}
    </section></DashboardLayout>;
  }
  if (data?.decisionAuthority && !decisionAuthorityAllowsDownstream(data.decisionAuthority)) {
    return <DashboardLayout><DecisionStepLock authority={data.decisionAuthority} step="Ticket" onOpenReceipt={() => navigate(`/aperture/decision/${data.decisionAuthority!.decisionRunId}/revision/${data.decisionAuthority!.revisionId}`)} /></DashboardLayout>;
  }
  const run = data?.run;
  const candidateId = Number(new URLSearchParams(search).get("candidate"));
  const requestedOrderId = new URLSearchParams(search).get("order");
  const proposalCandidate = Number.isFinite(candidateId) && candidateId > 0 ? data?.candidates.find((candidate) => candidate.id === candidateId) : undefined;
  const proposalEvidence = proposalCandidate
    ? getEvidenceReviewReadiness(
      normalizeStringList(proposalCandidate.verifyFields),
      (data?.evidenceReviews ?? []).filter((review) => review.candidateId === proposalCandidate.id),
    )
    : null;
  const paperStageDeclined = proposalEvidence?.paperStageDeclined === true;
  const unreviewedEvidenceChecks = proposalEvidence?.unreviewedChecks ?? [];
  const evidenceReviewRequired = unreviewedEvidenceChecks.length > 0;
  const candidateActiveOrder = proposalCandidate
    ? runOrders?.find((order) => order.candidateId === proposalCandidate.id && (requestedOrderId == null || order.id === Number(requestedOrderId)) && ["pending_approval", "approved", "submitted", "filled"].includes(order.status))
    : undefined;
  // A historical finding retains the exact order expression even if that order
  // is no longer active. Do not substitute the first same-candidate order.
  const monitoringOrder = requestedOrderId == null ? candidateActiveOrder
    : runOrders?.find(order => order.id === Number(requestedOrderId) && order.candidateId === proposalCandidate?.id);
  const candidateOrderDecision = candidateActiveOrder
    ? candidateActiveOrder.status === "submitted"
      ? {
          title: `${orderInstrumentLabel(candidateActiveOrder)} staged with paper broker`,
          detail: "The paper broker accepted this order. Check its actual fill status below; do not create a duplicate.",
          action: "View queued paper order",
          lifecycleTab: "orders" as const,
        }
      : candidateActiveOrder.status === "filled"
        ? {
            title: `${orderInstrumentLabel(candidateActiveOrder)} executed in paper account`,
            detail: "Simulated order filled. Track price progress and review thesis validity as the market moves.",
            action: "Monitor paper play",
            lifecycleTab: "monitoring" as const,
          }
        : candidateActiveOrder.status === "approved"
          ? {
              title: `${orderInstrumentLabel(candidateActiveOrder)} approved · ready to send to broker`,
              detail: "Review the destination and submit the exact ticket below. Current checks must pass; approval alone does not send an order.",
              action: "Send order to broker",
              lifecycleTab: "orders" as const,
            }
          : {
              title: `${orderInstrumentLabel(candidateActiveOrder)} trade ready for your approval`,
              detail: "Simulated trade terms are ready. Review safety limits and click Approve Paper Ticket below.",
              action: "Review paper ticket",
              lifecycleTab: "orders" as const,
            }
    : null;
  const evidenceUrl = proposalCandidate
    ? `/aperture/run/${runId}?candidate=${proposalCandidate.id}&view=evidence`
    : `/aperture/run/${runId}?view=evidence`;
  const decisionUrl = proposalCandidate
    ? `/aperture/run/${runId}?candidate=${proposalCandidate.id}`
    : `/aperture/run/${runId}`;
  const alternativeCandidates = (data?.candidates ?? [])
    .filter((candidate) => candidate.id !== proposalCandidate?.id)
    .map((candidate) => ({
      candidate,
      evidence: getEvidenceReviewReadiness(
        normalizeStringList(candidate.verifyFields),
        (data?.evidenceReviews ?? []).filter((review) => review.candidateId === candidate.id),
      ),
    }));

  return (
    <DashboardLayout>
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 overflow-x-clip">
        <DisclaimerBanner />

        <div className="flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 40%, var(--sh-border-1))", background: "color-mix(in srgb, var(--sh-signal) 8%, var(--sh-surface))" }}>
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} />
          <span style={{ color: "var(--sh-text-primary)" }}>
            <strong>Paper execution:</strong> Approval and submission are separate. Eligible orders submitted outside trading hours may queue for the next eligible regular session; no fill is guaranteed.
          </span>
        </div>

        <div>
          <div className="flex min-w-0 items-center gap-2">
            <Button aria-label="Return to decision brief" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => navigate(decisionUrl)}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </Button>
            <h1 className="min-w-0 text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>
              {lifecycleTab === "monitoring" ? "Review play" : "Paper ticket"}
            </h1>
          </div>
          {run && (
            <p className="text-sm mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>
              Run #{runId} · Paper-only follow-through after evidence and posture review
            </p>
          )}
        </div>

        {proposalCandidate && data?.brief && (
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Current human decision</p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>{candidateOrderDecision?.title ?? (paperStageDeclined ? "Paper stage declined — preserve cash for this candidate" : evidenceReviewRequired ? data.brief.nextDecision.title : `${proposalCandidate.symbol} evidence review complete · check ticket readiness`)}</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{candidateOrderDecision?.detail ?? (paperStageDeclined ? "A required evidence answer was recorded as not confirmed. This revision cannot prepare a proposal or create an order." : evidenceReviewRequired ? data.brief.nextDecision.detail : "The remaining path is exact contract → proposal → approve → submit. Each step stays separate and nothing is sent automatically.")}</p>
              </div>
              {candidateOrderDecision ? candidateOrderDecision.lifecycleTab !== lifecycleTab && <Button size="sm" className="min-h-11 w-full shrink-0 sm:w-auto" onClick={() => openLifecycle(candidateOrderDecision.lifecycleTab)}>{candidateOrderDecision.action}</Button> : evidenceReviewRequired && <Button variant="outline" size="sm" className="min-h-11 w-full shrink-0 sm:w-auto" onClick={() => navigate(evidenceUrl)}>{`Review ${unreviewedEvidenceChecks.length} required check${unreviewedEvidenceChecks.length === 1 ? "" : "s"}`}</Button>}
            </div>
          </div>
        )}

        {lifecycleTab !== "monitoring" && (proposalCandidate && candidateActiveOrder ? <section className="min-w-0 rounded-xl border p-4 sm:p-5" style={{ borderColor: "color-mix(in srgb, var(--sh-emerald) 45%, var(--sh-border-1))", background: "var(--sh-surface-2)" }}><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--sh-emerald)" }} /><div className="min-w-0"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-emerald)" }}>Paper order already exists · do not duplicate</p><h2 className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>{orderInstrumentLabel(candidateActiveOrder)}</h2><p className="mt-1 text-sm tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>{orderSizeLabel(candidateActiveOrder)} · {candidateActiveOrder.orderType.toUpperCase()} · {candidateActiveOrder.timeInForce.toUpperCase()}{candidateActiveOrder.limitPriceCents ? ` · limit ${fmtPrice(candidateActiveOrder.limitPriceCents)}` : ""}</p><p className="mt-2 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>{candidateOrderDecision?.title}</p></div></div></section> : proposalCandidate && paperStageDeclined ? <section className="min-w-0 rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--sh-red) 45%, var(--sh-border-1))", background: "var(--sh-surface-2)" }}><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>No paper proposal can be prepared from this revision.</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>The not-confirmed evidence answer remains attached to this Decision Run. No proposal or broker order was created.</p><Button className="mt-3 min-h-11 w-full sm:w-auto" variant="outline" size="sm" onClick={() => navigate(evidenceUrl)}>Review the recorded evidence decision</Button></section> : proposalCandidate && evidenceReviewRequired ? <section className="min-w-0 rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Paper ticket locked · step 1 of 4</p><h2 className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Review {unreviewedEvidenceChecks.length} decision-critical check{unreviewedEvidenceChecks.length === 1 ? "" : "s"} before building the ticket.</h2><p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>This is the only blocker to address on this screen. After the final positive review, the flow advances to exact contract → proposal → approve → submit. A negative review preserves cash instead.</p><ol className="mt-4 space-y-2">{unreviewedEvidenceChecks.map((check, index) => <li key={check} className="flex gap-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)", color: "var(--sh-text-primary)" }}><span className="font-mono text-xs tabular-nums" style={{ color: "var(--sh-signal)" }}>{index + 1}</span><span>{check}</span></li>)}</ol><Button className="mt-4 min-h-11 w-full sm:w-auto" onClick={() => navigate(evidenceUrl)}>Review {unreviewedEvidenceChecks.length} required check{unreviewedEvidenceChecks.length === 1 ? "" : "s"}</Button></section> : proposalCandidate && <PaperProposalForm key={`${runId}:${proposalCandidate.id}`} runId={runId} candidate={proposalCandidate} account={data?.paperContext?.account} run={run} evidenceReviewComplete={proposalEvidence?.paperProposalReady === true} onReturnToBrief={() => navigate(evidenceUrl)} onReturnToDecisionBrief={() => setShowAlternatives(true)} onProposalCreated={() => openLifecycle("orders")} onCashPreserved={() => navigate("/aperture/plays")} />)}

        {showAlternatives && proposalCandidate && <section className="scroll-mt-4 rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }} aria-live="polite">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Resolve this decision here</p><h2 className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Choose another play in this run</h2><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{proposalCandidate.symbol} remains blocked by the named preflight rule. Pick an alternative below; the next button opens only its unresolved checks or its ticket.</p></div>
            <Button variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={() => setShowAlternatives(false)}>Keep this ticket visible</Button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {alternativeCandidates.map(({ candidate, evidence }) => {
              const remaining = evidence.unreviewedChecks.length;
              const declined = evidence.paperStageDeclined;
              return <button key={candidate.id} type="button" disabled={declined} className="flex min-h-16 items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-55" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }} onClick={() => {
                setShowAlternatives(false);
                navigate(remaining > 0 ? `/aperture/run/${runId}?candidate=${candidate.id}&view=evidence` : `/aperture/run/${runId}/execute?candidate=${candidate.id}`);
              }}><span><strong className="font-mono text-sm" style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol}</strong><span className="mt-1 block text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{declined ? "Paper stage declined" : remaining > 0 ? `${remaining} evidence check${remaining === 1 ? "" : "s"} remain` : "Evidence complete · open ticket"}</span></span><ArrowLeft className="h-4 w-4 rotate-180" style={{ color: "var(--sh-signal)" }} /></button>;
            })}
          </div>
          {alternativeCandidates.length === 0 && <p className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>No alternative play exists in this run. Preserve cash or revise the mission; no order was created.</p>}
        </section>}

        <Tabs id="paper-lifecycle" value={lifecycleTab} onValueChange={(value) => setLifecycleTab(value as "orders" | "monitoring" | "alpha")} className="min-w-0 scroll-mt-24">
          <TabsList aria-label="Paper lifecycle" className="grid h-auto w-full min-w-0 grid-cols-1 gap-1 p-1 sm:grid-cols-3">
            <TabsTrigger className="min-h-11 min-w-0 whitespace-normal px-3 py-2 text-center leading-5" value="orders">Paper ticket</TabsTrigger>
            <TabsTrigger className="min-h-11 min-w-0 whitespace-normal px-3 py-2 text-center leading-5" value="monitoring">Check whether thesis still holds</TabsTrigger>
            <TabsTrigger className="min-h-11 min-w-0 whitespace-normal px-3 py-2 text-center leading-5" value="alpha">Outcome &amp; notes</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-4 min-w-0" aria-label="Paper ticket">
            <OrderQueue runId={runId} focusCandidateId={proposalCandidate?.id} requestedOrderId={requestedOrderId ? Number(requestedOrderId) : null} ticketBuilderActive={Boolean(proposalCandidate && !paperStageDeclined && !evidenceReviewRequired && !candidateActiveOrder)} />
          </TabsContent>
          <TabsContent value="monitoring" className="mt-4 min-w-0" aria-label="Check whether thesis still holds">
            <MonitoringPanel key={`${runId}:${proposalCandidate?.id}:${requestedOrderId ?? "default"}`} runId={runId} candidate={proposalCandidate} thesisSummary={run?.invalidationRule} order={monitoringOrder} selection={findingSelection} onOpenFinding={navigate} contextState={monitoringContextState} onRetryContext={() => { void runQuery.refetch(); void ordersQuery.refetch(); }} />
          </TabsContent>
          <TabsContent value="alpha" className="mt-4 min-w-0" aria-label="Outcome and notes">
            <AlphaDashboard runId={runId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
