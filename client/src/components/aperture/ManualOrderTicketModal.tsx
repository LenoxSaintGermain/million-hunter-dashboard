import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { nextStandardMonthlyOptionExpiration } from "@shared/paperInstrument";
import { TrendingDown, TrendingUp, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import type { AttentionMission } from "@shared/apertureAttention";
import { manualTicketBlocker } from "@shared/manualTicketReadiness";
import { buildManualTicketPayload } from "@shared/manualTicketPayload";
import { GuardrailChecklist } from "@/components/aperture/GuardrailChecklist";
import { singleNameCheck, singleOrderLimit } from "@shared/singleOrderLimit";
import type { CockpitHeadroomLine } from "@shared/cockpitRailSummary";

const usdExact = (cents: number) => {
  const whole = Math.round(cents) % 100 === 0;
  return `$${(Math.round(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
};

export interface ManualOrderTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeMission?: AttentionMission | null;
  initialValues?: {
    symbol?: string;
    direction?: "long" | "short";
    runId?: number;
    candidateId?: number;
    suggestedAmountCents?: number;
    holdingPeriod?: "intraday" | "swing" | "catalyst_window" | "position";
    limitPrice?: string;
    expression?: PlayExpression;
    strikePrice?: string;
    /** Shares or contracts, depending on the expression. */
    quantity?: number;
    expirationDate?: string;
    invalidationCondition?: string;
    reason?: string;
  };
  onStaged?: (orderId: number, runId?: number) => void;
}

export type PlayExpression = 
  | "shares"
  | "long_call"
  | "long_put"
  | "bull_call_spread"
  | "bear_put_spread"
  | "bull_put_credit_spread"
  | "collar_hedge";

const EXPRESSIONS: { id: PlayExpression; label: string; badge: string; desc: string; regime: string }[] = [
  { id: "shares", label: "Direct Equity", badge: "Shares", desc: "Outright long/short equity position with stop protection.", regime: "Standard" },
  { id: "long_call", label: "Long Call", badge: "Call", desc: "Defined-risk upside convexity with low initial capital.", regime: "Low IV / Breakout" },
  { id: "long_put", label: "Long Put / Direct Hedge", badge: "Put", desc: "Direct downside protection or asymmetric downside thesis.", regime: "Low IV / Catalyst" },
  { id: "bull_call_spread", label: "Bull Call Debit Spread", badge: "Vertical", desc: "Long Lower Call + Short Upper Call. Mitigates IV drag.", regime: "Directional / Moderate IV" },
  { id: "bear_put_spread", label: "Bear Put Debit Spread", badge: "Vertical", desc: "Long Upper Put + Short Lower Put. Capped downside risk.", regime: "Bearish / Moderate IV" },
  { id: "bull_put_credit_spread", label: "Bull Put Credit Spread", badge: "Credit", desc: "Short Higher Put + Long Lower Put. Harvests volatility crush.", regime: "High IV / Pre-Earnings" },
  { id: "collar_hedge", label: "Skewed Collar / Tail Hedge", badge: "Collar", desc: "Protective Put funded by selling OTM Call against exposure.", regime: "Asymmetric Defense" },
];

export function ManualOrderTicketModal({ open, onOpenChange, activeMission: propActiveMission, initialValues, onStaged }: ManualOrderTicketModalProps) {
  const [, navigate] = useLocation();
  const utils = typeof (trpc as any).useUtils === "function" ? (trpc as any).useUtils() : null;
  const accountsQuery = trpc.aperture.account.list.useQuery();
  const deskSummary = (trpc as any)?.aperture?.desk?.summary?.useQuery
    ? (trpc as any).aperture.desk.summary.useQuery(undefined, {
        enabled: open && !propActiveMission,
      })
    : { data: undefined, isLoading: false };
  const activeMission = propActiveMission ?? deskSummary.data?.attention?.mission ?? null;

  const effectiveRunId = initialValues?.runId ?? activeMission?.researchRunId;

  const paperAccounts = useMemo(() => {
    return (accountsQuery.data ?? []).filter((a) => a.isPaper);
  }, [accountsQuery.data]);

  const defaultAccount = useMemo(() => {
    if (activeMission?.accountId) {
      const missionAccount = paperAccounts.find((a) => a.id === activeMission.accountId);
      if (missionAccount) return missionAccount;
    }
    return paperAccounts.find((a) => a.brokerId === "alpaca_paper")
      ?? paperAccounts[0];
  }, [paperAccounts, activeMission?.accountId]);

  const userSelectedAccountRef = useRef(false);
  const [accountId, setAccountId] = useState<number | null>(defaultAccount?.id ?? null);
  useEffect(() => {
    if (!userSelectedAccountRef.current && defaultAccount) {
      setAccountId(defaultAccount.id);
    }
  }, [defaultAccount]);

  const selectedAccount = paperAccounts.find((a) => a.id === accountId) ?? defaultAccount;
  const [stageError, setStageError] = useState<string | null>(null);

  const parsedErrors = useMemo(() => {
    if (!stageError) return [];
    const clean = stageError.replace(/^order blocked by the mandate:\s*/i, "").trim();
    return clean
      .split(/[;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [stageError]);

  // Form State
  const [symbol, setSymbol] = useState(initialValues?.symbol ?? "NVDA");
  const [expression, setExpression] = useState<PlayExpression>(
    initialValues?.expression ?? (initialValues?.direction === "short" ? "long_put" : "long_call")
  );
  const [direction, setDirection] = useState<"long" | "short">(initialValues?.direction ?? "long");
  const [holdingPeriod, setHoldingPeriod] = useState<"intraday" | "swing" | "catalyst_window" | "position">(
    initialValues?.holdingPeriod ?? "swing"
  );

  // Pricing & Strikes
  const initialIsShares = (initialValues?.expression ?? "") === "shares";
  const [shareCount, setShareCount] = useState<number>(initialIsShares && initialValues?.quantity ? initialValues.quantity : 4);
  const [contracts, setContracts] = useState<number>(!initialIsShares && initialValues?.quantity ? initialValues.quantity : 1);
  const [limitPrice, setLimitPrice] = useState<string>(
    initialValues?.limitPrice ?? (initialValues?.expression === "shares" ? "25.00" : "4.50")
  );
  const [strikePrice, setStrikePrice] = useState<string>(initialValues?.strikePrice ?? "150.00");
  const [spreadUpperStrike, setSpreadUpperStrike] = useState<string>("160.00");
  const [expirationDate, setExpirationDate] = useState<string>(() => {
    if (initialValues?.expirationDate) return initialValues.expirationDate;
    try {
      return nextStandardMonthlyOptionExpiration(Date.now(), 20);
    } catch {
      return new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    }
  });

  const [catalystDays, setCatalystDays] = useState<number>(14);
  const [invalidationCondition, setInvalidationCondition] = useState<string>(
    initialValues?.invalidationCondition ?? "Underlying closes below 20-day moving average or catalyst thesis fails to materialize."
  );
  const [reason, setReason] = useState<string>(
    initialValues?.reason ?? "Ad-hoc manual play staged from Aperture Play Desk to express strategic conviction."
  );
  const [paperAck, setPaperAck] = useState<string>("");

  useEffect(() => { setPaperAck(""); }, [open, accountId, expression, direction, symbol, limitPrice, strikePrice, contracts, shareCount]);

  // Sync initialValues if reopened
  useEffect(() => {
    if (initialValues?.symbol) setSymbol(initialValues.symbol.toUpperCase());
    if (initialValues?.expression) setExpression(initialValues.expression);
    if (initialValues?.direction) {
      setDirection(initialValues.direction);
      if (initialValues.direction === "short" && !initialValues.expression) {
        setExpression("long_put");
      }
    }
    if (initialValues?.holdingPeriod) {
      setHoldingPeriod(initialValues.holdingPeriod);
    }
    // A blank prefill means "not measured": never replace it with a placeholder price.
    if (initialValues?.limitPrice !== undefined) {
      setLimitPrice(initialValues.limitPrice);
    } else if (initialValues?.expression === "shares") {
      setLimitPrice("25.00");
    }
    if (initialValues?.strikePrice !== undefined) {
      setStrikePrice(initialValues.strikePrice);
    }
    if (initialValues?.quantity) {
      if (initialValues.expression === "shares") setShareCount(initialValues.quantity);
      else setContracts(initialValues.quantity);
    }
    if (initialValues?.expirationDate) setExpirationDate(initialValues.expirationDate);
    if (initialValues?.invalidationCondition) setInvalidationCondition(initialValues.invalidationCondition);
    if (initialValues?.reason) setReason(initialValues.reason);
  }, [initialValues, open]);

  // Sizing Math
  const numLimitPrice = parseFloat(limitPrice) || 0;
  const numStrike = parseFloat(strikePrice) || 0;
  const numUpperStrike = parseFloat(spreadUpperStrike) || 0;

  const estimatedRiskCents = useMemo(() => {
    if (expression === "shares") {
      return Math.round(shareCount * numLimitPrice * 0.05 * 100);
    }
    if (expression === "long_call" || expression === "long_put") {
      return Math.round(contracts * numLimitPrice * 100 * 100);
    }
    if (expression === "bull_call_spread" || expression === "bear_put_spread") {
      return Math.round(contracts * numLimitPrice * 100 * 100);
    }
    if (expression === "bull_put_credit_spread") {
      const width = Math.max(0, numUpperStrike - numStrike);
      const netRiskPerShare = Math.max(0, width - numLimitPrice);
      return Math.round(contracts * netRiskPerShare * 100 * 100);
    }
    return Math.round(contracts * 150 * 100);
  }, [expression, shareCount, contracts, numLimitPrice, numStrike, numUpperStrike]);

  const estimatedNotionalCents = useMemo(() => {
    if (expression === "shares") {
      return Math.round(shareCount * numLimitPrice * 100);
    }
    return Math.round(contracts * numLimitPrice * 100 * 100);
  }, [expression, shareCount, contracts, numLimitPrice]);

  // Account Capacity & Sizing Limits: the single-order limit is the server's
  // own headroom line for this account (#109). No client-side mandate math.
  const cockpitQuery = trpc.aperture.cockpit.useQuery(
    selectedAccount ? { accountId: selectedAccount.id } : undefined,
    { enabled: Boolean(selectedAccount), retry: false },
  );
  const headroom = cockpitQuery.data?.headroom as { lines?: CockpitHeadroomLine[]; equityCents?: number | null } | undefined;
  const serverEquityCents = headroom?.equityCents ?? null;
  const equityCents = serverEquityCents != null && serverEquityCents > 0 ? serverEquityCents : 0;
  const limit = singleOrderLimit(headroom?.lines, cockpitQuery.data?.mandate?.maxOrderNotionalCents ?? null, serverEquityCents);
  const singleOrderCeilingCents = limit.ceilingCents;
  const costPerUnitCents = expression === "shares"
    ? Math.round(numLimitPrice * 100)
    : Math.round(numLimitPrice * 100 * 100);
  const maxAllowableUnits = costPerUnitCents > 0 && singleOrderCeilingCents != null && singleOrderCeilingCents > 0
    ? Math.floor(singleOrderCeilingCents / costPerUnitCents)
    : 0;
  const autoFitCents = maxAllowableUnits * costPerUnitCents;
  const autoFitLabel = `Auto-Fit: ${maxAllowableUnits} (uses ${usdExact(autoFitCents)} of the ${limit.value} limit)`;
  const orderExceedsCeiling = singleOrderCeilingCents != null && estimatedNotionalCents > singleOrderCeilingCents;
  // One-company limit: the server's per-name ceiling plus the server's saved holdings (#109).
  const positionsQuery = trpc.aperture.account.getPositions.useQuery(
    { accountId: selectedAccount?.id ?? 0 },
    { enabled: Boolean(selectedAccount), retry: false },
  );
  const heldSymbolCents = positionsQuery.data
    ? positionsQuery.data
      .filter((p: { symbol: string }) => p.symbol.trim().toUpperCase() === symbol.trim().toUpperCase())
      .reduce((sum: number, p: { marketValueCents: number | null }) => sum + Math.abs(p.marketValueCents ?? 0), 0)
    : null;
  const nameCheck = singleNameCheck(headroom?.lines, symbol, heldSymbolCents, estimatedNotionalCents);
  const orderExceedsConcentration = positionsQuery.data != null && nameCheck.over;

  const buyingPowerCents = selectedAccount?.buyingPowerCents ?? 0;
  const hasBuyingPower = buyingPowerCents >= estimatedNotionalCents;
  const stagingBlocker = manualTicketBlocker({ expression, missionAccountId: activeMission?.accountId,
    accountId: selectedAccount?.id, runId: effectiveRunId, brokerId: selectedAccount?.brokerId,
    equityCents, notionalCents: estimatedNotionalCents, buyingPowerCents,
    exceedsLimit: orderExceedsCeiling || orderExceedsConcentration, acknowledgement: paperAck });

  const createOrder = trpc.aperture.order.create.useMutation({
    onSuccess: async (res) => {
      setStageError(null);
      onOpenChange(false);
      if (utils?.aperture) {
        await utils.aperture.invalidate();
      }
      const targetRunId = res.runId ?? effectiveRunId;
      const targetCandidateId = initialValues?.candidateId;
      const ticketUrl = targetRunId
        ? `/aperture/run/${targetRunId}/execute?order=${res.orderId}${targetCandidateId ? `&candidate=${targetCandidateId}` : ""}`
        : `/aperture/plays?stage=approve&inspect=${res.orderId}`;

      toast.success(`Staged paper order #${res.orderId} for ${symbol}`, {
        action: {
          label: "View ticket",
          onClick: () => {
            if (onStaged) {
              onStaged(res.orderId, targetRunId);
            } else {
              navigate(ticketUrl);
            }
          },
        },
      });

      if (onStaged) {
        onStaged(res.orderId, targetRunId);
      } else {
        navigate(ticketUrl);
      }
    },
    onError: (err) => {
      setStageError(err.message);
      toast.error("Order blocked by mandate guardrails", {
        description: "Review ceiling, concentration, or account constraints in the ticket.",
      });
    },
  });

  const ticketFields = React.useCallback((now: number) => ({
    accountId: selectedAccount?.id, symbol, expression, direction, shareCount, contracts, limitPrice, strikePrice,
    spreadUpperStrike, expirationDate, reason, invalidationCondition, holdingPeriod, catalystDays,
    notionalCents: estimatedNotionalCents, runId: effectiveRunId, candidateId: initialValues?.candidateId, now,
  }), [selectedAccount?.id, symbol, expression, direction, shareCount, contracts, limitPrice, strikePrice, spreadUpperStrike, expirationDate, reason, invalidationCondition, holdingPeriod, catalystDays, estimatedNotionalCents, effectiveRunId, initialValues?.candidateId]);

  const handleSubmit = async () => {
    setStageError(null);
    if (createOrder.isPending || stagingBlocker) {
      if (stagingBlocker) setStageError(stagingBlocker);
      return;
    }
    if (preflightNotReady) {
      setStageError(preflightChecking ? "Checking paper-order guardrails. Please wait." : "Fix the guardrail checks above before staging this ticket.");
      return;
    }
    if (!selectedAccount) {
      toast.error("Please select an active paper account.");
      return;
    }
    if (!symbol.trim()) {
      toast.error("Valid ticker symbol is required.");
      return;
    }
    if (paperAck !== "PAPER") {
      toast.error("Please confirm with PAPER acknowledgement.");
      return;
    }

    const built = buildManualTicketPayload(ticketFields(Date.now()));
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    createOrder.mutate(built.payload);
  };

  // Server guardrail preflight for the ticket being drafted (#118): the same
  // checklist and readiness meter as /aperture/run/:id/execute. Debounced, and
  // only the result for the current ticket is shown.
  // Minute-rounded clock keeps the fingerprint stable while typing.
  const preflightMinute = Math.floor(Date.now() / 60_000) * 60_000;
  const preflightBuilt = useMemo(() => buildManualTicketPayload(ticketFields(preflightMinute)), [ticketFields, preflightMinute]);
  const preflightTicket = preflightBuilt.ok ? preflightBuilt.payload : null;
  const preflightFingerprint = preflightTicket ? JSON.stringify(preflightTicket) : null;
  const [preflightInput, setPreflightInput] = useState<{ ticket: any; fingerprint: string } | null>(null);
  useEffect(() => {
    if (!open || !preflightTicket || !preflightFingerprint) { setPreflightInput(null); return; }
    const timer = window.setTimeout(() => setPreflightInput({ ticket: preflightTicket, fingerprint: preflightFingerprint }), 400);
    return () => window.clearTimeout(timer);
  }, [open, preflightFingerprint]);
  const preflightQuery = (trpc as any)?.aperture?.order?.preflight?.useQuery
    ? (trpc as any).aperture.order.preflight.useQuery(preflightInput?.ticket ?? preflightTicket ?? {}, { enabled: open && preflightInput != null, staleTime: 0, retry: false })
    : { data: undefined, isFetching: false };
  const preflightCurrent = preflightInput != null && preflightInput.fingerprint === preflightFingerprint;
  const preflightData = preflightCurrent ? preflightQuery.data : undefined;
  const preflightChecking = Boolean(preflightTicket) && (!preflightCurrent || preflightQuery.isFetching);
  const preflightNotReady = !preflightData?.evaluation || preflightData.wouldPass !== true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "var(--sh-surface)", borderColor: "var(--sh-border-1)" }}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-mono" style={{ borderColor: "var(--sh-signal)", color: "var(--sh-signal)" }}>
              Aperture Play Desk
            </Badge>
            <span className="text-xs font-mono" style={{ color: "var(--sh-fg-muted)" }}>
              Custom Paper Trade Builder
            </span>
          </div>
          <DialogTitle className="font-serif text-2xl flex items-center justify-between">
            <span>Create Custom Paper Trade</span>
            <span className="text-sm font-mono font-normal tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>
              {symbol} · {direction.toUpperCase()}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs leading-5">
            Set custom order terms. Portfolio safety limits and broker execution rules remain active.
          </DialogDescription>

          {activeMission ? (
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider shrink-0" style={{ borderColor: "var(--sh-signal)", color: "var(--sh-signal)" }}>
                  Active Mission
                </Badge>
                <span className="font-semibold truncate" style={{ color: "var(--sh-text-primary)" }}>
                  {activeMission.title}
                </span>
              </div>
              <span className="font-mono text-[11px] shrink-0" style={{ color: "var(--sh-fg-muted)" }}>
                Branch: {activeMission.effectiveBranch ?? "research"}
              </span>
            </div>
          ) : !deskSummary.isLoading ? (
            <div className="flex flex-col gap-2 rounded-md border p-3 text-xs" style={{ borderColor: "var(--sh-amber)", background: "color-mix(in srgb, var(--sh-amber) 10%, var(--sh-surface))" }}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-500">No Active Capital Mission Bound</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                    Every trade belongs to an active thesis. Open Capital Mission to set your strategy before staging.
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" variant="outline" className="h-7 text-xs font-semibold" onClick={() => { onOpenChange(false); navigate("/aperture/mission"); }}>
                  Open Capital Mission &rarr;
                </Button>
              </div>
            </div>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Top Parameters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--sh-fg-muted)" }}>
                Underlying Ticker
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. NVDA, VRT"
                className="w-full rounded border bg-transparent px-3 py-1.5 font-mono text-sm font-bold uppercase focus-visible:outline-none"
                style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--sh-fg-muted)" }}>
                Thesis Direction
              </label>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={direction === "long" ? "default" : "outline"}
                  onClick={() => setDirection("long")}
                  className="h-8 text-xs font-semibold"
                >
                  <TrendingUp className="mr-1 h-3.5 w-3.5" /> Long
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={direction === "short" ? "default" : "outline"}
                  onClick={() => setDirection("short")}
                  className="h-8 text-xs font-semibold"
                >
                  <TrendingDown className="mr-1 h-3.5 w-3.5" /> Short
                </Button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--sh-fg-muted)" }}>
                Execution Account
              </label>
              <select
                value={selectedAccount?.id ?? ""}
                onChange={(e) => {
                  userSelectedAccountRef.current = true;
                  setAccountId(Number(e.target.value));
                }}
                className="w-full rounded border bg-transparent px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none"
                style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}
              >
                {paperAccounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-popover text-foreground">
                    {a.label} {a.brokerId === "manual" ? "(Offline Ledger · No Broker)" : "(Alpaca Broker Rail)"} — ${Math.round((a.buyingPowerCents ?? 0) / 100).toLocaleString()} BP
                  </option>
                ))}
              </select>
              {selectedAccount?.brokerId === "manual" && (
                <p className="mt-1 text-[10px] leading-tight text-amber-400 font-mono">
                  Offline manual ledger — cannot route electronic option contracts. Use for equity tracking only, or select an Alpaca Paper account.
                </p>
              )}
            </div>
          </div>

          {/* Strategy / Expression Picker */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--sh-fg-muted)" }}>
              Structured Trade Expression
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXPRESSIONS.map((item) => {
                const isSelected = expression === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!["shares", "long_call", "long_put"].includes(item.id)}
                    title={!["shares", "long_call", "long_put"].includes(item.id) ? "Unavailable: this ticket supports single-leg orders only." : undefined}
                    onClick={() => {
                      setExpression(item.id);
                      if (item.id === "shares") {
                        if (limitPrice === "4.50" || limitPrice === "" || parseFloat(limitPrice) <= 5.0) {
                          setLimitPrice("25.00");
                        }
                      } else {
                        if (limitPrice === "25.00") {
                          setLimitPrice("4.50");
                        }
                      }
                    }}
                    className="flex flex-col text-left rounded-lg border p-2.5 transition-all focus-visible:outline-none"
                    style={{
                      borderColor: isSelected ? "var(--sh-signal)" : "var(--sh-border-1)",
                      background: isSelected ? "color-mix(in srgb, var(--sh-signal) 8%, var(--sh-surface))" : "var(--sh-surface-2)",
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold" style={{ color: "var(--sh-text-primary)" }}>
                        {item.label}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: isSelected ? "var(--sh-signal)" : "var(--sh-border-1)", color: isSelected ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>
                        {item.regime}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leg Sizing & Price Inputs */}
          <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--sh-border-1)" }}>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sh-text-primary)" }}>
                Ticket Construction · {expression.replaceAll("_", " ").toUpperCase()}
              </span>
              <span className="text-[11px] font-mono" style={{ color: "var(--sh-fg-muted)" }}>
                Horizon: {holdingPeriod}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {expression === "shares" ? (
                <>
                  <div className="min-w-0">
                    <label className="text-[10px] font-semibold uppercase block mb-1" style={{ color: "var(--sh-fg-muted)" }}>Shares Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={shareCount}
                      onChange={(e) => setShareCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded border bg-transparent px-2.5 py-1 text-xs font-mono font-bold"
                      style={{ borderColor: "var(--sh-border-1)" }}
                    />
                    {maxAllowableUnits > 0 && (
                      <button
                        type="button"
                        onClick={() => setShareCount(maxAllowableUnits)}
                        className="mt-1 flex w-full items-start gap-1 text-left text-[10px] leading-4 text-[var(--sh-signal)] hover:underline font-mono font-medium whitespace-normal break-words"
                        title={`Single-order limit ${limit.value} ÷ $${numLimitPrice.toFixed(2)} = ${maxAllowableUnits} whole shares`}
                      >
                        <Sparkles className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                        {autoFitLabel}
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase block mb-1" style={{ color: "var(--sh-fg-muted)" }}>Limit Price ($)</label>
                    <input
                      type="text"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className="w-full rounded border bg-transparent px-2.5 py-1 text-xs font-mono font-bold"
                      style={{ borderColor: "var(--sh-border-1)" }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0">
                    <label className="text-[10px] font-semibold uppercase block mb-1" style={{ color: "var(--sh-fg-muted)" }}>Contracts</label>
                    <input
                      type="number"
                      min="1"
                      value={contracts}
                      onChange={(e) => setContracts(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded border bg-transparent px-2.5 py-1 text-xs font-mono font-bold"
                      style={{ borderColor: "var(--sh-border-1)" }}
                    />
                    {maxAllowableUnits > 0 && (
                      <button
                        type="button"
                        onClick={() => setContracts(maxAllowableUnits)}
                        className="mt-1 flex w-full items-start gap-1 text-left text-[10px] leading-4 text-[var(--sh-signal)] hover:underline font-mono font-medium whitespace-normal break-words"
                        title={`Single-order limit ${limit.value} ÷ $${(costPerUnitCents / 100).toFixed(2)} = ${maxAllowableUnits} whole contracts`}
                      >
                        <Sparkles className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                        {autoFitLabel}
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase block mb-1" style={{ color: "var(--sh-fg-muted)" }}>Primary Strike ($)</label>
                    <input
                      type="text"
                      value={strikePrice}
                      onChange={(e) => setStrikePrice(e.target.value)}
                      className="w-full rounded border bg-transparent px-2.5 py-1 text-xs font-mono font-bold"
                      style={{ borderColor: "var(--sh-border-1)" }}
                    />
                  </div>
                  {expression.includes("spread") && (
                    <div>
                      <label className="text-[10px] font-semibold uppercase block mb-1" style={{ color: "var(--sh-fg-muted)" }}>Wing / Short Strike ($)</label>
                      <input
                        type="text"
                        value={spreadUpperStrike}
                        onChange={(e) => setSpreadUpperStrike(e.target.value)}
                        className="w-full rounded border bg-transparent px-2.5 py-1 text-xs font-mono font-bold"
                        style={{ borderColor: "var(--sh-border-1)" }}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-semibold uppercase block mb-1" style={{ color: "var(--sh-fg-muted)" }}>
                      {expression.includes("credit") ? "Net Credit ($)" : "Limit / Debit ($)"}
                    </label>
                    <input
                      type="text"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className="w-full rounded border bg-transparent px-2.5 py-1 text-xs font-mono font-bold"
                      style={{ borderColor: "var(--sh-border-1)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase block mb-1" style={{ color: "var(--sh-fg-muted)" }}>Expiry Date</label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full rounded border bg-transparent px-2 py-1 text-xs font-mono"
                      style={{ borderColor: "var(--sh-border-1)" }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Sizing & Headroom Telemetry */}
            <div className="pt-2 border-t text-xs font-mono space-y-2" style={{ borderColor: "var(--sh-border-1)" }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span style={{ color: "var(--sh-fg-muted)" }}>Est. Max Risk: </span>
                  <strong style={{ color: "var(--sh-red)" }}>${Math.round(estimatedRiskCents / 100).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--sh-fg-muted)" }}>Capital Required: </span>
                  <strong style={{ color: "var(--sh-text-primary)" }}>${Math.round(estimatedNotionalCents / 100).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--sh-fg-muted)" }}>Single-Order Limit: </span>
                  <strong style={{ color: orderExceedsCeiling ? "var(--sh-red)" : "var(--sh-emerald)" }}>
                    {limit.value}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--sh-fg-muted)" }}>Buying Power: </span>
                  <strong style={{ color: hasBuyingPower ? "var(--sh-emerald)" : "var(--sh-red)" }}>
                    {hasBuyingPower ? "PASSED" : "EXCEEDED"}
                  </strong>
                </div>
              </div>

              <p className="text-[11px] leading-5" style={{ color: "var(--sh-fg-muted)", fontFamily: "inherit" }}>Single-order limit: {limit.explanation}</p>
              <p className="text-[11px] leading-5" style={{ color: "var(--sh-fg-muted)", fontFamily: "inherit" }}>{nameCheck.explanation}</p>
              {orderExceedsConcentration && nameCheck.warning && (
                <div role="alert" data-single-name-warning className="border p-1.5 text-[11px] flex items-center gap-1.5" style={{ borderColor: "var(--sh-red)", color: "var(--sh-text-primary)", background: "var(--sh-surface)" }}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-red)" }} />
                  <span>{nameCheck.warning}</span>
                </div>
              )}
              {orderExceedsCeiling && (
                <div className="rounded p-1.5 text-[11px] bg-red-950/40 border border-red-900/60 text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>Order (${Math.round(estimatedNotionalCents / 100).toLocaleString()}) is over this account's single-order limit ({limit.value}).</span>
                </div>
              )}

              {/* Defined-Risk Spread Recommendation */}
              {expression !== "shares" && singleOrderCeilingCents != null && costPerUnitCents > singleOrderCeilingCents && singleOrderCeilingCents > 0 && (
                <div className="rounded p-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border" style={{ borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 12%, var(--sh-surface))" }}>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[11px] flex items-center gap-1" style={{ color: "var(--sh-signal)" }}>
                      <AlertTriangle className="h-3.5 w-3.5" /> This contract exceeds the recorded limit
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>
                      One contract costs ${(costPerUnitCents / 100).toFixed(0)} against a {limit.value} limit. Choose another verified contract or preserve cash. Multi-leg orders are unavailable here; no spread price is assumed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Governance & Preflight Invalidation */}
          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--sh-fg-muted)" }}>
                Invalidation & Exit Condition
              </label>
              <input
                type="text"
                value={invalidationCondition}
                onChange={(e) => setInvalidationCondition(e.target.value)}
                placeholder="Trigger condition to abort thesis..."
                className="w-full rounded border bg-transparent px-3 py-1.5 text-xs focus-visible:outline-none"
                style={{ borderColor: "var(--sh-border-1)" }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>
                  Confirmation (Simulated Paper Trading)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] font-mono border-[var(--sh-signal)] text-[var(--sh-signal)] hover:bg-[var(--sh-burnt-amber-10)]"
                  disabled
                >
                  Type confirmation below
                </Button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={paperAck}
                  onChange={(e) => setPaperAck(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="PAPER"
                  className="w-28 rounded border bg-transparent px-3 py-1 font-mono text-xs font-bold uppercase focus-visible:outline-none"
                  style={{ borderColor: paperAck === "PAPER" ? "var(--sh-signal)" : "var(--sh-border-1)" }}
                />
                <span className="text-xs flex items-center" style={{ color: "var(--sh-fg-muted)" }}>
                  Staging creates a practice ticket, not a fill. Approval and broker submission remain separate.
                </span>
              </div>
            </div>
          </div>

          {stageError && (
            <div className="rounded-lg border p-3.5 text-xs flex flex-col gap-2.5" style={{ borderColor: "var(--sh-red)", background: "color-mix(in srgb, var(--sh-red) 12%, var(--sh-surface))" }}>
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-400 text-sm">Trade Safety Suggestions</p>
                  <p className="text-[11px] leading-4 mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>
                    Please review these suggestions to align with your portfolio safety limits:
                  </p>
                  <ul className="mt-2 space-y-1.5 pl-1">
                    {parsedErrors.map((err, i) => (
                      <li key={i} className="flex items-start gap-2 font-mono text-[11px] leading-4" style={{ color: "var(--sh-text-primary)" }}>
                        <span className="text-red-400 font-bold shrink-0">&bull;</span>
                        <span className="break-words">{err}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {stageError.includes("manual portfolio") && (
                <div className="flex justify-end pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs font-semibold" onClick={() => {
                    const alpaca = paperAccounts.find((a) => a.brokerId === "alpaca_paper");
                    if (alpaca) {
                      userSelectedAccountRef.current = true;
                      setAccountId(alpaca.id);
                    }
                  }}>
                    Switch to Alpaca Paper Broker &rarr;
                  </Button>
                </div>
              )}
              {stageError.includes("Capital Mission") && (
                <div className="flex justify-end pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs font-semibold" onClick={() => { onOpenChange(false); navigate("/aperture/mission"); }}>
                    Go to Capital Mission &rarr;
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <GuardrailChecklist evaluation={preflightData?.evaluation} checking={preflightChecking} checkedAt={preflightData?.evaluation?.evaluatedAt ?? null} />
        {preflightCurrent && (preflightQuery as any).error && <p role="status" className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>Guardrail check could not run: {(preflightQuery as any).error.message}. Nothing has been staged.</p>}
        {stagingBlocker && <p role="status" className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>{stagingBlocker}</p>}
        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={createOrder.isPending || Boolean(stagingBlocker) || preflightNotReady}
            onClick={handleSubmit}
            className="min-h-10 px-4 font-semibold"
          >
            {createOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Stage Paper Order on Desk (${Math.round(estimatedNotionalCents / 100).toLocaleString()})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
