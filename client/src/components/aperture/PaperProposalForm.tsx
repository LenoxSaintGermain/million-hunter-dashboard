import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCheck, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { buildProposalReadiness } from "@shared/proposalReadiness";
import { dollarsToCents } from "@shared/proposalTicketFields";
import { buildOccOptionSymbol, isOptionInstrument, paperInstrumentLabel, type PaperInstrumentType } from "@shared/paperInstrument";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window" | "position";

const money = (cents: number | null | undefined) => cents == null
  ? "Not modeled"
  : new Intl.NumberFormat(navigator.language, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

function safeHoldingPeriod(value: unknown): HoldingPeriod {
  return ["intraday", "overnight", "swing", "catalyst_window", "position"].includes(String(value)) ? value as HoldingPeriod : "swing";
}

export function PaperProposalForm({ runId, candidate, account, run, onReturnToBrief, onProposalCreated }: {
  runId: number; candidate: any; account: any; run: any; onReturnToBrief: () => void; onProposalCreated: () => void;
}) {
  const suggestedCents = candidate?.suggestedSizeLowCents ?? 100_000;
  const [notionalDollars, setNotionalDollars] = useState(String(Math.max(100, Math.round(suggestedCents / 100))));
  const [riskBudgetDollars, setRiskBudgetDollars] = useState("");
  const [entryDollars, setEntryDollars] = useState("");
  const [stopDollars, setStopDollars] = useState("");
  const [slippageDollars, setSlippageDollars] = useState("0");
  const [reason, setReason] = useState(`Paper-only proposal based on recorded human review of ${candidate?.symbol ?? "this"} research evidence.`);
  const [invalidationCondition, setInvalidationCondition] = useState(run?.invalidationRule ?? "Do not proceed, or exit the paper position, if the thesis evidence no longer supports the decision.");
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>(() => safeHoldingPeriod(run?.holdingPeriod));
  const [deadline, setDeadline] = useState(() => new Date(run?.catalystDeadlineAt ?? Date.now() + 7 * 86_400_000).toISOString().slice(0, 16));
  const [timeStop, setTimeStop] = useState(() => new Date(run?.catalystDeadlineAt ?? Date.now() + 6 * 3_600_000).toISOString().slice(0, 16));
  const [noTradeText, setNoTradeText] = useState("");
  const [paperAcknowledgement, setPaperAcknowledgement] = useState("");
  const [preflightInput, setPreflightInput] = useState<any | null>(null);
  const [recipePrefilled, setRecipePrefilled] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [destinationAccountId, setDestinationAccountId] = useState<number | null>(null);
  const [instrumentType, setInstrumentType] = useState<PaperInstrumentType>(() => run?.instrumentPreference === "options" ? (candidate?.playSide === "short" ? "long_put" : "long_call") : "shares");
  const [optionExpirationDate, setOptionExpirationDate] = useState(() => new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10));
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
  const accountsQuery = trpc.aperture.account.list.useQuery();
  const executionAccounts = (accountsQuery.data ?? []).filter((item) => item.isPaper && ["alpaca_paper", "uat_paper"].includes(item.brokerId) && item.externalAccountId);
  const destinationAccount = executionAccounts.find((item) => item.id === destinationAccountId) ?? null;
  const isOption = isOptionInstrument(instrumentType);
  const constructed = trpc.aperture.play.construct.useQuery({ runId, candidateId: candidate?.id ?? 0 }, { enabled: !!candidate?.id, staleTime: 30_000 });
  const create = trpc.aperture.order.create.useMutation({
    onSuccess: () => { toast.success("Paper proposal created. It is waiting for your separate approval."); onProposalCreated(); },
    onError: (error) => toast.error(error.message),
  });
  const constructedPlay = constructed.data?.play;
  const recipeCanPrepare = constructedPlay?.readiness === "constructed";
  const portfolioImpactReady = recipeCanPrepare
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
    setTimeStop(constructedPlay.timeStopAt == null ? "" : new Date(constructedPlay.timeStopAt).toISOString().slice(0, 16));
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

  const adjustNotional = (multiplier: number) => {
    const current = Number(notionalDollars);
    if (!Number.isFinite(current) || current <= 0) return;
    setNotionalDollars(String(Math.max(1, Math.round(current * multiplier))));
  };

  const adjustRiskBudget = (multiplier: number) => {
    const current = Number(riskBudgetDollars);
    if (!Number.isFinite(current) || current <= 0) return;
    setRiskBudgetDollars((current * multiplier).toFixed(2));
  };

  const adjustStopDistance = (multiplier: number) => {
    const entry = Number(entryDollars);
    const stop = Number(stopDollars);
    if (!Number.isFinite(entry) || !Number.isFinite(stop) || entry === stop) return;
    const distance = Math.abs(entry - stop) * multiplier;
    const nextStop = candidate?.playSide === "short" ? entry + distance : entry - distance;
    setStopDollars(nextStop.toFixed(2));
  };

  const isIntraday = holdingPeriod === "intraday";
  const entryPriceCents = dollarsToCents(entryDollars);
  const stopPriceCents = dollarsToCents(stopDollars);
  const slippageCents = dollarsToCents(slippageDollars, { allowZero: true });
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

  useEffect(() => {
    if (!account || !destinationAccount || !candidate || (isOption ? !optionTermsReady : !recipeCanPrepare)) { setPreflightInput(null); return; }
    const timer = window.setTimeout(() => setPreflightInput(ticket), 400);
    return () => window.clearTimeout(timer);
  }, [account, destinationAccount, candidate, isOption, optionTermsReady, recipeCanPrepare, ticket]);
  const preflight = trpc.aperture.order.preflight.useQuery(preflightInput ?? ticket, { enabled: preflightInput != null, staleTime: 0, retry: false });
  const readiness = buildProposalReadiness({
    recipeReady: isOption ? optionTermsReady : recipeCanPrepare,
    unavailableReason: constructedPlay?.unavailableReasons[0],
    preflightReady: preflight.data?.wouldPass,
    blocking: preflight.data?.blocking,
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
    if (preflight.isFetching) return toast.error("Checking paper-order guardrails. Please wait.");
    if (!preflight.data?.wouldPass) return toast.error(readiness.explanation);
    create.mutate({ ...ticket, accountId: destinationAccount.id, portfolioContextAccountId: account.id, candidateId: candidate.id, catalystDeadlineAt: deadlineAt, paperAcknowledgement: "PAPER" } as any);
  };

  if (!candidate) return null;
  const suggestedRange = candidate.suggestedSizeHighCents != null ? `${money(candidate.suggestedSizeLowCents)}–${money(candidate.suggestedSizeHighCents)}` : money(candidate.suggestedSizeLowCents);
  const preflightGaps = preflight.data?.blocking ?? [];
  const takeReadinessAction = () => {
    if (readiness.action === "return_to_evidence") return onReturnToBrief();
    if (readiness.action === "review_recipe") return setShowDetails(true);
    if (readiness.action === "confirm_paper") return acknowledgementRef.current?.focus();
    submitProposal();
  };

  return <Card id="paper-proposal" className="scroll-mt-6 border" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
    <CardContent className="space-y-4 pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Paper ticket · review before approval</p><h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol} · decide the next safe step</h2><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Choose the exact instrument first. Nothing is sent until a separate paper approval and submission.</p></div><div className="flex flex-wrap gap-1"><Badge variant="outline" style={{ color: "var(--sh-signal)" }}>Modeled range {suggestedRange}</Badge><Badge variant="outline" style={{ color: "var(--sh-text-primary)" }}>Intent · open paper exposure</Badge></div>
      </div>

      <section className="rounded-lg border p-3" style={{ borderColor: readiness.action === "create_proposal" ? "oklch(0.55 0.15 145)" : "var(--sh-signal)", background: "var(--sh-surface)" }} aria-live="polite">
        <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: readiness.action === "create_proposal" ? "oklch(0.55 0.15 145)" : "var(--sh-signal)" }} /><div><p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{readiness.title}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{readiness.explanation}</p></div></div>
        {preflight.data?.notionalBasis === "derived_from_last_price" && <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Modeled basis: the mandate ceiling uses notional derived from the last recorded price.</p>}
        {preflightGaps.length > 1 && <details className="mt-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}><summary className="cursor-pointer font-medium">See {preflightGaps.length - 1} supporting gap{preflightGaps.length === 2 ? "" : "s"}</summary><ul className="mt-2 space-y-1 pl-4">{preflightGaps.slice(1).map((gap) => <li key={gap}>{gap}</li>)}</ul></details>}
      </section>

      <section className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <div><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--sh-fg-muted)" }}>Portfolio context</p><p className="mt-1 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>{account?.label ?? "Not selected"}</p><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Holdings and equity used by the risk gates.</p></div>
        <label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Paper execution destination
          <select className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} value={destinationAccountId ?? ""} onChange={(event) => setDestinationAccountId(Number(event.target.value) || null)}>
            <option value="">Choose a paper execution account</option>
            {executionAccounts.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.externalAccountId}</option>)}
          </select>
          <span className="block font-normal" style={{ color: "var(--sh-fg-muted)" }}>{destinationAccount ? `Bound external paper account ${destinationAccount.externalAccountId}` : "No executable destination is bound. Set it up under Accounts."}</span>
        </label>
      </section>

      <section aria-labelledby="instrument-choice" className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <p id="instrument-choice" className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>How should this thesis be expressed?</p>
        <div className={`mt-2 grid gap-2 ${allowedInstrumentTypes.length === 1 ? "grid-cols-1" : allowedInstrumentTypes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`} role="radiogroup" aria-label="Paper instrument">
          {allowedInstrumentTypes.map((value) => <button key={value} type="button" role="radio" aria-checked={instrumentType === value} onClick={() => setInstrumentType(value)} className="min-h-11 rounded-md border px-2 py-2 text-xs font-medium" style={{ borderColor: instrumentType === value ? "var(--sh-signal)" : "var(--sh-border-1)", background: instrumentType === value ? "color-mix(in srgb, var(--sh-signal) 12%, transparent)" : "transparent", color: "var(--sh-text-primary)" }}>{value === "shares" ? "Shares" : value === "long_call" ? "Long call" : "Long put"}</button>)}
        </div>
        <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{run?.instrumentPreference === "options" ? "This run is locked to bounded long options. No share substitution, uncovered, short, multi-leg, exercise, or assignment path." : run?.instrumentPreference === "shares" ? "This run is locked to shares and uses the research entry, stop, and planned-loss model." : isOption ? "Bounded scope: standard long options only. No uncovered, short, multi-leg, exercise, or assignment path." : "Share tickets use the research entry, stop, and planned-loss model."}</p>
      </section>

      {isOption && <section className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface)" }}>
        <label className="text-xs font-medium">Expiration<input value={optionExpirationDate} onChange={(event) => setOptionExpirationDate(event.target.value)} type="date" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <label className="text-xs font-medium">Strike price<input value={optionStrikeDollars} onChange={(event) => setOptionStrikeDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="250.00" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <label className="text-xs font-medium">Contracts<input value={contracts} onChange={(event) => setContracts(event.target.value)} type="number" min="1" step="1" inputMode="numeric" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <label className="text-xs font-medium">Limit premium / share<input value={entryDollars} onChange={(event) => setEntryDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="4.20" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <div className="sm:col-span-2 lg:col-span-4 rounded-md px-3 py-2 text-xs leading-5" style={{ background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))", color: "var(--sh-fg-muted)" }}>
          <strong style={{ color: "var(--sh-text-primary)" }}>{optionContractSymbol ? paperInstrumentLabel({ instrumentType, symbol: optionContractSymbol, underlyingSymbol: candidate.symbol, optionExpirationDate, optionStrikePriceCents }) : "Exact contract not ready"}</strong><br />
          {optionContractSymbol ? <span className="font-mono break-all">{optionContractSymbol}</span> : "Enter a valid expiration and strike."} · Maximum premium loss {money(optionMaxLossCents)}. Broker entitlement and tradability must verify before the ticket clears.
        </div>
      </section>}

      <section className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>When will you review this play?<div className="grid grid-cols-2 gap-1 sm:grid-cols-5" role="radiogroup" aria-label="Planned holding horizon">{(["intraday", "overnight", "swing", "catalyst_window", "position"] as HoldingPeriod[]).map((period) => <button key={period} type="button" role="radio" aria-checked={holdingPeriod === period} onClick={() => setHoldingPeriod(period)} className="min-h-11 rounded-md border px-2 py-2 text-xs capitalize" style={{ borderColor: holdingPeriod === period ? "var(--sh-signal)" : "var(--sh-border-1)", background: holdingPeriod === period ? "color-mix(in srgb, var(--sh-signal) 12%, transparent)" : "transparent", color: "var(--sh-text-primary)" }}>{period === "intraday" ? "Today" : period === "overnight" ? "Next close" : period === "swing" ? "This week" : period === "position" ? "Long term" : "Named catalyst"}</button>)}</div></label>{!isOption && !isIntraday && <div className="space-y-1.5"><label className="block text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Modeled paper size<input value={notionalDollars} onChange={(event) => setNotionalDollars(event.target.value)} type="number" min="1" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm sm:w-36" style={{ borderColor: "var(--sh-border-1)" }} /></label><div className="flex gap-1" aria-label="Quick modeled paper size adjustments"><button type="button" onClick={() => adjustNotional(0.75)} className="min-h-11 rounded border px-2 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)" }}>−25%</button><button type="button" onClick={() => setNotionalDollars(String(Math.round(suggestedCents / 100)))} className="min-h-11 rounded border px-2 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)" }}>Model</button><button type="button" onClick={() => adjustNotional(1.25)} className="min-h-11 rounded border px-2 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)" }}>+25%</button></div></div>}</section>

      {!isOption && recipeCanPrepare && <div className="rounded-md px-3 py-2 text-xs leading-5" style={{ background: "color-mix(in srgb, var(--sh-signal) 7%, var(--sh-surface))", color: "var(--sh-fg-muted)" }}><Sparkles className="mr-1 inline h-3.5 w-3.5" style={{ color: "var(--sh-signal)" }} />Prefilled model: {constructedPlay?.side} · entry {money(constructedPlay?.entry?.priceCents)} · stop {money(constructedPlay?.stop?.priceCents)} · planned loss {money(constructedPlay?.plannedLossCents)}. Confirm against a real-time terminal.</div>}

      <section className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }} aria-live="polite">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Portfolio impact</p>
        {isOption && optionTermsReady ? <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-text-primary)" }}>If later approved, this modeled ticket commits {optionQty} contract{optionQty === 1 ? "" : "s"} and at most {money(optionMaxLossCents)} of premium plus the stated slippage allowance. This is not a fill or return forecast.</p> : portfolioImpactReady ? <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-text-primary)" }}>If you later approve this modeled paper proposal: {constructedPlay?.qty?.toLocaleString()} shares · {money(constructedPlay?.notionalCents)} gross exposure · {money(constructedPlay?.plannedLossCents)} planned loss ({constructedPlay?.plannedLossPctOfEquity?.toFixed(2)}% of the last synced equity). This is not a broker fill.</p> : <p className="mt-1 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>Portfolio impact is not measured yet. Required sizing evidence is missing, so exposure and loss remain unknown—not zero.</p>}
      </section>

      <details open={showDetails} onToggle={(event) => setShowDetails((event.target as HTMLDetailsElement).open)} className="rounded-lg border" style={{ borderColor: "var(--sh-border-1)" }}><summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>Review modelled plan &amp; advanced fields<ChevronDown className="h-4 w-4" /></summary><div className="space-y-3 border-t p-3" style={{ borderColor: "var(--sh-border-1)" }}>
        {!isOption && isIntraday && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-medium">Maximum planned loss<input value={riskBudgetDollars} onChange={(event) => setRiskBudgetDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><label className="text-xs font-medium">Entry<input value={entryDollars} onChange={(event) => setEntryDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><label className="text-xs font-medium">Stop<input value={stopDollars} onChange={(event) => setStopDollars(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><label className="text-xs font-medium">Slippage / share<input value={slippageDollars} onChange={(event) => setSlippageDollars(event.target.value)} type="number" min="0" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label></div>}
        {!isOption && isIntraday && <p className="rounded-md px-3 py-2 text-xs leading-5" style={{ background: "var(--sh-surface)", color: "var(--sh-fg-muted)" }}>{intradaySizing ? <>Derived: <strong style={{ color: "var(--sh-text-primary)" }}>{intradaySizing.qty.toLocaleString()} shares</strong> · {money(intradaySizing.notionalCents)} · planned loss {money(intradaySizing.plannedRiskCents)}.</> : "The recipe needs measured entry, stop, slippage, and loss budget before it can derive quantity."}</p>}
        {isOption && <label className="block text-xs font-medium">Premium slippage allowance / share<input value={slippageDollars} onChange={(event) => setSlippageDollars(event.target.value)} type="number" min="0" step="0.01" inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Catalyst deadline<input value={deadline} onChange={(event) => setDeadline(event.target.value)} type="datetime-local" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>{isIntraday && <label className="text-xs font-medium">Human close-review time<input value={timeStop} onChange={(event) => setTimeStop(event.target.value)} type="datetime-local" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>}</div>
        <label className="block text-xs font-medium">Why this proposal belongs<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><div className="-mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => setReason(`Paper-only proposal based on the recorded human review of ${candidate.symbol} research evidence.`)} className="min-h-11 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Use reviewed research case</button><button type="button" onClick={() => setReason(`Modelled ${candidate.playSide === "short" ? "short" : "long"} paper exposure to test the stated catalyst while the reviewed invalidation remains false.`)} className="min-h-11 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Use catalyst test</button></div><label className="block text-xs font-medium">Reject or exit if<textarea value={invalidationCondition} onChange={(event) => setInvalidationCondition(event.target.value)} rows={2} className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label><div className="-mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => setInvalidationCondition("Invalidate if the stated catalyst does not occur by the deadline, or its disclosed result contradicts the thesis.")} className="min-h-11 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Use catalyst failure</button>{isIntraday && <button type="button" onClick={() => setInvalidationCondition("Do not take, or exit, if price cannot hold the verified trigger level or the stated risk budget fails.")} className="min-h-11 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Use trigger failure</button>}</div>{isIntraday && <label className="block text-xs font-medium">No-trade conditions<input value={noTradeText} onChange={(event) => setNoTradeText(event.target.value)} placeholder="One condition per line" className="mt-1 min-h-11 w-full rounded-md border bg-transparent px-2 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>}
      </div></details>

      {(isOption ? optionTermsReady : recipeCanPrepare) && preflight.data?.wouldPass && <label className="block rounded-lg border p-3 text-xs font-medium" style={{ borderColor: "var(--sh-border-1)" }}>Type <span className="font-mono">PAPER</span> to acknowledge a paper-only proposal<input ref={acknowledgementRef} value={paperAcknowledgement} onChange={(event) => setPaperAcknowledgement(event.target.value)} autoComplete="off" placeholder="PAPER" className="mt-2 min-h-11 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>}
      <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-lg border p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><p className="px-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Next guarded action: <strong style={{ color: "var(--sh-text-primary)" }}>{readiness.actionLabel}</strong></p><div className="flex gap-2"><Button className="min-h-11" variant="outline" size="sm" onClick={onReturnToBrief}>Evidence</Button><Button className="min-h-11" size="sm" onClick={takeReadinessAction} disabled={create.isPending || constructed.isLoading || preflight.isFetching}>{create.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : readiness.action === "create_proposal" ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />}{readiness.actionLabel}</Button></div></div>
    </CardContent>
  </Card>;
}
