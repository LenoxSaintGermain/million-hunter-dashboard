import { useState } from "react";
import { Activity, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildOccOptionSymbol, paperInstrumentLabel, type PaperInstrumentType } from "@shared/paperInstrument";

const cents = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : undefined;
};

const money = (value: number | null | undefined) => value == null
  ? "—"
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value / 100);

export function AccountContextPanel({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();
  const { data: positions } = trpc.aperture.account.getPositions.useQuery({ accountId });
  const { data: plays } = trpc.aperture.account.listActivePlays.useQuery({ accountId });
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [instrumentType, setInstrumentType] = useState<PaperInstrumentType>("shares");
  const [optionExpirationDate, setOptionExpirationDate] = useState("");
  const [optionStrike, setOptionStrike] = useState("");
  const [side, setSide] = useState<"long" | "short">("long");
  const [status, setStatus] = useState<"watching" | "active" | "closed">("active");
  const [horizon, setHorizon] = useState("");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [thesis, setThesis] = useState("");

  const refresh = async () => {
    await Promise.all([
      utils.aperture.account.listActivePlays.invalidate({ accountId }),
      utils.aperture.account.getPositions.invalidate({ accountId }),
    ]);
  };
  const upsert = trpc.aperture.account.upsertActivePlay.useMutation({
    onSuccess: async ({ symbol: savedSymbol }) => {
      toast.success(`${savedSymbol} play context saved`);
      setSymbol(""); setInstrumentType("shares"); setOptionExpirationDate(""); setOptionStrike(""); setHorizon(""); setEntry(""); setStop(""); setTarget(""); setThesis(""); setOpen(false);
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.aperture.account.removeActivePlay.useMutation({
    onSuccess: async () => { toast.success("Play context removed"); await refresh(); },
    onError: (error) => toast.error(error.message),
  });

  const save = () => {
    if (!symbol.trim()) return toast.error(instrumentType === "shares" ? "Enter the ticker." : "Enter the underlying ticker.");
    if (thesis.trim().length < 10) return toast.error("Add a short note explaining why this play is in progress.");
    const strikePriceCents = cents(optionStrike);
    const contractSymbol = instrumentType === "shares" ? symbol.trim() : strikePriceCents == null ? null : buildOccOptionSymbol({ underlyingSymbol: symbol, expirationDate: optionExpirationDate, optionType: instrumentType === "long_call" ? "call" : "put", strikePriceCents });
    if (!contractSymbol) return toast.error("Choose a valid expiration and strike for the exact option contract.");
    upsert.mutate({
      accountId,
      symbol: contractSymbol,
      instrumentType,
      underlyingSymbol: instrumentType === "shares" ? undefined : symbol.trim(),
      optionExpirationDate: instrumentType === "shares" ? undefined : optionExpirationDate,
      optionStrikePriceCents: instrumentType === "shares" ? undefined : strikePriceCents,
      contractMultiplier: instrumentType === "shares" ? undefined : 100,
      side: instrumentType === "shares" ? side : "long",
      status,
      horizon: horizon.trim() || undefined,
      thesisNote: thesis.trim(),
      entryPriceCents: cents(entry),
      stopPriceCents: cents(stop),
      targetPriceCents: cents(target),
    });
  };

  return <section className="space-y-3 rounded-lg border p-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>Current portfolio context</p>
        <p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{positions?.length ?? 0} held ticker{positions?.length === 1 ? "" : "s"} · {plays?.filter((play) => play.status !== "closed").length ?? 0} play{plays?.filter((play) => play.status !== "closed").length === 1 ? "" : "s"} in progress</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
        {open ? "Close" : "Mirror a play"}
      </Button>
    </div>

    {!!positions?.length && <div className="flex flex-wrap gap-1.5" aria-label="Imported holdings">
      {positions.slice(0, 12).map((position) => <Badge key={position.id} variant="outline" className="font-mono text-[11px]">{position.symbol} · {position.qty}</Badge>)}
      {positions.length > 12 && <Badge variant="outline" className="text-[11px]">+{positions.length - 12} more</Badge>}
    </div>}

    {!!plays?.length && <div className="space-y-2">
      {plays.filter((play) => play.status !== "closed").map((play) => <div key={play.id} className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5"><strong className="text-sm">{paperInstrumentLabel({ instrumentType: play.instrumentType, symbol: play.symbol, underlyingSymbol: play.underlyingSymbol, optionExpirationDate: play.optionExpirationDate, optionStrikePriceCents: play.optionStrikePriceCents })}</strong><Badge variant="outline" className="text-[10px]">{play.side}</Badge><Badge variant="outline" className="text-[10px]">{play.status}</Badge>{play.horizon && <span className="text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>{play.horizon}</span>}</div>
          {play.instrumentType !== "shares" && <p className="mt-1 break-all font-mono text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>{play.symbol}</p>}
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{play.thesisNote}</p>
          {(play.entryPriceCents || play.stopPriceCents || play.targetPriceCents) && <p className="mt-1 text-[11px]" style={{ color: "var(--sh-fg-muted)" }}>Entry {money(play.entryPriceCents)} · stop {money(play.stopPriceCents)} · target {money(play.targetPriceCents)}</p>}
        </div>
        <Button variant="ghost" size="icon" aria-label={`Remove ${play.symbol} play context`} onClick={() => remove.mutate({ accountId, id: play.id })} disabled={remove.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>)}
    </div>}

    {open && <div className="space-y-3 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>
      <div className="flex items-start gap-2 rounded-md px-3 py-2 text-xs leading-5" style={{ background: "color-mix(in srgb, var(--sh-signal) 8%, transparent)", color: "var(--sh-fg-muted)" }}><Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} /><span>Record what is already in play so Aperture can test new ideas against it. This does not create or import a broker order.</span></div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="space-y-1"><Label className="text-xs">Instrument</Label><Select value={instrumentType} onValueChange={(value) => setInstrumentType(value as PaperInstrumentType)}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="shares">Shares</SelectItem><SelectItem value="long_call">Long call</SelectItem><SelectItem value="long_put">Long put</SelectItem></SelectContent></Select></label>
        <label className="space-y-1"><Label className="text-xs">{instrumentType === "shares" ? "Ticker" : "Underlying ticker"}</Label><Input className="min-h-11" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="e.g. NVDA" /></label>
        <label className="space-y-1"><Label className="text-xs">Side</Label><Select value={instrumentType === "shares" ? side : "long"} onValueChange={(value) => setSide(value as "long" | "short")} disabled={instrumentType !== "shares"}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="long">Long</SelectItem><SelectItem value="short">Short</SelectItem></SelectContent></Select></label>
        <label className="space-y-1"><Label className="text-xs">State</Label><Select value={status} onValueChange={(value) => setStatus(value as "watching" | "active" | "closed")}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active now</SelectItem><SelectItem value="watching">Watching</SelectItem><SelectItem value="closed">Closed context</SelectItem></SelectContent></Select></label>
      </div>
      {instrumentType !== "shares" && <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><Label className="text-xs">Expiration</Label><Input className="min-h-11" value={optionExpirationDate} onChange={(event) => setOptionExpirationDate(event.target.value)} type="date" /></label><label className="space-y-1"><Label className="text-xs">Strike ($)</Label><Input className="min-h-11" value={optionStrike} onChange={(event) => setOptionStrike(event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" /></label></div>}
      <label className="block space-y-1"><Label className="text-xs">Why is this play in progress?</Label><textarea value={thesis} onChange={(event) => setThesis(event.target.value)} className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--sh-border-1)" }} placeholder="The thesis, catalyst, or condition you are testing. State what would change your mind." /></label>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="space-y-1"><Label className="text-xs">Review horizon</Label><Input className="min-h-11" value={horizon} onChange={(event) => setHorizon(event.target.value)} placeholder="Today / 3 months / long term" /></label>
        <label className="space-y-1"><Label className="text-xs">{instrumentType === "shares" ? "Entry" : "Premium entry"} ($)</Label><Input className="min-h-11" value={entry} onChange={(event) => setEntry(event.target.value)} inputMode="decimal" /></label>
        <label className="space-y-1"><Label className="text-xs">{instrumentType === "shares" ? "Stop" : "Premium review level"} ($)</Label><Input className="min-h-11" value={stop} onChange={(event) => setStop(event.target.value)} inputMode="decimal" /></label>
        <label className="space-y-1"><Label className="text-xs">{instrumentType === "shares" ? "Target" : "Premium target"} ($)</Label><Input className="min-h-11" value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" /></label>
      </div>
      <div className="flex justify-end"><Button className="min-h-11" onClick={save} disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : "Save play context"}</Button></div>
    </div>}
  </section>;
}
