import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleSlash2, ClipboardCheck, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { buildProposalReadiness } from "@shared/proposalReadiness";
import { dollarsToCents } from "@shared/proposalTicketFields";
import { buildOccOptionSymbol, isOptionInstrument, nextStandardMonthlyOptionExpiration, paperInstrumentLabel, type PaperInstrumentType } from "@shared/paperInstrument";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PriceRiskVisual } from "@/components/aperture/PriceRiskVisual";

type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window" | "position";

const HARD_PREFLIGHT_GATE_KEYS = new Set([
  "liquidity_adv_floor",
  "liquidity_floor",
  "liquidity_participation",
  "paper_account",
  "paper_execution_destination",
  "external_paper_account_binding",
  "execution_account_freshness",
  "portfolio_context_freshness",
  "broker_available",
  "long_option_capability",
  "options_entitlement",
  "option_chain_market_evidence",
  "option_limit_vs_market",
  "market_session_known",
  "market_open",
  "intraday_requires_regular_session",
  "intraday_cutoff",
]);

const RISK_CEILING_GATE_KEYS = new Set([
  "planned_risk_per_play",
  "daily_planned_risk",
  "correlated_planned_risk",
  "order_notional_ceiling",
  "position_concentration",
  "cluster_concentration",
]);

const money = (cents: number | null | undefined) => cents == null
  ? "Not modeled"
  : new Intl.NumberFormat(navigator.language, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

const price = (cents: number | null | undefined) => cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;

function toLocalDateTimeInputValue(epochMs: number): string {
  const date = new Date(epochMs);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function safeHoldingPeriod(value: unknown): HoldingPeriod {
  return ["intraday", "overnight", "swing", "catalyst_window", "position"].includes(String(value)) ? value as HoldingPeriod : "swing";
}

function holdingPeriodLabel(value: HoldingPeriod) {
  return value === "intraday" ? "Today" : value === "overnight" ? "Next close" : value === "swing" ? "This week" : value === "catalyst_window" ? "Named catalyst" : "Long term";
}

export function PaperProposalForm({ runId, candidate, account, run, onReturnToBrief, onReturnToDecisionBrief, onProposalCreated, onCashPreserved }: {
  runId: number; candidate: any; account: any; run: any; onReturnToBrief: () => void; onReturnToDecisionBrief: () => void; onProposalCreated: (result: { orderId: number; created: boolean }) => void; onCashPreserved: () => void;
}) {
  const suggestedCents = candidate?.suggestedSizeLowCents ?? 100_000;
  const [notionalDollars, setNotionalDollars] = useState(String(Math.max(100, Math.round(suggestedCents / 100))));
  const [riskBudgetDollars, setRiskBudgetDollars] = useState("");
  const [entryDollars, setEntryDollars] = useState("");
  const [stopDollars, setStopDollars] = useState("");
  const [slippageDollars, setSlippageDollars] = useState("0");
  const [optionPremiumDollars, setOptionPremiumDollars] = useState("");
  const [optionSlippageDollars, setOptionSlippageDollars] = useState("0");
  const [reason, setReason] = useState(`Paper-only proposal based on recorded human review of ${candidate?.symbol ?? "this"} research evidence.`);
  const [invalidationCondition, setInvalidationCondition] = useState(run?.invalidationRule ?? "Do not proceed, or exit the paper position, if the thesis evidence no longer supports the decision.");
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>(() => safeHoldingPeriod(run?.holdingPeriod));
  const [deadline, setDeadline] = useState(() => toLocalDateTimeInputValue(run?.catalystDeadlineAt ?? Date.now() + 7 * 86_400_000));
  const [timeStop, setTimeStop] = useState(() => toLocalDateTimeInputValue(run?.catalystDeadlineAt ?? Date.now() + 6 * 3_600_000));
  const [noTradeText, setNoTradeText] = useState("");
  const [paperAcknowledgement, setPaperAcknowledgement] = useState("");
  const [preflightInput, setPreflightInput] = useState<{ ticket: any; fingerprint: string } | null>(null);
  const [recipePrefilled, setRecipePrefilled] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [destinationAccountId, setDestinationAccountId] = useState<number | null>(null);
  const [instrumentType, setInstrumentType] = useState<PaperInstrumentType>(() => run?.instrumentPreference === "options" ? (candidate?.playSide === "short" ? "long_put" : "long_call") : "shares");
  const [optionExpirationDate, setOptionExpirationDate] = useState(() => nextStandardMonthlyOptionExpiration());
  const [optionStrikeDollars, setOptionStrikeDollars] = useState("");
  const [contracts, setContracts] = useState("1");
  const allowedInstrumentTypes: PaperInstrumentType[] = run?.instrumentPreference === "options"
    ? ["long_call", "long_put"]
    : run?.instrumentPreference === "shares"
      ? ["shares"]
      : ["shares", "long_call", "long_put"];
  // This form only prepares a new research-backed paper position. Closing an
  // existing position belongs to its own account-position flow, where the held
  // quantity and closing side can be proven before we state intent: "close".
  const orderIntent = "open" as const;
  const acknowledgementRef = useRef<HTMLInputElement>(null);
  const expirationRef = useRef<HTMLInputElement>(null);
  const strikeRef = useRef<HTMLInputElement>(null);
  const contractsRef = useRef<HTMLInputElement>(null);
  const premiumRef = useRef<HTMLInputElement>(null);
  const contractPickerRef = useRef<HTMLElement>(null);
  const accountsQuery = trpc.aperture.account.list.useQuery();
  const executionAccounts = (accountsQuery.data ?? []).filter((item) => item.isPaper && ["alpaca_paper", "uat_paper"].includes(item.brokerId) && item.externalAccountId);
  const destinationAccount = executionAccounts.find((item) => item.id === destinationAccountId) ?? null;
  const isOption = isOptionInstrument(instrumentType);
  const utils = trpc.useUtils();
  const constructed = trpc.aperture.play.construct.useQuery({ runId, candidateId: candidate?.id ?? 0 }, { enabled: !!candidate?.id, staleTime: 30_000 });
  const create = trpc.aperture.order.create.useMutation({
    onSuccess: async (result) => {
      await utils.aperture.order.list.invalidate({ runId });
      toast.success(result.created
        ? "Paper proposal created. It is waiting for your separate approval."
        : "This paper proposal already exists. Opening the waiting ticket.");
      onProposalCreated(result);
    },
    onError: (error) => toast.error(error.message),
  });
  const preserveCash = trpc.aperture.play.decide.useMutation({
    onSuccess: async () => {
      await utils.aperture.play.list.invalidate();
      toast.success(`${candidate?.symbol ?? "Play"} preserved as cash. No proposal or order was created.`);
      onCashPreserved();
    },
    onError: (error) => toast.error(error.message),
  });
  const constructedPlay = constructed.data?.play;
  const optionChain = trpc.aperture.order.optionChain.useQuery({
    accountId: destinationAccount?.id ?? 0,
    underlyingSymbol: candidate?.symbol ?? "",
    expirationDate: optionExpirationDate,
    type: instrumentType === "long_put" ? "put" : "call",
    targetPriceCents: constructedPlay?.entry?.priceCents ?? undefined,
  }, {
    enabled: Boolean(isOption && destinationAccount?.id && candidate?.symbol && /^\d{4}-\d{2}-\d{2}$/.test(optionExpirationDate)),
    staleTime: 30_000,
    retry: false,
  });
  const recipeCanPrepare = constructedPlay?.readiness === "constructed";
  const portfolioImpactReady = !isOption && recipeCanPrepare
    && constructedPlay?.qty != null
    && constructedPlay?.notionalCents != null
    && constructedPlay?.plannedLossCents != null
    && constructedPlay?.plannedLossPctOfEquity != null;

  useEffect(() => {
    if (isOption || !candidate || !constructedPlay || recipePrefilled || !recipeCanPrepare) return;
    setRiskBudgetDollars(constructedPlay.budgetCents == null ? "" : (constructedPlay.budgetCents / 100).toFixed(2));
    setEntryDollars(constructedPlay.entry == null ? "" : (constructedPlay.entry.priceCents / 100).toFixed(2));
    setStopDollars(constructedPlay.stop == null ? "" : (constructedPlay.stop.priceCents / 100).toFixed(2));
    setSlippageDollars(constructedPlay.slippage == null ? "" : (constructedPlay.slippage.priceCents / 100).toFixed(2));
    setNotionalDollars(constructedPlay.notionalCents == null ? "" : (constructedPlay.notionalCents / 100).toFixed(2));
    setTimeStop(constructedPlay.timeStopAt == null ? "" : toLocalDateTimeInputValue(constructedPlay.timeStopAt));
    setNoTradeText(constructedPlay.noTradeConditions.join("\n"));
    setReason(`Modeled ${constructedPlay.side} paper recipe for ${candidate.symbol}; confirm every derived level against a real-time terminal before human approval.`);
    setRecipePrefilled(true);
  }, [candidate?.symbol, constructedPlay, isOption, recipeCanPrepare, recipePrefilled]);

  useEffect(() => {
    if (paperAcknowledgement === "PAPER") setShowDetails(false);
  }, [paperAcknowledgement]);

  useEffect(() => {
    if (destinationAccountId != null) return;
    const preferred = executionAccounts.find((item) => item.id === account?.id) ?? executionAccounts[0];
    if (preferred) setDestinationAccountId(preferred.id);
  }, [account?.id, destinationAccountId, executionAccounts.map((item) => item.id).join(",")]);

  const isIntraday = holdingPeriod === "intraday";
  const entryPriceCents = dollarsToCents(isOption ? optionPremiumDollars : entryDollars);
  const stopPriceCents = dollarsToCents(stopDollars);
  const slippageCents = dollarsToCents(isOption ? optionSlippageDollars : slippageDollars, { allowZero: true });
  const riskBudgetCents = dollarsToCents(riskBudgetDollars);
  const optionStrikePriceCents = dollarsToCents(optionStrikeDollars);
  const optionQty = Number(contracts);
  const optionContractSymbol = useMemo(() => isOption && optionStrikePriceCents != null ? buildOccOptionSymbol({
    underlyingSymbol: candidate?.symbol ?? "",
    expirationDate: optionExpirationDate,
    optionType: instrumentType === "long_call" ? "call" : "put",
    strikePriceCents: optionStrikePriceCents,
  }) : null, [candidate?.symbol, instrumentType, isOption, optionExpirationDate, optionStrikePriceCents]);
  const optionMaxLossCents = isOption && Number.isInteger(optionQty) && optionQty > 0 && entryPriceCents != null && slippageCents != null
    ? optionQty * 100 * (entryPriceCents + slippageCents)
    : null;
  const optionTermsReady = Boolean(isOption && optionContractSymbol && Number.isInteger(optionQty) && optionQty > 0 && entryPriceCents != null && slippageCents != null);
  const optionExpirationAt = Date.parse(`${optionExpirationDate}T20:00:00Z`);
  const optionTicketMissing = isOption ? [
    ...(!Number.isFinite(optionExpirationAt) || optionExpirationAt <= Date.now() ? ["future expiration"] : []),
    ...(optionStrikePriceCents == null ? ["strike price"] : []),
    ...(!Number.isInteger(optionQty) || optionQty <= 0 ? ["whole contract quantity"] : []),
    ...(entryPriceCents == null ? ["limit premium"] : []),
    ...(!optionContractSymbol && optionStrikePriceCents != null && Number.isFinite(optionExpirationAt) && optionExpirationAt > Date.now() ? ["valid underlying ticker"] : []),
  ] : [];
  const intradaySizing = useMemo(() => {
    if (!isIntraday || entryPriceCents == null || stopPriceCents == null || slippageCents == null || riskBudgetCents == null) return null;
    const riskPerShareCents = Math.abs(entryPriceCents - stopPriceCents) + slippageCents;
    if (riskPerShareCents <= 0) return null;
    const qty = Math.floor(riskBudgetCents / riskPerShareCents);
    return qty > 0 ? { qty, plannedRiskCents: qty * riskPerShareCents, notionalCents: qty * entryPriceCents } : null;
  }, [entryPriceCents, isIntraday, riskBudgetCents, slippageCents, stopPriceCents]);

  const ticket = useMemo(() => {
    const deadlineAt = new Date(deadline).getTime();
    const timeStopAt = new Date(timeStop).getTime();
    const statedNotionalCents = Math.round(Number(notionalDollars) * 100);
    const noTradeConditions = noTradeText.split("\n").map((condition) => condition.trim()).filter(Boolean);
    return {
      runId, candidateId: candidate?.id, accountId: destinationAccount?.id ?? 0, portfolioContextAccountId: account?.id ?? undefined,
      symbol: isOption ? optionContractSymbol ?? "" : candidate?.symbol ?? "",
      instrumentType,
      underlyingSymbol: isOption ? candidate?.symbol : undefined,
      optionExpirationDate: isOption ? optionExpirationDate : undefined,
      optionStrikePriceCents: isOption ? optionStrikePriceCents ?? undefined : undefined,
      contractMultiplier: isOption ? 100 : undefined,
      side: isOption ? "buy" as const : candidate?.playSide === "short" ? "sell" as const : "buy" as const,
      intent: orderIntent,
      qty: isOption ? optionQty : isIntraday ? intradaySizing?.qty : undefined,
      notionalCents: !isOption && !isIntraday && Number.isFinite(statedNotionalCents) && statedNotionalCents > 0 ? statedNotionalCents : undefined,
      orderType: isOption || isIntraday ? "limit" as const : "market" as const,
      limitPriceCents: (isOption || isIntraday) && entryPriceCents != null ? entryPriceCents : undefined,
      timeInForce: "day" as const, reason: reason || undefined, invalidationCondition: invalidationCondition || undefined,
      entryPriceCents: (isOption || isIntraday) && entryPriceCents != null ? entryPriceCents : undefined,
      stopPriceCents: !isOption && isIntraday && stopPriceCents != null ? stopPriceCents : undefined,
      slippageCents: (isOption || isIntraday) && slippageCents != null ? slippageCents : undefined,
      timeStopAt: isIntraday && Number.isFinite(timeStopAt) ? timeStopAt : undefined,
      noTradeConditions: noTradeConditions.length ? noTradeConditions : undefined,
      holdingPeriod, catalystDeadlineAt: Number.isFinite(deadlineAt) ? deadlineAt : undefined, paperAcknowledgement: paperAcknowledgement || undefined,
    };
  }, [account?.id, candidate?.id, candidate?.symbol, contracts, deadline, destinationAccount?.id, entryPriceCents, holdingPeriod, instrumentType, invalidationCondition, intradaySizing?.qty, isIntraday, isOption, noTradeText, notionalDollars, optionContractSymbol, optionExpirationDate, optionQty, optionStrikePriceCents, orderIntent, paperAcknowledgement, reason, runId, slippageCents, stopPriceCents, timeStop]);

  // Preflight answers whether the fully acknowledged ticket would clear every
  // other guardrail. The operator still has to type PAPER before proposal
  // creation; simulating it here avoids a circular UI where the acknowledgement
  // field is hidden until a preflight that cannot pass without it.
  const preflightTicket = useMemo(() => ({ ...ticket, paperAcknowledgement: "PAPER" }), [ticket]);
  const preflightTicketFingerprint = useMemo(() => JSON.stringify(preflightTicket), [preflightTicket]);
  const preflightEnabled = Boolean(account && destinationAccount && candidate && (isOption ? optionTermsReady : recipeCanPrepare));

  useEffect(() => {
    if (!preflightEnabled) { setPreflightInput(null); return; }
    const timer = window.setTimeout(() => setPreflightInput({ ticket: preflightTicket, fingerprint: preflightTicketFingerprint }), 400);
    return () => window.clearTimeout(timer);
  }, [preflightEnabled, preflightTicket, preflightTicketFingerprint]);
  const preflight = trpc.aperture.order.preflight.useQuery(preflightInput?.ticket ?? preflightTicket, { enabled: preflightInput != null, staleTime: 0, retry: false });
  const preflightMatchesTicket = preflightInput?.fingerprint === preflightTicketFingerprint;
  const currentPreflightData = preflightMatchesTicket ? preflight.data : undefined;
  const hardPreflightResult = (currentPreflightData?.evaluation.results ?? []).find((result) => !result.passed && HARD_PREFLIGHT_GATE_KEYS.has(result.key));
  const riskCeilingResult = (currentPreflightData?.evaluation.results ?? []).find((result) => !result.passed && RISK_CEILING_GATE_KEYS.has(result.key));
  const preflightBusy = preflightEnabled && (preflightInput == null || !preflightMatchesTicket || preflight.isFetching);
  const optionEvidenceBlocked = isOption && ["option_chain_market_evidence", "option_contract_verified"].includes(hardPreflightResult?.key ?? "");
  const optionChainItems = optionChain.data?.items ?? [];
  const optionChainHasSelectableContract = optionChainItems.some((item) => item.quoteReady);
  const optionResolutionNeeded = isOption && (optionEvidenceBlocked || (optionChain.isFetched && !optionChainHasSelectableContract));
  const riskResolutionNeeded = isOption && riskCeilingResult != null;
  const riskCeilingCents = riskCeilingResult?.key === "planned_risk_per_play"
    && optionMaxLossCents != null
    && riskCeilingResult.observed != null
    && riskCeilingResult.observed > 0
    && riskCeilingResult.ceiling != null
      ? Math.floor(optionMaxLossCents * riskCeilingResult.ceiling / riskCeilingResult.observed)
      : null;
  const selectQuotedContract = (item: (typeof optionChainItems)[number]) => {
    setOptionStrikeDollars((item.contract.strikePriceCents / 100).toFixed(2));
    if (item.market?.askPriceCents != null) setOptionPremiumDollars((item.market.askPriceCents / 100).toFixed(2));
    setPaperAcknowledgement("");
  };
  const retryOptionEvidence = async () => {
    await optionChain.refetch();
    if (preflightEnabled) await preflight.refetch();
  };
  const preserveCashReason = `${candidate?.symbol ?? "This play"} preserved as cash — current option quote/liquidity evidence unavailable for the selected contract. No proposal or order was created.`;
  const preserveRiskCashReason = `${candidate?.symbol ?? "This play"} preserved as cash — the selected option ticket exceeded the current paper-account risk ceiling. No proposal or order was created.`;
  const readiness = buildProposalReadiness({
    recipeReady: isOption ? true : recipeCanPrepare,
    unavailableReason: constructedPlay?.unavailableReasons[0],
    ticketReady: isOption ? optionTermsReady : true,
    ticketMissing: optionTicketMissing,
    preflightReady: currentPreflightData?.wouldPass,
    blocking: currentPreflightData?.blocking,
    hardBlocker: hardPreflightResult?.detail,
    paperAcknowledged: paperAcknowledgement === "PAPER",
  });

  const submitProposal = () => {
    const deadlineAt = new Date(deadline).getTime();
    const noTradeConditions = noTradeText.split("\n").map((condition) => condition.trim()).filter(Boolean);
    if (!account) return toast.error("Choose the portfolio context this research was tested against.");
    if (!destinationAccount) return toast.error("Connect, sync, and bind a paper execution destination before preparing a proposal.");
    if (isOption && !optionTermsReady) return toast.error("Choose an expiration, strike, whole contracts, and limit premium for the exact option contract.");
    if (!isOption && !recipeCanPrepare) return toast.error(readiness.explanation);
    if (!Number.isFinite(deadlineAt)) return toast.error("Choose a valid catalyst deadline.");
    if (paperAcknowledgement !== "PAPER") return toast.error("Type PAPER to record your paper-only acknowledgement.");
    if (!isOption && isIntraday && (!intradaySizing || entryPriceCents == null || stopPriceCents == null || slippageCents == null || !noTradeConditions.length)) return toast.error("Review the modeled intraday plan before preparing a proposal.");
    if (preflightBusy) return toast.error("Checking paper-order guardrails. Please wait.");
    if (!currentPreflightData?.wouldPass) return toast.error(readiness.explanation);
    create.mutate({ ...ticket, accountId: destinationAccount.id, portfolioContextAccountId: account.id, candidateId: candidate.id, catalystDeadlineAt: deadlineAt, paperAcknowledgement: "PAPER" } as any);
  };

  if (!candidate) return null;
  const suggestedRange = candidate.suggestedSizeHighCents != null ? `${money(candidate.suggestedSizeLowCents)}–${money(candidate.suggestedSizeHighCents)}` : money(candidate.suggestedSizeLowCents);
  const preflightGaps = currentPreflightData?.blocking ?? [];
  const takeReadinessAction = () => {
    if (readiness.action === "return_to_evidence") return onReturnToBrief();
    if (readiness.action === "return_to_decision") return onReturnToDecisionBrief();
    if (readiness.action === "complete_ticket") {
      const field = optionTicketMissing[0];
      const target = field === "future expiration" ? expirationRef.current
        : field === "strike price" || field === "valid underlying ticker" ? strikeRef.current
          : field === "whole contract quantity" ? contractsRef.current
            : premiumRef.current;
      target?.focus();
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      return;
    }
    if (readiness.action === "review_recipe") return setShowDetails(true);
    if (readiness.action === "confirm_paper") return acknowledgementRef.current?.focus();
    submitProposal();
  };
  const modeledEntryCents = isOption ? constructedPlay?.entry?.priceCents : entryPriceCents ?? constructedPlay?.entry?.priceCents;
  const modeledStopCents = isOption ? constructedPlay?.stop?.priceCents : stopPriceCents ?? constructedPlay?.stop?.priceCents;
  const modeledTargets = isOption ? [] : (constructedPlay?.targets ?? []).map((target: any) => ({ label: `${target.rMultiple}R`, priceCents: target.priceCents }));
  const modeledQuantity = isOption ? (Number.isInteger(optionQty) && optionQty > 0 ? `${optionQty} contract${optionQty === 1 ? "" : "s"}` : "—") : constructedPlay?.qty == null ? "—" : `${constructedPlay.qty.toLocaleString()} shares`;
  const modeledLoss = isOption ? optionMaxLossCents : constructedPlay?.plannedLossCents;
  const modeledCapital = isOption ? optionMaxLossCents : constructedPlay?.notionalCents;

  return <Card id="paper-proposal" className="scroll-mt-6 border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
    <CardContent className="space-y-4 pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Paper ticket</p><h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol} · review the play</h2><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Check price and risk, finish the exact ticket, then create a paper proposal.</p></div><Badge variant="outline" style={{ color: "var(--sh-signal)" }}>{isOption ? instrumentType === "long_call" ? "Long call" : "Long put" : "Shares"}</Badge>
      </div>

      <section className="rounded-lg border p-3" style={{ borderColor: readiness.action === "create_proposal" ? "oklch(0.55 0.15 145)" : "var(--sh-signal)", background: "var(--sh-surface)" }} aria-live="polite">
        <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: readiness.action === "create_proposal" ? "oklch(0.55 0.15 145)" : "var(--sh-signal)" }} /><div><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{readiness.title}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{readiness.explanation}</p></div></div>
        {currentPreflightData?.notionalBasis === "derived_from_last_price" && <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Modeled basis: the mandate ceiling uses notional derived from the last recorded price.</p>}
        {preflightGaps.length > 1 && <details className="mt-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}><summary className="cursor-pointer font-medium">See {preflightGaps.length - 1} supporting gap{preflightGaps.length === 2 ? "" : "s"}</summary><ul className="mt-2 space-y-1 pl-4">{preflightGaps.slice(1).map((gap) => <li key={gap}>{gap}</li>)}</ul></details>}
      </section>

      <section aria-labelledby="price-risk-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h3 id="price-risk-heading" className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Price &amp; risk</h3><span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{isOption ? "underlying plan" : "modeled play"}</span></div>
        <PriceRiskVisual entryCents={modeledEntryCents} stopCents={modeledStopCents} targets={modeledTargets} label={isOption ? `${candidate.symbol} underlying levels` : `${candidate.symbol} price plan`} />
        <div className="grid grid-cols-3 overflow-hidden rounded-lg border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
          <TicketValue label={isOption ? "Contracts" : "Quantity"} value={modeledQuantity} />
          <TicketValue label="Maximum loss" value={money(modeledLoss)} />
          <TicketValue label={isOption ? "Premium at risk" : "Capital"} value={money(modeledCapital)} />
        </div>
        {isOption && <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 6%, var(--sh-surface))" }}><span><strong style={{ color: "var(--sh-text-primary)" }}>Live option quote required.</strong> <span style={{ color: "var(--sh-fg-muted)" }}>Choose the exact contract and limit below; no quote is inferred.</span></span><span className="shrink-0 font-mono tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{suggestedRange}</span></div>}
      </section>

      <section className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <TicketValue label="Portfolio" value={account?.label ?? "Not selected"} />
        {executionAccounts.length === 1 ? <TicketValue label="Paper destination" value={destinationAccount?.label ?? "Not connected"} /> : <label className="space-y-1.5 text-xs font-medium sm:col-span-2" style={{ color: "var(--sh-text-primary)" }}>Paper destination
          <select className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} value={destinationAccountId ?? ""} onChange={(event) => setDestinationAccountId(Number(event.target.value) || null)}>
            <option value="">Choose a paper execution account</option>
            {executionAccounts.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.externalAccountId}</option>)}
          </select>
        </label>}
        <TicketValue label="Review" value={holdingPeriodLabel(holdingPeriod)} />
      </section>

      <section aria-labelledby="instrument-choice" className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <div className="flex items-center justify-between gap-3"><p id="instrument-choice" className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Expression</p>{allowedInstrumentTypes.length === 1 && <span className="text-xs font-medium" style={{ color: "var(--sh-signal)" }}>{instrumentType === "shares" ? "Shares" : instrumentType === "long_call" ? "Long call" : "Long put"}</span>}</div>
        {run?.instrumentPreference === "options" && <p className="sr-only">This run is locked to bounded long options. No share substitution.</p>}
        {allowedInstrumentTypes.length > 1 && <div className={`mt-2 grid gap-2 ${allowedInstrumentTypes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`} role="radiogroup" aria-label="Paper instrument">{allowedInstrumentTypes.map((value) => <button key={value} type="button" role="radio" aria-checked={instrumentType === value} onClick={() => setInstrumentType(value)} className="min-h-11 rounded-md border px-2 py-2 text-xs font-medium" style={{ borderColor: instrumentType === value ? "var(--sh-signal)" : "var(--sh-border-1)", background: instrumentType === value ? "color-mix(in srgb, var(--sh-signal) 12%, transparent)" : "transparent", color: "var(--sh-text-primary)" }}>{value === "shares" ? "Shares" : value === "long_call" ? "Long call" : "Long put"}</button>)}</div>}
      </section>

      {isOption && <section ref={contractPickerRef} aria-labelledby="contract-picker-heading" className="scroll-mt-5 space-y-3 rounded-lg border p-3" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-signal)" }}>Exact contract</p><h3 id="contract-picker-heading" className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Choose from the live chain</h3><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Nearest strikes first. Select a quoted row to prefill its ask as your editable buy limit.</p></div><label className="text-xs font-medium">Expiration<input ref={expirationRef} value={optionExpirationDate} onChange={(event) => { setOptionExpirationDate(event.target.value); setOptionStrikeDollars(""); setOptionPremiumDollars(""); }} type="date" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm sm:w-44" style={{ borderColor: "var(--sh-border-1)" }} /></label></div>
        {optionChain.isFetching ? <div className="flex min-h-20 items-center justify-center gap-2 rounded-md border text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><Loader2 className="h-4 w-4 animate-spin" />Loading live contracts…</div> : optionChainItems.length ? <div className="overflow-hidden rounded-md border" style={{ borderColor: "var(--sh-border-1)" }}><div className="hidden grid-cols-[1.2fr_1.35fr_.65fr_.65fr_.65fr] gap-2 border-b px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] sm:grid" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><span>Contract</span><span>Bid / ask · mark</span><span>Spread</span><span>Volume</span><span>Open int.</span></div>{optionChainItems.map((item) => { const selected = optionContractSymbol === item.contract.symbol; return <button key={item.contract.symbol} type="button" disabled={!item.quoteReady} aria-pressed={selected} aria-label={`${candidate.symbol} ${price(item.contract.strikePriceCents)} ${item.contract.type}; ${item.quoteReady ? `bid ${price(item.market?.bidPriceCents)}, ask ${price(item.market?.askPriceCents)}` : "quote unavailable"}`} onClick={() => selectQuotedContract(item)} className="grid min-h-12 w-full gap-1 border-b px-3 py-2 text-left text-xs last:border-b-0 disabled:cursor-not-allowed disabled:opacity-50 sm:grid-cols-[1.2fr_1.35fr_.65fr_.65fr_.65fr] sm:items-center" style={{ borderColor: "var(--sh-border-1)", background: selected ? "color-mix(in srgb, var(--sh-signal) 10%, var(--sh-surface))" : "transparent", color: "var(--sh-text-primary)" }}><span className="font-semibold tabular-nums">{price(item.contract.strikePriceCents)} {item.contract.type}</span><span className="font-mono tabular-nums">{item.market ? <>{price(item.market.bidPriceCents)} / {price(item.market.askPriceCents)}<small className="ml-1 opacity-70">· mark {price(item.midpointCents)}</small></> : "Quote unavailable"}</span><span className="font-mono tabular-nums">{item.spreadPct == null ? "—" : `${item.spreadPct.toFixed(1)}%`}</span><span className="font-mono tabular-nums">{item.market?.dailyVolume?.toLocaleString() ?? "—"}</span><span className="font-mono tabular-nums">{item.contract.openInterest?.toLocaleString() ?? "—"}</span></button>; })}</div> : <div className="rounded-md border px-3 py-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>No usable live contracts returned.</strong><br />{optionChain.data?.unavailableReason ?? optionChain.error?.message ?? "Retry the chain or preserve cash; do not guess a contract."}</div>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Contracts<input ref={contractsRef} value={contracts} onChange={(event) => setContracts(event.target.value)} type="number" min="1" step="1" inputMode="numeric" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><label className="text-xs font-medium">Limit premium / share<input ref={premiumRef} value={optionPremiumDollars} onChange={(event) => setOptionPremiumDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Select a quoted contract" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label></div>
        <details className="rounded-md border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="min-h-11 cursor-pointer px-3 py-3 text-xs font-medium">Enter a contract manually</summary><div className="border-t p-3" style={{ borderColor: "var(--sh-border-1)" }}><label className="text-xs font-medium">Strike price<input ref={strikeRef} value={optionStrikeDollars} onChange={(event) => setOptionStrikeDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="40.00" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label></div></details>
        <div className="rounded-md px-3 py-2 text-xs leading-5" style={{ background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))", color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>{optionContractSymbol ? paperInstrumentLabel({ instrumentType, symbol: optionContractSymbol, underlyingSymbol: candidate.symbol, optionExpirationDate, optionStrikePriceCents }) : "No contract selected"}</strong><br />{optionContractSymbol ? <span className="font-mono break-all">{optionContractSymbol}</span> : "Choose a quoted row above."} · Maximum premium loss {money(optionMaxLossCents)}.</div>
      </section>}

      {optionResolutionNeeded && <section aria-labelledby="quote-recovery-heading" className="rounded-lg border p-3" style={{ borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 5%, var(--sh-surface))" }}><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><div><h3 id="quote-recovery-heading" className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Live quote unavailable — choose the safe next step</h3><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Nothing has been proposed or sent. Retry the market data, choose another quoted contract above, or finish this decision at $0 risk.</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><Button type="button" variant="outline" className="min-h-11" disabled={optionChain.isFetching || preflight.isFetching} onClick={() => void retryOptionEvidence()}>{optionChain.isFetching || preflight.isFetching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}Retry live quote</Button><Button type="button" variant="outline" className="min-h-11" onClick={() => { contractPickerRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }}>Choose another contract</Button><Button type="button" className="min-h-11" disabled={preserveCash.isPending} onClick={() => preserveCash.mutate({ runId, candidateId: candidate.id, decision: "skipped", reason: preserveCashReason })}>{preserveCash.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CircleSlash2 className="mr-1.5 h-3.5 w-3.5" />}Preserve cash · $0 risk</Button></div></section>}

      {riskResolutionNeeded && <section aria-labelledby="risk-recovery-heading" className="rounded-lg border p-3" style={{ borderColor: "var(--sh-red)", background: "color-mix(in srgb, var(--sh-red) 4%, var(--sh-surface))" }}><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-red)" }} /><div><h3 id="risk-recovery-heading" className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>This contract is over the current risk limit</h3><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Selected maximum loss <strong style={{ color: "var(--sh-text-primary)" }}>{money(optionMaxLossCents)}</strong>{riskCeilingCents != null ? <> · current per-play ceiling <strong style={{ color: "var(--sh-text-primary)" }}>{money(riskCeilingCents)}</strong></> : null}. Nothing has been proposed or sent.</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Button type="button" variant="outline" className="min-h-11" onClick={() => { contractPickerRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }}>Choose a lower-premium contract</Button><Button type="button" className="min-h-11" disabled={preserveCash.isPending} onClick={() => preserveCash.mutate({ runId, candidateId: candidate.id, decision: "skipped", reason: preserveRiskCashReason })}>{preserveCash.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CircleSlash2 className="mr-1.5 h-3.5 w-3.5" />}Preserve cash · $0 risk</Button></div></section>}

      <details className="rounded-lg border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="cursor-pointer px-3 py-2 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Change review timing or size</summary><section className="grid gap-3 border-t p-3 sm:grid-cols-[1fr_auto] sm:items-end" style={{ borderColor: "var(--sh-border-1)" }}><label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Review horizon<div className="grid grid-cols-2 gap-1 sm:grid-cols-5" role="radiogroup" aria-label="Planned holding horizon">{(["intraday", "overnight", "swing", "catalyst_window", "position"] as HoldingPeriod[]).map((period) => <button key={period} type="button" role="radio" aria-checked={holdingPeriod === period} onClick={() => setHoldingPeriod(period)} className="min-h-11 rounded-md border px-2 py-2 text-xs" style={{ borderColor: holdingPeriod === period ? "var(--sh-signal)" : "var(--sh-border-1)", background: holdingPeriod === period ? "color-mix(in srgb, var(--sh-signal) 12%, transparent)" : "transparent", color: "var(--sh-text-primary)" }}>{holdingPeriodLabel(period)}</button>)}</div></label>{!isOption && !isIntraday && <label className="block text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Modeled paper size<input value={notionalDollars} onChange={(event) => setNotionalDollars(event.target.value)} type="number" min="1" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm sm:w-36" style={{ borderColor: "var(--sh-border-1)" }} /></label>}</section></details>

      {!isOption && recipeCanPrepare && <div className="rounded-md px-3 py-2 text-xs leading-5" style={{ background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))", color: "var(--sh-fg-muted)" }}><Sparkles className="mr-1 inline h-3.5 w-3.5" style={{ color: "var(--sh-signal)" }} />Prefilled model: {constructedPlay?.side} · entry {money(constructedPlay?.entry?.priceCents)} · stop {money(constructedPlay?.stop?.priceCents)} · planned loss {money(constructedPlay?.plannedLossCents)}. Confirm against a real-time terminal.</div>}

      <section className="sr-only" aria-live="polite">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Portfolio impact</p>
        {isOption ? optionTermsReady ? <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-text-primary)" }}>If later approved, this modeled ticket commits {optionQty} contract{optionQty === 1 ? "" : "s"} and at most {money(optionMaxLossCents)} of premium plus the stated slippage allowance. This is not a fill or return forecast.</p> : <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>Option impact is not measured yet. Enter the exact contract and limit premium so maximum premium loss can be calculated—unknown is not zero.</p> : portfolioImpactReady ? <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-text-primary)" }}>If you later approve this modeled paper proposal: {constructedPlay?.qty?.toLocaleString()} shares · {money(constructedPlay?.notionalCents)} gross exposure · {money(constructedPlay?.plannedLossCents)} planned loss ({constructedPlay?.plannedLossPctOfEquity?.toFixed(2)}% of the last synced equity). This is not a broker fill.</p> : <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>Portfolio impact is not measured yet. Required sizing evidence is missing, so exposure and loss remain unknown—not zero.</p>}
      </section>

      <details open={showDetails} onToggle={(event) => setShowDetails((event.target as HTMLDetailsElement).open)} className="rounded-lg border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>Review modelled plan &amp; advanced fields<ChevronDown className="h-4 w-4" /></summary><div className="space-y-3 border-t p-3" style={{ borderColor: "var(--sh-border-1)" }}>
        {!isOption && isIntraday && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-medium">Maximum planned loss<input value={riskBudgetDollars} onChange={(event) => setRiskBudgetDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><label className="text-xs font-medium">Entry<input value={entryDollars} onChange={(event) => setEntryDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><label className="text-xs font-medium">Stop<input value={stopDollars} onChange={(event) => setStopDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><label className="text-xs font-medium">Slippage / share<input value={slippageDollars} onChange={(event) => setSlippageDollars(event.target.value)} type="number" min="0" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label></div>}
        {!isOption && isIntraday && <p className="rounded-md px-3 py-2 text-xs leading-5" style={{ background: "var(--sh-surface)", color: "var(--sh-fg-muted)" }}>{intradaySizing ? <>Derived: <strong style={{ color: "var(--sh-text-primary)" }}>{intradaySizing.qty.toLocaleString()} shares</strong> · {money(intradaySizing.notionalCents)} · planned loss {money(intradaySizing.plannedRiskCents)}.</> : "The recipe needs measured entry, stop, slippage, and loss budget before it can derive quantity."}</p>}
        {isOption && <label className="block text-xs font-medium">Premium slippage allowance / share<input value={optionSlippageDollars} onChange={(event) => setOptionSlippageDollars(event.target.value)} type="number" min="0" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Catalyst deadline<input value={deadline} onChange={(event) => setDeadline(event.target.value)} type="datetime-local" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>{isIntraday && <label className="text-xs font-medium">Human close-review time<input value={timeStop} onChange={(event) => setTimeStop(event.target.value)} type="datetime-local" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>}</div>
        <label className="block text-xs font-medium">Why this proposal belongs<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><div className="-mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => setReason(`Paper-only proposal based on the recorded human review of ${candidate.symbol} research evidence.`)} className="min-h-11 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Use reviewed research case</button><button type="button" onClick={() => setReason(`Modelled ${candidate.playSide === "short" ? "short" : "long"} paper exposure to test the stated catalyst while the reviewed invalidation remains false.`)} className="min-h-11 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Use catalyst test</button></div><label className="block text-xs font-medium">Reject or exit if<textarea value={invalidationCondition} onChange={(event) => setInvalidationCondition(event.target.value)} rows={2} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><div className="-mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => setInvalidationCondition("Invalidate if the stated catalyst does not occur by the deadline, or its disclosed result contradicts the thesis.")} className="min-h-11 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Use catalyst failure</button>{isIntraday && <button type="button" onClick={() => setInvalidationCondition("Do not take, or exit, if price cannot hold the verified trigger level or the stated risk budget fails.")} className="min-h-11 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Use trigger failure</button>}</div>{isIntraday && <label className="block text-xs font-medium">No-trade conditions<input value={noTradeText} onChange={(event) => setNoTradeText(event.target.value)} placeholder="One condition per line" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>}
      </div></details>

      {(isOption ? optionTermsReady : recipeCanPrepare) && currentPreflightData?.wouldPass && <label className="block rounded-lg border p-3 text-xs font-medium" style={{ borderColor: "var(--sh-border-1)" }}>Type <span className="font-mono">PAPER</span> to acknowledge a paper-only proposal<input ref={acknowledgementRef} value={paperAcknowledgement} onChange={(event) => setPaperAcknowledgement(event.target.value)} autoComplete="off" placeholder="PAPER" className="mt-2 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>}
      {!optionResolutionNeeded && !riskResolutionNeeded && <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-lg border p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="px-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Next guarded action: <strong style={{ color: "var(--sh-text-primary)" }}>{readiness.actionLabel}</strong></p><div className="flex gap-2">{readiness.action === "return_to_evidence" && <Button className="min-h-11" variant="outline" size="sm" onClick={onReturnToBrief}>Open evidence</Button>}<Button className="min-h-11 flex-1 sm:flex-none" size="sm" onClick={takeReadinessAction} disabled={create.isPending || constructed.isLoading || preflightBusy}>{create.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : readiness.action === "create_proposal" ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />}{readiness.actionLabel}</Button></div></div>}
    </CardContent>
  </Card>;
}

function TicketValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-r px-3 py-2 last:border-r-0" style={{ borderColor: "var(--sh-border-1)" }}><p className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p><p className="mt-1 truncate font-mono text-xs font-semibold tabular-nums" title={value} style={{ color: "var(--sh-text-primary)" }}>{value}</p></div>;
}
