import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window";

function money(cents: number | null | undefined) {
  if (cents == null) return "Not modeled";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function safeHoldingPeriod(value: unknown): HoldingPeriod {
  return ["intraday", "overnight", "swing", "catalyst_window"].includes(String(value))
    ? value as HoldingPeriod
    : "swing";
}

function dollarsToCents(value: string) {
  const dollars = Number(value);
  return Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : null;
}

export function PaperProposalForm({
  runId,
  candidate,
  account,
  run,
  onReturnToBrief,
  onProposalCreated,
}: {
  runId: number;
  candidate: any;
  account: any;
  run: any;
  onReturnToBrief: () => void;
  onProposalCreated: () => void;
}) {
  const suggestedCents = candidate?.suggestedSizeLowCents ?? 100_000;
  const [notionalDollars, setNotionalDollars] = useState(String(Math.max(100, Math.round(suggestedCents / 100))));
  const [riskBudgetDollars, setRiskBudgetDollars] = useState("");
  const [entryDollars, setEntryDollars] = useState("");
  const [stopDollars, setStopDollars] = useState("");
  const [slippageDollars, setSlippageDollars] = useState("0");
  const [reason, setReason] = useState(`Paper-only proposal based on the recorded human review of ${candidate?.symbol ?? "this"} research evidence.`);
  const [invalidationCondition, setInvalidationCondition] = useState(run?.invalidationRule ?? "Do not proceed, or exit the paper position, if the thesis evidence no longer supports the decision.");
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>(() => safeHoldingPeriod(run?.holdingPeriod));
  const [deadline, setDeadline] = useState(() => new Date(run?.catalystDeadlineAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [timeStop, setTimeStop] = useState(() => new Date(run?.catalystDeadlineAt ?? Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [noTradeText, setNoTradeText] = useState("");
  const [paperAcknowledgement, setPaperAcknowledgement] = useState("");
  const [preflightInput, setPreflightInput] = useState<any | null>(null);
  const [recipePrefilled, setRecipePrefilled] = useState(false);
  const constructed = trpc.aperture.play.construct.useQuery({ runId, candidateId: candidate?.id ?? 0 }, { enabled: !!candidate?.id, staleTime: 30_000 });
  const create = trpc.aperture.order.create.useMutation({
    onSuccess: () => {
      toast.success("Paper proposal created. It is waiting for your separate approval.");
      onProposalCreated();
    },
    onError: (error) => toast.error(error.message),
  });

  const constructedPlay = constructed.data?.play;
  const recipeCanPrepare = constructedPlay?.readiness === "constructed";
  useEffect(() => {
    if (!candidate || !constructedPlay || recipePrefilled || constructedPlay.readiness !== "constructed") return;
    setRiskBudgetDollars(constructedPlay.budgetCents == null ? "" : (constructedPlay.budgetCents / 100).toFixed(2));
    setEntryDollars(constructedPlay.entry == null ? "" : (constructedPlay.entry.priceCents / 100).toFixed(2));
    setStopDollars(constructedPlay.stop == null ? "" : (constructedPlay.stop.priceCents / 100).toFixed(2));
    setSlippageDollars(constructedPlay.slippage == null ? "" : (constructedPlay.slippage.priceCents / 100).toFixed(2));
    setNotionalDollars(constructedPlay.notionalCents == null ? "" : (constructedPlay.notionalCents / 100).toFixed(2));
    setTimeStop(constructedPlay.timeStopAt == null ? "" : new Date(constructedPlay.timeStopAt).toISOString().slice(0, 16));
    setNoTradeText(constructedPlay.noTradeConditions.join("\n"));
    setReason(`Modeled ${constructedPlay.side} paper recipe for ${candidate.symbol}; confirm all derived levels against a real-time terminal before human approval.`);
    setRecipePrefilled(true);
  }, [candidate?.symbol, constructedPlay, recipePrefilled]);
  if (!candidate) return null;
  const isIntraday = holdingPeriod === "intraday";
  const entryPriceCents = dollarsToCents(entryDollars);
  const stopPriceCents = dollarsToCents(stopDollars);
  const slippageCents = dollarsToCents(slippageDollars);
  const riskBudgetCents = dollarsToCents(riskBudgetDollars);
  const intradaySizing = useMemo(() => {
    if (!isIntraday || entryPriceCents == null || stopPriceCents == null || slippageCents == null || riskBudgetCents == null) return null;
    const riskPerShareCents = Math.abs(entryPriceCents - stopPriceCents) + slippageCents;
    if (riskPerShareCents <= 0) return null;
    const qty = Math.floor(riskBudgetCents / riskPerShareCents);
    return qty > 0 ? { qty, plannedRiskCents: qty * riskPerShareCents, notionalCents: qty * entryPriceCents } : null;
  }, [entryPriceCents, isIntraday, riskBudgetCents, slippageCents, stopPriceCents]);

  const suggestedRange = candidate.suggestedSizeHighCents != null
    ? `${money(candidate.suggestedSizeLowCents)}–${money(candidate.suggestedSizeHighCents)}`
    : money(candidate.suggestedSizeLowCents);

  const ticket = useMemo(() => {
    const deadlineAt = new Date(deadline).getTime();
    const timeStopAt = new Date(timeStop).getTime();
    const statedNotionalCents = Math.round(Number(notionalDollars) * 100);
    const noTradeConditions = noTradeText.split("\n").map((condition) => condition.trim()).filter(Boolean);
    return {
      runId,
      candidateId: candidate?.id,
      accountId: account?.id ?? 0,
      symbol: candidate?.symbol ?? "",
      side: candidate?.playSide === "short" ? ("sell" as const) : ("buy" as const),
      qty: isIntraday ? intradaySizing?.qty : undefined,
      notionalCents: !isIntraday && Number.isFinite(statedNotionalCents) && statedNotionalCents > 0 ? statedNotionalCents : undefined,
      orderType: isIntraday ? "limit" as const : "market" as const,
      limitPriceCents: isIntraday && entryPriceCents != null ? entryPriceCents : undefined,
      timeInForce: "day" as const,
      reason: reason || undefined,
      invalidationCondition: invalidationCondition || undefined,
      entryPriceCents: isIntraday && entryPriceCents != null ? entryPriceCents : undefined,
      stopPriceCents: isIntraday && stopPriceCents != null ? stopPriceCents : undefined,
      slippageCents: isIntraday && slippageCents != null ? slippageCents : undefined,
      timeStopAt: isIntraday && Number.isFinite(timeStopAt) ? timeStopAt : undefined,
      noTradeConditions: noTradeConditions.length ? noTradeConditions : undefined,
      holdingPeriod,
      catalystDeadlineAt: Number.isFinite(deadlineAt) ? deadlineAt : undefined,
      paperAcknowledgement: paperAcknowledgement || undefined,
    };
  }, [account?.id, candidate?.id, candidate?.symbol, deadline, entryPriceCents, invalidationCondition, intradaySizing?.qty, isIntraday, noTradeText, notionalDollars, paperAcknowledgement, reason, runId, slippageCents, stopPriceCents, timeStop, holdingPeriod]);

  useEffect(() => {
    if (!account || !candidate) {
      setPreflightInput(null);
      return;
    }
    const timer = window.setTimeout(() => setPreflightInput(ticket), 400);
    return () => window.clearTimeout(timer);
  }, [account, candidate, ticket]);

  const preflight = trpc.aperture.order.preflight.useQuery(preflightInput ?? ticket, {
    enabled: preflightInput != null,
    staleTime: 0,
    retry: false,
  });

  const submitProposal = () => {
    const deadlineAt = new Date(deadline).getTime();
    const notionalCents = Math.round(Number(notionalDollars) * 100);
    const timeStopAt = new Date(timeStop).getTime();
    const noTradeConditions = noTradeText.split("\n").map((condition) => condition.trim()).filter(Boolean);
    if (!account) return toast.error("Connect or select a paper account before preparing a proposal.");
    if (constructed.isLoading) return toast.error("Constructing the modeled recipe. Please wait before preparing a proposal.");
    if (!recipeCanPrepare) return toast.error(constructedPlay?.unavailableReasons[0] || "There is no measurable paper play to prepare.");
    if (!isIntraday && (!Number.isFinite(notionalCents) || notionalCents <= 0)) return toast.error("Enter a paper notional greater than $0.");
    if (!Number.isFinite(deadlineAt)) return toast.error("Set a valid catalyst deadline.");
    if (paperAcknowledgement !== "PAPER") return toast.error('Type PAPER to record your paper-only acknowledgement.');
    if (isIntraday) {
      if (!intradaySizing || entryPriceCents == null || stopPriceCents == null || slippageCents == null) return toast.error("Set a risk budget, entry, stop, and slippage to calculate the paper share quantity.");
      if (!Number.isFinite(timeStopAt)) return toast.error("Set a valid human close-review time for the intraday time stop.");
      if (!noTradeConditions.length) return toast.error("State at least one condition that means do not take this paper play.");
    }
    if (preflight.isFetching) return toast.error("Checking paper-order guardrails. Please wait for the live preflight.");
    if (!preflight.data?.wouldPass) return toast.error(preflight.data?.blocking[0] || "This proposal is not ready for the paper-order queue.");
    create.mutate({ ...ticket, accountId: account.id, candidateId: candidate.id, symbol: candidate.symbol, catalystDeadlineAt: deadlineAt, paperAcknowledgement: "PAPER" } as any);
  };

  return <Card style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
    <CardHeader className="pb-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Step 2 of 3 · Prepare a paper proposal</p>
          <CardTitle className="mt-1 text-lg">Turn the reviewed {candidate.symbol} research case into a proposal for your approval.</CardTitle>
          <CardDescription className="mt-1">Preparing this record does not approve, submit, or execute an order. It only places a paper-only proposal in the queue for your separate decision.</CardDescription>
        </div>
        <Badge variant="outline" style={{ color: "var(--sh-signal)" }}>Suggested research range: {suggestedRange}</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {!account ? <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>No connected paper account is available for this brief. Return to the research brief, then connect a paper account before preparing a proposal.</div> : <>
        <div className="rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Portfolio impact: this would be a new <strong style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol}</strong> {candidate.playSide === "short" ? "short" : "long"} paper exposure in <strong style={{ color: "var(--sh-text-primary)" }}>{account.label}</strong>. The ticket is prefilled from a <strong style={{ color: "var(--sh-text-primary)" }}>modeled recipe</strong>, not a recommendation or return forecast.</div>
        {constructed.isLoading ? <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Constructing the modeled entry, risk, and sizing recipe…</div> : !recipeCanPrepare ? <div className="rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-signal)", color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>No paper proposal is available.</strong> {constructedPlay?.unavailableReasons[0] || "Required tape or equity context is not measurable."}</div> : <div className="rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-signal)", color: "var(--sh-fg-muted)" }}>{constructed.data?.disclosure}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          {!isIntraday && <label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Paper notional (USD)<input type="number" min="1" step="100" value={notionalDollars} onChange={(event) => setNotionalDollars(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>}
          <label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Planned holding period<select value={holdingPeriod} onChange={(event) => setHoldingPeriod(event.target.value as HoldingPeriod)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }}><option value="intraday">Intraday</option><option value="overnight">Overnight</option><option value="swing">Swing</option><option value="catalyst_window">Catalyst window</option></select></label>
        </div>
        {isIntraday && <section className="space-y-3 rounded-lg border p-3" style={{ borderColor: "var(--sh-signal)", background: "color-mix(in srgb, var(--sh-signal) 5%, var(--sh-surface))" }}>
          <div><p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Intraday recipe · state the plan before a paper proposal exists</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>The system derives quantity from your maximum planned loss ÷ (entry-to-stop distance + slippage). It does not make a trade decision or auto-submit an order.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Maximum planned loss (USD)<input type="number" min="0.01" step="0.01" value={riskBudgetDollars} onChange={(event) => setRiskBudgetDollars(event.target.value)} placeholder="e.g., 25" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>
            <label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Entry price (USD)<input type="number" min="0.01" step="0.01" value={entryDollars} onChange={(event) => setEntryDollars(event.target.value)} placeholder="Current verified level" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>
            <label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Stop price (USD)<input type="number" min="0.01" step="0.01" value={stopDollars} onChange={(event) => setStopDollars(event.target.value)} placeholder="Invalidation level" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>
            <label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Slippage / share (USD)<input type="number" min="0" step="0.01" value={slippageDollars} onChange={(event) => setSlippageDollars(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>
          </div>
          <div className="rounded-md px-3 py-2 text-xs leading-5" style={{ background: "var(--sh-surface)", color: "var(--sh-fg-muted)" }}>{intradaySizing ? <>Derived paper plan: <strong style={{ color: "var(--sh-text-primary)" }}>{intradaySizing.qty.toLocaleString()} shares</strong> · estimated notional <strong style={{ color: "var(--sh-text-primary)" }}>{money(intradaySizing.notionalCents)}</strong> · planned loss <strong style={{ color: "var(--sh-text-primary)" }}>{money(intradaySizing.plannedRiskCents)}</strong>{account.equityValueCents ? <> · <strong style={{ color: "var(--sh-text-primary)" }}>{((intradaySizing.plannedRiskCents / account.equityValueCents) * 100).toFixed(2)}%</strong> of measured equity</> : " · equity not measured, so planned-loss percentage is not measured"}.</> : "Enter all four values to derive the paper quantity. No proposal can be created until this calculation is complete."}</div>
          <div className="rounded-md border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><strong style={{ color: "var(--sh-text-primary)" }}>Tape basis:</strong> {constructedPlay?.tapeBasis || "Not measured."} {constructedPlay?.trigger?.basis || "Confirm the trigger against a real-time terminal before human approval."}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Human close-review time<input type="datetime-local" value={timeStop} onChange={(event) => setTimeStop(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--sh-border-1)" }} /></label>
            <label className="block space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>No-trade conditions (one per line)<textarea value={noTradeText} onChange={(event) => setNoTradeText(event.target.value)} rows={3} placeholder="e.g., Skip if price cannot hold above VWAP after the catalyst window." className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--sh-border-1)" }} /></label>
          </div>
        </section>}
        <label className="block space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Why this proposal belongs in the paper portfolio<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <label className="block space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>What would make you reject or exit it<textarea value={invalidationCondition} onChange={(event) => setInvalidationCondition(event.target.value)} rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <label className="block space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Catalyst deadline<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <section className="space-y-2 rounded-lg border p-3" style={{ borderColor: preflight.data?.wouldPass ? "oklch(0.55 0.15 145)" : "var(--sh-border-1)", background: "var(--sh-surface)" }}><div className="flex items-center gap-2">{preflight.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--sh-signal)" }} /> : preflight.data?.wouldPass ? <ShieldCheck className="h-3.5 w-3.5" style={{ color: "oklch(0.55 0.15 145)" }} /> : <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--sh-signal)" }} />}<p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{preflight.isFetching ? "Checking paper-order guardrails…" : preflight.data?.wouldPass ? "Preflight complete — this can enter the human approval queue." : "Preflight is blocking this proposal."}</p></div>{preflight.data?.notionalBasis === "derived_from_last_price" && <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Modeled figure: the mandate ceiling used a notional derived from the last recorded price.</p>}{preflight.data?.blocking.map((block) => <p key={block} className="text-xs leading-5" style={{ color: "var(--sh-red)" }}>{block}</p>)}{preflight.data?.evaluation.notes.map((note) => <p key={note} className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{note}</p>)}</section>
        <label className="block space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Type <span className="font-mono">PAPER</span> to acknowledge paper-only use<input value={paperAcknowledgement} onChange={(event) => setPaperAcknowledgement(event.target.value)} autoComplete="off" placeholder="PAPER" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>A paper proposal still requires a separate human approval and a separate human submission to Alpaca Paper. No live capital is involved.</p>
        <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}><Button onClick={submitProposal} disabled={create.isPending || constructed.isLoading || !recipeCanPrepare || preflight.isFetching || !preflight.data?.wouldPass}>{create.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}Create paper proposal</Button><Button variant="outline" onClick={onReturnToBrief}>Return to evidence review</Button></div>
      </>}
    </CardContent>
  </Card>;
}
