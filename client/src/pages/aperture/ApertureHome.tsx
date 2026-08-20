/**
 * Capital Aperture — Home / Run Setup
 *
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 * Modeled figures are labeled as such throughout.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Plus, RefreshCw, Trash2, BookOpen, TrendingUp, ArrowUpRight, Compass, Layers3, Target, Info, Lightbulb, DatabaseZap, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDistanceToNow } from "date-fns";
import { buildResearchJourneys } from "@shared/runWorkspace";
import { addDaysToEasternDate, easternDateTimeInputFromEpoch, easternDateTimeInputToEpoch } from "@shared/easternMarketTime";
import { DailyPlayList } from "@/components/aperture/DailyPlayList";

function dollarsToCents(v: string): number {
  return Math.round(parseFloat(v.replace(/[^0-9.]/g, "")) * 100);
}

function defaultCatalystDeadline(holdingPeriod = "swing"): string {
  const daysByPeriod: Record<string, number> = { intraday: 1, overnight: 1, swing: 10, catalyst_window: 20 };
  const now = Date.now();
  if (holdingPeriod === "intraday") {
    let candidate = `${easternDateTimeInputFromEpoch(now).slice(0, 10)}T15:55`;
    if ((easternDateTimeInputToEpoch(candidate) ?? 0) <= now) candidate = `${addDaysToEasternDate(candidate, 1)}T15:55`;
    return candidate;
  }
  const deadline = new Date(now + (daysByPeriod[holdingPeriod] ?? 10) * 86_400_000);
  deadline.setMinutes(0, 0, 0);
  return easternDateTimeInputFromEpoch(deadline.getTime());
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

function FieldLabel({ label, help, inputId }: { label: string; help: string; inputId?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
      <Label htmlFor={inputId} className="text-xs font-medium">{label}</Label>
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
      <p className="text-[11px] leading-4 sm:hidden" style={{ color: "var(--sh-fg-muted)" }}>{help}</p>
    </div>
  );
}

export default function ApertureHome() {
  const [, navigate] = useLocation();
  const [showResearchSetup, setShowResearchSetup] = useState(() => new URLSearchParams(window.location.search).get("setup") === "1");
  const [selectedThesisId, setSelectedThesisId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [deployable, setDeployable] = useState("20000");
  // Short-Horizon Paper Run preset. These five fields ARE the mandate — the run
  // cannot start without them. The values below are the mandate's own ceilings
  // (server/aperture/mandate.ts), prefilled as a starting point; the server is
  // authoritative and rejects anything looser, so tightening here is the only
  // thing this form can actually do.
  const [holdingPeriod, setHoldingPeriod] = useState("swing");
  const [liquidityFloor, setLiquidityFloor] = useState("20000000");
  const [maxSingleName, setMaxSingleName] = useState("10");
  const [catalystDeadline, setCatalystDeadline] = useState(() => defaultCatalystDeadline());
  const [invalidationRule, setInvalidationRule] = useState("Invalidate if the stated catalyst does not occur by the deadline, or its disclosed result contradicts the thesis.");
  const [intendedTrades, setIntendedTrades] = useState<Array<{ symbol: string; dollars: string; note: string }>>([]);
  const [starting, setStarting] = useState(false);

  const { data: theses, refetch: refetchTheses } = trpc.aperture.thesis.list.useQuery();
  const { data: canonicalTheses } = trpc.thesis.list.useQuery();
  const { data: activeCapitalContext } = trpc.thesis.activeCapital.useQuery();
  const { data: accounts } = trpc.aperture.account.list.useQuery();
  const { data: runs, refetch: refetchRuns } = trpc.aperture.run.list.useQuery();
  const { data: providers } = trpc.aperture.providers.useQuery();
  const { data: dailyPlays } = trpc.aperture.play.list.useQuery();

  useEffect(() => {
    if (selectedAccountId || !accounts?.length) return;
    const preferred = accounts.find((account) => account.brokerId === "alpaca_paper" && account.isPaper)
      ?? accounts.find((account) => account.isPaper)
      ?? accounts[0];
    if (preferred) setSelectedAccountId(preferred.id);
  }, [accounts, selectedAccountId]);

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
    const deadlineMs = easternDateTimeInputToEpoch(catalystDeadline);
    if (deadlineMs == null || !Number.isFinite(deadlineMs)) return toast.error("Catalyst deadline is not a valid Eastern-market time");
    setStarting(true);
    startRun.mutate({
      thesisId: selectedThesisId,
      accountId: selectedAccountId ?? undefined,
      deployableCapitalCents: dollarsToCents(deployable),
      hurdleRateBps: undefined,
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
  const selectedAccount = accounts?.find((account) => account.id === selectedAccountId);
  const selectedHorizon = selectedThesis?.graph?.horizons?.[0] ?? null;
  const thesisProducedPlays = (dailyPlays?.plays ?? []).filter((play) => play.run.thesisId === selectedThesisId);
  const unprojectedCanonicalTheses = (canonicalTheses ?? []).filter(
    (canonical) => !(theses ?? []).some((projection) => projection.sourceCompilationId === canonical.id),
  );
  const horizonGuidance = holdingPeriod ? HORIZON_GUIDANCE[holdingPeriod as keyof typeof HORIZON_GUIDANCE] : null;
  const researchJourneys = buildResearchJourneys((runs ?? []) as any[]);
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

  if (!showResearchSetup) {
    return <DashboardLayout><div className="mx-auto max-w-6xl space-y-5">
      <section className="flex flex-col gap-2 rounded-lg border border-emerald-600/25 bg-emerald-600/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div><span className="font-semibold text-foreground">Decision Center thesis: </span><span className="text-muted-foreground">{activeCapitalContext?.thesis?.name ?? "No Capital / Trade thesis assigned"}</span></div>
        <Link href="/thesis?scope=capital" className="shrink-0 text-xs font-semibold text-emerald-700 hover:underline">Change thesis →</Link>
      </section>
      <DailyPlayList onNewResearch={() => { setShowResearchSetup(true); navigate("/aperture?setup=1"); }} onOpenRun={(runId, candidateId, view) => {
      if (view === "execute") navigate(`/aperture/run/${runId}/execute?candidate=${candidateId}`);
      else navigate(`/aperture/run/${runId}?view=${view ?? "play"}`);
    }} /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <header className="max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" className="h-7 px-0 text-xs" onClick={() => { setShowResearchSetup(false); navigate("/aperture"); }}>← Today’s plays</Button>
            <Compass className="h-5 w-5" style={{ color: "var(--sh-signal)" }} />
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.17em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · Paper research</span>
            <Badge variant="outline" className="text-xs">Human-approved only</Badge>
          </div>
          <h2 className="font-serif text-3xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>Turn one market belief into a clear paper research brief.</h2>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--sh-text-secondary)" }}>
            Choose what you want to investigate. Aperture prepares the research map, checks your paper safeguards, and shows the next decision—without sending an order.
          </p>
        </header>

        <Card className="overflow-hidden border-amber-500/25 bg-amber-500/[0.035]">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-[1.1fr_1fr] sm:items-center">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-700">New operator · the happy path</p>
              <p className="mt-1 font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Ask one question. Watch the evidence arrive. Decide with a human in the loop.</p>
              <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Use this workspace to test a dated catalyst, identify a portfolio gap, or challenge overlap in a paper portfolio. It does not propose or submit a live trade.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[
                ["1", "Choose", "a market belief"],
                ["2", "Build", "a live research brief"],
                ["3", "Review", "evidence before any paper order"],
              ].map(([step, label, detail]) => <div key={step} className="rounded-lg border border-amber-500/20 bg-background/70 p-2.5"><p className="font-mono text-amber-700">{step}</p><p className="mt-1 font-medium" style={{ color: "var(--sh-text-primary)" }}>{label}</p><p className="mt-0.5 text-[10px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p></div>)}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Run Setup */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-xl">What do you want to learn?</CardTitle>
                <CardDescription>Two choices, then Aperture builds the research brief. Safeguards are ready by default and can be adjusted only when needed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Thesis */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">1 · Choose the belief to investigate</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedThesisId?.toString() ?? ""}
                      onValueChange={(v) => {
                        if (v.startsWith("canonical:")) {
                          const compilationId = Number(v.replace("canonical:", ""));
                          setCanonicalThesisId(String(compilationId));
                          projectCanonicalThesis.mutate({ compilationId });
                          return;
                        }
                        setSelectedThesisId(Number(v));
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a saved thesis…" />
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
                        {unprojectedCanonicalTheses.map((thesis) => (
                          <SelectItem key={`canonical-${thesis.id}`} value={`canonical:${thesis.id}`}>
                            {thesis.name ?? `Untitled Thesis #${thesis.id}`} · saved thesis
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => navigate("/thesis?scope=capital")}>
                      <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> New thesis
                    </Button>
                  </div>
                  {selectedThesisId && (
                    <div className="rounded-lg border p-3 text-xs" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
                      <div className="flex items-center gap-2"><Target className="h-3.5 w-3.5" style={{ color: "var(--sh-signal)" }} /><span><strong style={{ color: "var(--sh-text-primary)" }}>Ready to frame:</strong> {selectedHorizon ?? "Aperture will prepare this saved belief for securities research when you build the brief."}</span></div>
                      <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Plays this thesis produced</p>{thesisProducedPlays.length ? <div className="mt-2 flex flex-wrap gap-1.5">{thesisProducedPlays.slice(0, 8).map((play) => <Link key={play.candidate.id} href={`/aperture/run/${play.run.id}?view=play&candidate=${play.candidate.id}`} className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{play.candidate.symbol} · {play.run.holdingPeriod ?? "research"}</Link>)}</div> : <p className="mt-1 leading-5">No short-horizon play is recorded for this thesis yet. Building a brief creates research, not a paper order.</p>}</div>
                    </div>
                  )}
                  {projectCanonicalThesis.isPending && canonicalThesisId && (
                    <p className="flex items-center gap-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> Preparing this saved belief for the brief…
                    </p>
                  )}
                </div>

                {/* Optional portfolio context */}
                <details className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--sh-border-1)" }}>
                  <summary className="cursor-pointer text-xs font-medium" style={{ color: "var(--sh-text-secondary)" }}>Optional: compare this research with my paper portfolio</summary>
                  <div className="mt-3 space-y-1.5">
                    <Label className="text-xs font-medium">Paper portfolio context</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedAccountId?.toString() ?? "none"}
                      onValueChange={(v) => setSelectedAccountId(v === "none" ? null : Number(v))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a paper account" />
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
                  {selectedAccount && <p className="text-[11px] leading-4 text-muted-foreground">Using <span className="font-medium text-foreground">{selectedAccount.label}</span> to identify overlap and concentration. This does not create or submit an order.</p>}
                  </div>
                </details>

                <div className="max-w-xs space-y-1.5">
                  <div className="space-y-1.5">
                    <FieldLabel inputId="research-budget" label="Research budget ($)" help="The maximum simulated capital you are willing to evaluate for this brief. It is not an order and is never sent to a broker automatically." />
                    <Input
                      id="research-budget" name="research-budget" inputMode="decimal" autoComplete="off"
                      placeholder="e.g. 25000"
                      value={deployable}
                      onChange={(e) => setDeployable(e.target.value)}
                    />
                  </div>
                </div>

                {/* Short-Horizon Paper Run preset — the mandate, per run */}
                <details className="space-y-3 rounded-lg p-3" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                  <summary className="cursor-pointer list-none">
                    <Label className="pointer-events-none text-xs font-semibold">Safeguards are ready <span className="font-normal" style={{ color: "var(--sh-fg-muted)" }}>· review only if you want to customize them</span></Label>
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <FieldLabel inputId="holding-period" label="Holding Period" help="Choose how long the evidence is allowed to work. This determines when Aperture should stop researching the idea and ask for a new decision." />
                      <Select value={holdingPeriod} onValueChange={(period) => { setHoldingPeriod(period); setCatalystDeadline(defaultCatalystDeadline(period)); }}>
                        <SelectTrigger id="holding-period"><SelectValue placeholder="Choose" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="intraday">Intraday — flat by 15:55 ET</SelectItem>
                          <SelectItem value="overnight">Overnight — exit by the next close</SelectItem>
                          <SelectItem value="swing">Swing — 2 to 10 sessions</SelectItem>
                          <SelectItem value="catalyst_window">Catalyst window — up to 20 sessions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel inputId="catalyst-deadline" label="Catalyst Deadline (ET)" help="This field is Eastern Time. The latest date when the event or evidence should resolve the premise. If it does not, Aperture treats the research decision as expired rather than quietly extending it." />
                      <Input id="catalyst-deadline" name="catalyst-deadline" type="datetime-local" value={catalystDeadline} onChange={(e) => setCatalystDeadline(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel inputId="liquidity-floor" label="Liquidity Floor — 30d ADV ($)" help="Minimum 30-day average daily dollar volume. It helps prevent a paper idea from looking executable when it would be difficult to enter or exit at the planned size." />
                      <Input id="liquidity-floor" name="liquidity-floor" inputMode="decimal" autoComplete="off" value={liquidityFloor} onChange={(e) => setLiquidityFloor(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel inputId="concentration-cap" label="Concentration Cap — single name (%)" help="Maximum share of this run’s paper capital assigned to one company. It controls single-name risk even when the thesis looks compelling." />
                      <Input id="concentration-cap" name="concentration-cap" inputMode="decimal" autoComplete="off" value={maxSingleName} onChange={(e) => setMaxSingleName(e.target.value)} />
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
                      <FieldLabel inputId="invalidation-rule" label="What would make this run invalid?" help="Write the evidence condition—not a price move—that would prove the research premise wrong. This creates a visible stop condition for the thesis, the deadline, and future monitoring." />
                    <Input
                      id="invalidation-rule" name="invalidation-rule"
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
                </details>

                {/* Intended trades */}
                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium">Your starting view <span className="opacity-50">(ideas to re-underwrite, not commitments)</span></legend>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addTrade}>
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  {intendedTrades.map((t, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        className="w-24 text-xs"
                        id={`intended-trade-${i}-symbol`}
                        name={`intended-trade-${i}-symbol`}
                        inputMode="text"
                        autoCapitalize="characters"
                        aria-label={`Starting view ${i + 1} ticker`}
                        placeholder="TICKER"
                        value={t.symbol}
                        onChange={(e) => updateTrade(i, "symbol", e.target.value.toUpperCase())}
                      />
                      <Input
                        className="w-28 text-xs"
                        id={`intended-trade-${i}-dollars`}
                        name={`intended-trade-${i}-dollars`}
                        inputMode="decimal"
                        aria-label={`Starting view ${i + 1} dollar amount`}
                        placeholder="$ amount"
                        value={t.dollars}
                        onChange={(e) => updateTrade(i, "dollars", e.target.value)}
                      />
                      <Input
                        className="flex-1 text-xs"
                        id={`intended-trade-${i}-note`}
                        name={`intended-trade-${i}-note`}
                        inputMode="text"
                        aria-label={`Starting view ${i + 1} note`}
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
                </fieldset>

                <Separator />
                <Button
                  className="w-full"
                  disabled={!selectedThesisId || !deployable || starting || startRun.isPending}
                  onClick={handleStart}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {startRun.isPending ? "Preparing your brief…" : "Build my research brief"}
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
                    <CardTitle className="text-sm">Evidence coverage</CardTitle>
                    <CardDescription className="mt-1 text-[11px]">Connected sources enrich the brief. Missing paid sources never block it.</CardDescription>
                  </div>
                  <DatabaseZap className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />
                </div>
              </CardHeader>
              <CardContent>
                <details>
                  <summary className="cursor-pointer text-xs font-medium" style={{ color: "var(--sh-text-secondary)" }}>View source coverage</summary>
                  <div className="mt-3 space-y-3">
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
                  </div>
                </details>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div><CardTitle className="text-sm">Research journeys</CardTitle><CardDescription className="mt-1 text-[11px]">Follow-up batches stay with the same decision, so you always know where to continue.</CardDescription></div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchRuns()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {researchJourneys.slice(0, 3).map((journey) => (
                  <button
                    key={journey.rootId}
                    className="w-full text-left rounded-lg border p-3 text-xs transition-colors hover:bg-muted/50"
                    style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}
                    onClick={() => navigate(`/aperture/run/${journey.latest.id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium" style={{ color: "var(--sh-text-primary)" }}>{journey.thesisName}</span>
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0"
                        style={{
                          color: journey.state === "ready_to_review" ? "oklch(0.55 0.15 145)" :
                            journey.state === "needs_attention" ? "var(--sh-red)" : "var(--sh-signal)",
                        }}
                      >
                        {journey.state === "ready_to_review" ? "review" : journey.state === "more_research_available" ? "continue" : journey.state}
                      </Badge>
                    </div>
                    <div className="mt-1 leading-4" style={{ color: "var(--sh-fg-muted)" }}>{journey.symbolsReviewed} symbols · {journey.evidenceCandidates} evidence candidates · {journey.nextLabel}</div>
                  </button>
                ))}
                {researchJourneys.length > 0 && <Button variant="ghost" size="sm" className="w-full justify-between text-xs" onClick={() => navigate("/aperture/runs")}>Open all research journeys <ArrowUpRight className="h-3.5 w-3.5" /></Button>}
                {researchJourneys.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>No research journeys yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
