import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { buildOccOptionSymbol, nextStandardMonthlyOptionExpiration } from "@shared/paperInstrument";
import { TrendingDown, TrendingUp, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import type { AttentionMission } from "@shared/apertureAttention";

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

  const runsQuery = (trpc as any)?.aperture?.run?.list?.useQuery
    ? trpc.aperture.run.list.useQuery(undefined, { enabled: !initialValues?.runId && !activeMission?.researchRunId })
    : { data: undefined };
  const effectiveRunId = initialValues?.runId ?? activeMission?.researchRunId ?? runsQuery.data?.[0]?.id;

  const paperAccounts = useMemo(() => {
    return (accountsQuery.data ?? []).filter((a) => a.isPaper);
  }, [accountsQuery.data]);

  const defaultAccount = useMemo(() => {
    if (activeMission?.accountId) {
      const missionAccount = paperAccounts.find((a) => a.id === activeMission.accountId);
      if (missionAccount) return missionAccount;
    }
    // Prioritize declared UAT $2,000 account if present
    return paperAccounts.find((a) => a.id === 60001 || a.label?.toLowerCase().includes("uat") || a.label?.includes("$2,000"))
      ?? paperAccounts.find((a) => a.brokerId === "alpaca_paper")
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
  const [shareCount, setShareCount] = useState<number>(4);
  const [contracts, setContracts] = useState<number>(1);
  const [limitPrice, setLimitPrice] = useState<string>(
    initialValues?.limitPrice ?? (initialValues?.expression === "shares" ? "25.00" : "4.50")
  );
  const [strikePrice, setStrikePrice] = useState<string>(initialValues?.strikePrice ?? "150.00");
  const [spreadUpperStrike, setSpreadUpperStrike] = useState<string>("160.00");
  const [expirationDate, setExpirationDate] = useState<string>(() => {
    try {
      return nextStandardMonthlyOptionExpiration(Date.now(), 20);
    } catch {
      return new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    }
  });

  const [catalystDays, setCatalystDays] = useState<number>(14);
  const [invalidationCondition, setInvalidationCondition] = useState<string>(
    "Underlying closes below 20-day moving average or catalyst thesis fails to materialize."
  );
  const [reason, setReason] = useState<string>(
    "Ad-hoc manual play staged from Aperture Play Desk to express strategic conviction."
  );
  const [paperAck, setPaperAck] = useState<string>("PAPER");

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
    if (initialValues?.limitPrice) {
      setLimitPrice(initialValues.limitPrice);
    } else if (initialValues?.expression === "shares") {
      setLimitPrice("25.00");
    }
    if (initialValues?.strikePrice) {
      setStrikePrice(initialValues.strikePrice);
    }
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

  // Account Capacity & Sizing Limits
  const rawEquityCents = selectedAccount?.equityValueCents ?? 0;
  // If account has 0 or unrecorded equity, fall back to $2,000 UAT NAV so safety ceilings still bind
  const equityCents = rawEquityCents > 0 ? rawEquityCents : 200_000;
  const singleOrderCeilingCents = Math.min(10_000_00, Math.round(equityCents * 0.05));
  const singleNameCapCents = Math.round(equityCents * 0.10);
  const effectiveCeilingCents = Math.min(singleOrderCeilingCents, singleNameCapCents);
  const costPerUnitCents = expression === "shares"
    ? Math.round(numLimitPrice * 100)
    : Math.round(numLimitPrice * 100 * 100);
  const maxAllowableUnits = costPerUnitCents > 0 && effectiveCeilingCents > 0
    ? Math.floor(effectiveCeilingCents / costPerUnitCents)
    : 0;
  const orderExceedsCeiling = equityCents > 0 && estimatedNotionalCents > singleOrderCeilingCents;
  const orderExceedsConcentration = equityCents > 0 && estimatedNotionalCents > singleNameCapCents;
  const concentrationPct = equityCents > 0 ? Math.round((estimatedNotionalCents / equityCents) * 100) : 0;

  const buyingPowerCents = selectedAccount?.buyingPowerCents ?? 0;
  const hasBuyingPower = buyingPowerCents >= estimatedNotionalCents;

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

  const handleSubmit = async () => {
    setStageError(null);
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

    const cleanSymbol = symbol.trim().toUpperCase();
    const isOption = expression !== "shares";

    let contractSymbol: string = cleanSymbol;
    let finalInstrumentType: "shares" | "long_call" | "long_put" = "shares";

    if (isOption) {
      const optionType = expression === "long_put" || expression === "bear_put_spread" ? "put" : "call";
      finalInstrumentType = optionType === "put" ? "long_put" : "long_call";
      const strikeCents = Math.round(numStrike * 100);

      const generatedOcc = buildOccOptionSymbol({
        underlyingSymbol: cleanSymbol,
        expirationDate,
        optionType,
        strikePriceCents: strikeCents,
      });

      if (!generatedOcc) {
        toast.error("Could not construct standard OCC option symbol. Check strike and expiration format.");
        return;
      }
      contractSymbol = generatedOcc;
    }

    const structuredReason = `[${expression.toUpperCase()} EXPR] ${reason} · Target: $${numUpperStrike || numStrike} · Structure: ${expression.replaceAll("_", " ")}`;

    createOrder.mutate({
      accountId: selectedAccount.id,
      symbol: contractSymbol,
      underlyingSymbol: isOption ? cleanSymbol : undefined,
      instrumentType: finalInstrumentType,
      optionExpirationDate: isOption ? expirationDate : undefined,
      optionStrikePriceCents: isOption ? Math.round(numStrike * 100) : undefined,
      contractMultiplier: isOption ? 100 : undefined,
      side: direction === "long" ? "buy" : "sell",
      intent: "open",
      qty: isOption ? contracts : shareCount,
      notionalCents: !isOption ? estimatedNotionalCents : undefined,
      orderType: "limit",
      limitPriceCents: Math.round(numLimitPrice * 100),
      timeInForce: "day",
      reason: structuredReason,
      invalidationCondition: invalidationCondition || "Break of structural support or catalyst expiry",
      holdingPeriod,
      catalystDeadlineAt: Date.now() + catalystDays * 86_400_000,
      paperAcknowledgement: "PAPER",
      runId: effectiveRunId,
      candidateId: initialValues?.candidateId,
    });
  };

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
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold uppercase" style={{ color: "var(--sh-fg-muted)" }}>Shares Qty</label>
                      {maxAllowableUnits > 0 && (
                        <button
                          type="button"
                          onClick={() => setShareCount(maxAllowableUnits)}
                          className="text-[9px] text-emerald-400 hover:underline flex items-center gap-1 font-mono font-medium"
                          title={`5% Single-Order Ceiling ($${Math.round(singleOrderCeilingCents / 100)}) ÷ $${numLimitPrice.toFixed(2)} = ${maxAllowableUnits} shares`}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          Auto-Fit: {maxAllowableUnits} (max ${Math.round((maxAllowableUnits * costPerUnitCents) / 100)})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={shareCount}
                      onChange={(e) => setShareCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded border bg-transparent px-2.5 py-1 text-xs font-mono font-bold"
                      style={{ borderColor: "var(--sh-border-1)" }}
                    />
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
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold uppercase" style={{ color: "var(--sh-fg-muted)" }}>Contracts</label>
                      {maxAllowableUnits > 0 && (
                        <button
                          type="button"
                          onClick={() => setContracts(maxAllowableUnits)}
                          className="text-[9px] text-emerald-400 hover:underline flex items-center gap-1 font-mono font-medium"
                          title={`5% Single-Order Ceiling ($${Math.round(singleOrderCeilingCents / 100)}) ÷ $${(costPerUnitCents / 100).toFixed(2)} = ${maxAllowableUnits} contracts`}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          Auto-Fit: {maxAllowableUnits} (max ${Math.round((maxAllowableUnits * costPerUnitCents) / 100)})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={contracts}
                      onChange={(e) => setContracts(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded border bg-transparent px-2.5 py-1 text-xs font-mono font-bold"
                      style={{ borderColor: "var(--sh-border-1)" }}
                    />
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
                    ${Math.round(singleOrderCeilingCents / 100).toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--sh-fg-muted)" }}>Buying Power: </span>
                  <strong style={{ color: hasBuyingPower ? "var(--sh-emerald)" : "var(--sh-red)" }}>
                    {hasBuyingPower ? "PASSED" : "EXCEEDED"}
                  </strong>
                </div>
              </div>

              {orderExceedsCeiling && (
                <div className="rounded p-1.5 text-[11px] bg-red-950/40 border border-red-900/60 text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>Order (${Math.round(estimatedNotionalCents / 100).toLocaleString()}) exceeds the 5% single-order ceiling (${Math.round(singleOrderCeilingCents / 100).toLocaleString()}) for this account.</span>
                </div>
              )}
              {orderExceedsConcentration && (
                <div className="rounded p-1.5 text-[11px] bg-red-950/40 border border-red-900/60 text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>Order represents {concentrationPct}% of total equity, exceeding the 10% single-name cap (${Math.round(singleNameCapCents / 100).toLocaleString()}).</span>
                </div>
              )}

              {/* Defined-Risk Spread Recommendation */}
              {expression !== "shares" && costPerUnitCents > effectiveCeilingCents && effectiveCeilingCents > 0 && (
                <div className="rounded p-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border" style={{ borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 12%, var(--sh-surface))" }}>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[11px] flex items-center gap-1" style={{ color: "var(--sh-signal)" }}>
                      <Sparkles className="h-3.5 w-3.5" /> Defined-Risk Spread Auto-Solution
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>
                      1 naked contract (${(costPerUnitCents / 100).toFixed(0)}) breaches the ${(effectiveCeilingCents / 100).toFixed(0)} limit. Convert to a defined-risk vertical debit spread ($0.80 debit = $80 max risk) to fit account bounds.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs font-medium shrink-0 text-white"
                    style={{ background: "var(--sh-signal)" }}
                    onClick={() => {
                      setExpression(direction === "short" ? "bear_put_spread" : "bull_call_spread");
                      const curStrike = numStrike > 0 ? numStrike : 100;
                      setStrikePrice(curStrike.toString());
                      setSpreadUpperStrike((curStrike + 5).toString());
                      setLimitPrice("0.80");
                      setContracts(1);
                    }}
                  >
                    ⚡ Apply Vertical Spread ($80 Risk)
                  </Button>
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
                  className="h-6 text-[10px] font-mono border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => setPaperAck("PAPER")}
                >
                  ⚡ Fast-Fill PAPER (⌘+Enter)
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
                      setPaperAck("PAPER");
                      handleSubmit();
                    }
                  }}
                  placeholder="PAPER"
                  className="w-28 rounded border bg-transparent px-3 py-1 font-mono text-xs font-bold uppercase focus-visible:outline-none"
                  style={{ borderColor: paperAck === "PAPER" ? "var(--sh-signal)" : "var(--sh-border-1)" }}
                />
                <span className="text-xs flex items-center" style={{ color: "var(--sh-fg-muted)" }}>
                  Safe simulation: this paper order stages on your desk. No real money is at risk. Press ⌘+Enter to instant-stage.
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

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={createOrder.isPending || paperAck !== "PAPER" || !hasBuyingPower}
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
