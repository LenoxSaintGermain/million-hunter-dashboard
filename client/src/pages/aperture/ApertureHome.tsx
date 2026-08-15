/**
 * Capital Aperture — Home / Run Setup
 *
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 * Modeled figures are labeled as such throughout.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Play, Plus, RefreshCw, Trash2, BookOpen, TrendingUp, ArrowUpRight, Compass, Layers3, Target, Info, Lightbulb, DatabaseZap, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDistanceToNow } from "date-fns";

const DISCLAIMER = "Internal research tool — not investment advice. Modeled figures are labeled as such.";

function DisclaimerBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
      style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
      {DISCLAIMER}
    </div>
  );
}

function dollarsToCents(v: string): number {
  return Math.round(parseFloat(v.replace(/[^0-9.]/g, "")) * 100);
}

const HORIZON_GUIDANCE = {
  intraday: {
    title: "Intraday decision",
    recommendation: "Use only when the thesis has a same-day, observable catalyst. Keep exposure tight and plan to be flat before the close.",
    liquidity: "50,000,000",
    concentration: "5",
  },
  overnight: {
    title: "Overnight decision",
    recommendation: "Use when the catalyst resolves by the next close. Overnight risk is real, so name concentration should stay conservative.",
    liquidity: "35,000,000",
    concentration: "7.5",
  },
  swing: {
    title: "Swing decision",
    recommendation: "Use when the evidence can mature over 2–10 sessions. State the evidence that would disprove the premise before you research names.",
    liquidity: "20,000,000",
    concentration: "10",
  },
  catalyst_window: {
    title: "Catalyst-window decision",
    recommendation: "Use only when a dated event can resolve the thesis within 20 sessions. The deadline is a research stop, not permission to keep holding.",
    liquidity: "20,000,000",
    concentration: "10",
  },
} as const;

const PROVIDER_GUIDANCE: Record<string, { enables: string; activation: string }> = {
  edgar: {
    enables: "Company filings, revenue, margins, and balance-sheet facts.",
    activation: "Connected automatically — no key required.",
  },
  fred: {
    enables: "Macro series for rates, inflation, employment, and growth context.",
    activation: "Add a free FRED API key in Settings to enable macro evidence.",
  },
  alpaca: {
    enables: "Delayed IEX price, 30-day dollar liquidity, and modeled volatility for paper research.",
    activation: "Uses your Alpaca Paper credentials. Data is delayed and IEX-only, so it is never presented as a consolidated live quote.",
  },
  polygon: {
    enables: "Consolidated daily price and volume evidence across the broader market.",
    activation: "Add POLYGON_API_KEY in Settings when you need consolidated market coverage.",
  },
  fmp: {
    enables: "Valuation, profile, sector, industry, and transcript-adjacent evidence.",
    activation: "Add FMP_API_KEY in Settings when you need richer fundamental coverage.",
  },
  benzinga: {
    enables: "Analyst actions, price targets, and earnings-calendar catalysts.",
    activation: "Add BENZINGA_API_KEY in Settings when catalyst and analyst evidence matter to the thesis.",
  },
};

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label={`Explain ${label}`} className="text-muted-foreground hover:text-foreground">
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[280px] text-xs leading-relaxed">{help}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default function ApertureHome() {
  const [, navigate] = useLocation();
  const [selectedThesisId, setSelectedThesisId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [deployable, setDeployable] = useState("");
  const [hurdleRate, setHurdleRate] = useState("");
  // Short-Horizon Paper Run preset. These five fields ARE the mandate — the run
  // cannot start without them. The values below are the mandate's own ceilings
  // (server/aperture/mandate.ts), prefilled as a starting point; the server is
  // authoritative and rejects anything looser, so tightening here is the only
  // thing this form can actually do.
  const [holdingPeriod, setHoldingPeriod] = useState("");
  const [liquidityFloor, setLiquidityFloor] = useState("20000000");
  const [maxSingleName, setMaxSingleName] = useState("10");
  const [catalystDeadline, setCatalystDeadline] = useState("");
  const [invalidationRule, setInvalidationRule] = useState("");
  const [intendedTrades, setIntendedTrades] = useState<Array<{ symbol: string; dollars: string; note: string }>>([]);
  const [starting, setStarting] = useState(false);

  const { data: theses, refetch: refetchTheses } = trpc.aperture.thesis.list.useQuery();
  const { data: canonicalTheses } = trpc.thesis.list.useQuery();
  const { data: accounts } = trpc.aperture.account.list.useQuery();
  const { data: runs, refetch: refetchRuns } = trpc.aperture.run.list.useQuery();
  const { data: providers } = trpc.aperture.providers.useQuery();

  const startRun = trpc.aperture.run.start.useMutation({
    onSuccess: ({ runId }) => {
      toast.success("Run started — polling for results");
      refetchRuns();
      navigate(`/aperture/run/${runId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteThesis = trpc.aperture.thesis.delete.useMutation({
    onSuccess: () => { toast.success("Thesis deleted"); refetchTheses(); },
    onError: (e) => toast.error(e.message),
  });
  const [canonicalThesisId, setCanonicalThesisId] = useState<string>("");
  const projectCanonicalThesis = trpc.thesis.useInAperture.useMutation({
    onSuccess: async ({ apertureThesisId, linked }) => {
      await refetchTheses();
      setSelectedThesisId(apertureThesisId);
      setCanonicalThesisId("");
      toast.success(linked ? "Capital projection refreshed" : "Thesis added to Aperture", {
        description: "The same saved thesis now powers this Capital Aperture run.",
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleStart = () => {
    if (!selectedThesisId) return toast.error("Select a thesis first");
    if (!deployable) return toast.error("Enter deployable capital");
    if (!holdingPeriod) return toast.error("Choose a holding period — it is part of the mandate");
    if (!catalystDeadline) return toast.error("Set a catalyst deadline — a short-horizon run without one is a hold");
    if (!invalidationRule.trim()) return toast.error("State what would make this run wrong");
    const deadlineMs = Date.parse(catalystDeadline);
    if (!Number.isFinite(deadlineMs)) return toast.error("Catalyst deadline is not a valid date");
    setStarting(true);
    startRun.mutate({
      thesisId: selectedThesisId,
      accountId: selectedAccountId ?? undefined,
      deployableCapitalCents: dollarsToCents(deployable),
      hurdleRateBps: hurdleRate ? Math.round(parseFloat(hurdleRate) * 100) : undefined,
      holdingPeriod,
      liquidityFloorAdvUsd: Math.round(parseFloat(liquidityFloor.replace(/[^0-9.]/g, "")) || 0),
      catalystDeadlineAt: deadlineMs,
      maxSingleNamePct: parseFloat(maxSingleName) || 0,
      invalidationRule: invalidationRule.trim(),
      intendedTrades: intendedTrades
        .filter((t) => t.symbol.trim() && t.dollars.trim())
        .map((t) => ({ symbol: t.symbol.trim().toUpperCase(), dollarsCents: dollarsToCents(t.dollars) })),
    });
    setStarting(false);
  };

  const addTrade = () => setIntendedTrades((p) => [...p, { symbol: "", dollars: "", note: "" }]);
  const removeTrade = (i: number) => setIntendedTrades((p) => p.filter((_, idx) => idx !== i));
  const updateTrade = (i: number, field: string, val: string) =>
    setIntendedTrades((p) => p.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const liveProviders = providers?.filter((p) => p.available) ?? [];
  const deadProviders = providers?.filter((p) => !p.available) ?? [];
  const selectedThesis = theses?.find((thesis) => thesis.id === selectedThesisId);
  const selectedHorizon = selectedThesis?.graph?.horizons?.[0] ?? null;
  const unprojectedCanonicalTheses = (canonicalTheses ?? []).filter(
    (canonical) => !(theses ?? []).some((projection) => projection.sourceCompilationId === canonical.id),
  );
  const horizonGuidance = holdingPeriod ? HORIZON_GUIDANCE[holdingPeriod as keyof typeof HORIZON_GUIDANCE] : null;
  const invalidationExamples = useMemo(() => [
    {
      label: "Missed or negative catalyst",
      text: "Invalidate if the stated catalyst does not occur by the deadline, or its disclosed result contradicts the thesis.",
    },
    {
      label: "Fundamentals deteriorate",
      text: "Invalidate if new filings show the revenue, margin, or balance-sheet condition that supports this thesis is deteriorating.",
    },
    {
      label: "Mandate breach",
      text: "Invalidate if the portfolio would exceed its concentration or liquidity mandate after the evidence changes.",
    },
  ], []);

  const applyHorizonRecommendation = () => {
    if (!horizonGuidance) return;
    setLiquidityFloor(horizonGuidance.liquidity);
    setMaxSingleName(horizonGuidance.concentration);
    toast.success("Recommended guardrails applied", { description: "You can tighten these further; the server will not allow looser mandate limits." });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <DisclaimerBanner />

        <header className="max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <Compass className="h-5 w-5" style={{ color: "var(--sh-signal)" }} />
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.17em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · Paper research</span>
            <Badge variant="outline" className="text-xs">Human-approved only</Badge>
          </div>
          <h1 className="font-serif text-3xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>Build a capital brief before you consider a paper allocation.</h1>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--sh-text-secondary)" }}>
            Start with the belief and time horizon that matter. Aperture will map what your portfolio already expresses, what is missing, and which research decision deserves attention next.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Run Setup */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-xl">Frame the decision</CardTitle>
                <CardDescription>Thesis horizon → portfolio context → evidence brief. Symbols are reviewed later, as evidence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Thesis */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">1 · Which belief should be re-underwritten?</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedThesisId?.toString() ?? ""}
                      onValueChange={(v) => setSelectedThesisId(Number(v))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a thesis…" />
                      </SelectTrigger>
                      <SelectContent>
                        {theses?.map((t) => (
                          <SelectItem key={t.id} value={t.id.toString()}>
                            {t.name ?? `Thesis #${t.id}`}
                            {t.sourceCompilationId ? " · canonical" : " · legacy"}
                            {t.status !== "active" && (
                              <span className="ml-2 text-xs opacity-50">({t.status})</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => navigate("/thesis?scope=capital")}>
                      <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Create capital thesis
                    </Button>
                  </div>
                  {selectedThesisId && (
                    <div className="rounded-lg border p-3 text-xs" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
                      <div className="flex items-center gap-2"><Target className="h-3.5 w-3.5" style={{ color: "var(--sh-signal)" }} /><span><strong style={{ color: "var(--sh-text-primary)" }}>Research horizon:</strong> {selectedHorizon ?? "Not set — add one in the Capital / Trade thesis so catalyst timing and long-duration fit can be separated."}</span></div>
                      {selectedThesis?.confidenceNotes?.length ? <p className="mt-2" style={{ color: "var(--sh-signal)" }}>Compiler notes: {selectedThesis.confidenceNotes.join(" · ")}</p> : null}
                    </div>
                  )}
                  {unprojectedCanonicalTheses.length > 0 && (
                    <div className="rounded-md border border-dashed border-emerald-500/35 bg-emerald-500/5 p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <BookOpen className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Saved in Thesis Engine</p>
                          <p className="text-[11px] text-muted-foreground">Project a saved thesis here—no duplicate entry, and future refreshes preserve the same link.</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Select value={canonicalThesisId} onValueChange={setCanonicalThesisId}>
                          <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Select a saved thesis…" /></SelectTrigger>
                          <SelectContent>
                            {unprojectedCanonicalTheses.map((thesis) => (
                              <SelectItem key={thesis.id} value={String(thesis.id)}>{thesis.name ?? `Untitled Thesis #${thesis.id}`}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-emerald-500/30 text-emerald-700"
                          disabled={!canonicalThesisId || projectCanonicalThesis.isPending}
                          onClick={() => projectCanonicalThesis.mutate({ compilationId: Number(canonicalThesisId) })}
                        >
                          {projectCanonicalThesis.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Use in Aperture"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Account */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">2 · What must this fit alongside? <span className="opacity-50">(portfolio context)</span></Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedAccountId?.toString() ?? "none"}
                      onValueChange={(v) => setSelectedAccountId(v === "none" ? null : Number(v))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="No account (run without holdings)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No account</SelectItem>
                        {accounts?.map((a) => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            {a.label} · {a.brokerId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => navigate("/aperture/accounts")}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Manage
                    </Button>
                  </div>
                </div>

                {/* Capital + Hurdle */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel label="3 · Paper capital available ($)" help="The maximum simulated capital you are willing to evaluate for this run. It is not an order and is never sent to a broker automatically." />
                    <Input
                      placeholder="e.g. 25000"
                      value={deployable}
                      onChange={(e) => setDeployable(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel label="Decision hurdle (%)" help="An optional minimum evidence-adjusted return threshold for comparing research postures. Leave blank if this run is about validating a thesis rather than selecting an allocation." />
                    <Input
                      placeholder="e.g. 8"
                      value={hurdleRate}
                      onChange={(e) => setHurdleRate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Short-Horizon Paper Run preset — the mandate, per run */}
                <div className="space-y-3 rounded-lg p-3" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                  <div>
                    <Label className="text-xs font-semibold">Short-Horizon decision guardrails</Label>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>
                      These are the rules that keep a short-horizon research idea from becoming an unbounded hold. They constrain paper-order review; they never submit an order.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <FieldLabel label="Holding Period" help="Choose how long the evidence is allowed to work. This determines when Aperture should stop researching the idea and ask for a new decision." />
                      <Select value={holdingPeriod} onValueChange={setHoldingPeriod}>
                        <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="intraday">Intraday — flat by 15:55 ET</SelectItem>
                          <SelectItem value="overnight">Overnight — exit by the next close</SelectItem>
                          <SelectItem value="swing">Swing — 2 to 10 sessions</SelectItem>
                          <SelectItem value="catalyst_window">Catalyst window — up to 20 sessions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel label="Catalyst Deadline" help="The latest date when the event or evidence should resolve the premise. If it does not, Aperture treats the research decision as expired rather than quietly extending it." />
                      <Input type="datetime-local" value={catalystDeadline} onChange={(e) => setCatalystDeadline(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel label="Liquidity Floor — 30d ADV ($)" help="Minimum 30-day average daily dollar volume. It helps prevent a paper idea from looking executable when it would be difficult to enter or exit at the planned size." />
                      <Input value={liquidityFloor} onChange={(e) => setLiquidityFloor(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel label="Concentration Cap — single name (%)" help="Maximum share of this run’s paper capital assigned to one company. It controls single-name risk even when the thesis looks compelling." />
                      <Input value={maxSingleName} onChange={(e) => setMaxSingleName(e.target.value)} />
                    </div>
                  </div>
                  {horizonGuidance && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-2">
                        <Lightbulb className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">Recommended guardrails for this {horizonGuidance.title.toLowerCase()}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{horizonGuidance.recommendation}</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={applyHorizonRecommendation}>Use recommendations</Button>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <FieldLabel label="What would make this run invalid?" help="Write the evidence condition—not a price move—that would prove the research premise wrong. This creates a visible stop condition for the thesis, the deadline, and future monitoring." />
                    <Input
                      placeholder="Example: if the earnings release cuts guidance or the stated catalyst does not occur by the deadline…"
                      value={invalidationRule}
                      onChange={(e) => setInvalidationRule(e.target.value)}
                    />
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>
                      This is not a stop-loss instruction. It is the evidence that would tell you the premise no longer deserves capital research.
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {invalidationExamples.map((example) => (
                        <Button key={example.label} type="button" size="sm" variant="outline" className="h-auto min-h-7 whitespace-normal px-2 py-1 text-left text-[10px] leading-snug" onClick={() => setInvalidationRule(example.text)}>
                          {example.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Intended trades */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Your starting view <span className="opacity-50">(ideas to re-underwrite, not commitments)</span></Label>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addTrade}>
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  {intendedTrades.map((t, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        className="w-24 text-xs"
                        placeholder="TICKER"
                        value={t.symbol}
                        onChange={(e) => updateTrade(i, "symbol", e.target.value.toUpperCase())}
                      />
                      <Input
                        className="w-28 text-xs"
                        placeholder="$ amount"
                        value={t.dollars}
                        onChange={(e) => updateTrade(i, "dollars", e.target.value)}
                      />
                      <Input
                        className="flex-1 text-xs"
                        placeholder="Note (optional)"
                        value={t.note}
                        onChange={(e) => updateTrade(i, "note", e.target.value)}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTrade(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {intendedTrades.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                      No starting ideas — Aperture will map the thesis and research the evidence universe from scratch.
                    </p>
                  )}
                </div>

                <Separator />
                <Button
                  className="w-full"
                  disabled={!selectedThesisId || !deployable || starting || startRun.isPending}
                  onClick={handleStart}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {startRun.isPending ? "Building brief…" : "Build Capital Brief"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: provider status + recent runs */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">Evidence sources</CardTitle>
                    <CardDescription className="mt-1 text-[11px]">A source is either connected, or its missing coverage is named before a brief starts.</CardDescription>
                  </div>
                  <DatabaseZap className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {liveProviders.map((p) => (
                  <div key={p.id} className="rounded-md border p-2.5" style={{ borderColor: "color-mix(in srgb, var(--sh-signal) 32%, transparent)", background: "color-mix(in srgb, var(--sh-signal) 5%, transparent)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>{p.label}</p>
                      <Badge className="shrink-0 text-[10px] px-1.5 py-0" style={{ background: "oklch(0.45 0.15 145)", color: "#fff" }}><CheckCircle2 className="mr-1 h-2.5 w-2.5" />Connected</Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>{PROVIDER_GUIDANCE[p.id]?.enables ?? `Provides: ${p.provides.join(", ")}`}</p>
                    <p className="mt-1 text-[10px] leading-relaxed" style={{ color: "var(--sh-signal)" }}>{PROVIDER_GUIDANCE[p.id]?.activation ?? "Connected for this run."}</p>
                  </div>
                ))}
                {deadProviders.map((p) => (
                  <div key={p.id} className="rounded-md border p-2.5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium" style={{ color: "var(--sh-text-primary)" }}>{p.label}</p>
                      <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0"><KeyRound className="mr-1 h-2.5 w-2.5" />Needs key</Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>{PROVIDER_GUIDANCE[p.id]?.enables ?? `Would cover: ${p.provides.join(", ")}`}</p>
                    <p className="mt-1 text-[10px] leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>{PROVIDER_GUIDANCE[p.id]?.activation ?? p.reason}</p>
                    <Button type="button" variant="ghost" size="sm" className="mt-1.5 h-7 px-0 text-[11px]" onClick={() => navigate("/settings")}>
                      View activation settings <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {!providers && <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Loading…</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Recent Capital Briefs</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchRuns()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {runs?.slice(0, 8).map((r) => (
                  <button
                    key={r.id}
                    className="w-full text-left p-2 rounded-md text-xs hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/aperture/run/${r.id}`)}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium" style={{ color: "var(--sh-text-primary)" }}>Brief #{r.id}</span>
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0"
                        style={{
                          color: r.status === "completed" ? "oklch(0.55 0.15 145)" :
                            r.status === "failed" ? "var(--sh-red)" : "var(--sh-signal)",
                        }}
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <div style={{ color: "var(--sh-fg-muted)" }}>
                      {r.candidateCount ?? "—"} research inputs · review decision frame · {formatDistanceToNow(r.createdAt)} ago
                    </div>
                  </button>
                ))}
                {runs?.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>No runs yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
