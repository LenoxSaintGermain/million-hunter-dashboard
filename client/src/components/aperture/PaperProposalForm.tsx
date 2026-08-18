import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type HoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window";

function money(cents: number | null | undefined) {
  if (cents == null) return "Not modeled";
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function safeHoldingPeriod(value: unknown): HoldingPeriod {
  return ["intraday", "overnight", "swing", "catalyst_window"].includes(String(value))
    ? value as HoldingPeriod
    : "swing";
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
  const [reason, setReason] = useState(`Paper-only proposal based on the recorded human review of ${candidate?.symbol ?? "this"} research evidence.`);
  const [invalidationCondition, setInvalidationCondition] = useState(run?.invalidationRule ?? "Do not proceed, or exit the paper position, if the thesis evidence no longer supports the decision.");
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>(() => safeHoldingPeriod(run?.holdingPeriod));
  const [deadline, setDeadline] = useState(() => new Date(run?.catalystDeadlineAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [acknowledged, setAcknowledged] = useState(false);
  const create = trpc.aperture.order.create.useMutation({
    onSuccess: () => {
      toast.success("Paper proposal created. It is waiting for your separate approval.");
      onProposalCreated();
    },
    onError: (error) => toast.error(error.message),
  });

  if (!candidate) return null;
  const suggestedRange = candidate.suggestedSizeHighCents != null
    ? `${money(candidate.suggestedSizeLowCents)}–${money(candidate.suggestedSizeHighCents)}`
    : money(candidate.suggestedSizeLowCents);
  const submitProposal = () => {
    const deadlineAt = new Date(deadline).getTime();
    const notionalCents = Math.round(Number(notionalDollars) * 100);
    if (!account) return toast.error("Connect or select a paper account before preparing a proposal.");
    if (!Number.isFinite(notionalCents) || notionalCents <= 0) return toast.error("Enter a paper notional greater than $0.");
    if (!Number.isFinite(deadlineAt)) return toast.error("Set a valid catalyst deadline.");
    if (!acknowledged) return toast.error("Confirm that this is a paper-only proposal before continuing.");
    create.mutate({
      runId,
      candidateId: candidate.id,
      accountId: account.id,
      symbol: candidate.symbol,
      side: "buy",
      notionalCents,
      orderType: "market",
      timeInForce: "day",
      reason,
      invalidationCondition,
      holdingPeriod,
      catalystDeadlineAt: deadlineAt,
      paperAcknowledgement: "PAPER",
    });
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
        <div className="rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Portfolio impact: this would be a new <strong style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol}</strong> paper exposure in <strong style={{ color: "var(--sh-text-primary)" }}>{account.label}</strong>. The suggested range is research context, not a recommendation or return forecast.</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Paper notional (USD)<input type="number" min="1" step="100" value={notionalDollars} onChange={(event) => setNotionalDollars(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} /></label>
          <label className="space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Planned holding period<select value={holdingPeriod} onChange={(event) => setHoldingPeriod(event.target.value as HoldingPeriod)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }}><option value="intraday">Intraday</option><option value="overnight">Overnight</option><option value="swing">Swing</option><option value="catalyst_window">Catalyst window</option></select></label>
        </div>
        <label className="block space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Why this proposal belongs in the paper portfolio<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <label className="block space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>What would make you reject or exit it<textarea value={invalidationCondition} onChange={(event) => setInvalidationCondition(event.target.value)} rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <label className="block space-y-1.5 text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>Catalyst deadline<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-normal" style={{ borderColor: "var(--sh-border-1)" }} /></label>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5" />I understand this is a paper-only proposal. I will separately approve it before it can be sent to Alpaca Paper. No live capital is involved.</label>
        <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}><Button onClick={submitProposal} disabled={create.isPending}>{create.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}Create paper proposal</Button><Button variant="outline" onClick={onReturnToBrief}>Return to evidence review</Button></div>
      </>}
    </CardContent>
  </Card>;
}
