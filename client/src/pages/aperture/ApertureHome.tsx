/**
 * Capital Aperture — Home / Run Setup
 *
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 * Modeled figures are labeled as such throughout.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Play, Plus, RefreshCw, Trash2, BookOpen, TrendingUp, BarChart3, ArrowUpRight } from "lucide-react";
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

export default function ApertureHome() {
  const [, navigate] = useLocation();
  const [selectedThesisId, setSelectedThesisId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [deployable, setDeployable] = useState("");
  const [hurdleRate, setHurdleRate] = useState("");
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
    setStarting(true);
    startRun.mutate({
      thesisId: selectedThesisId,
      accountId: selectedAccountId ?? undefined,
      deployableCapitalCents: dollarsToCents(deployable),
      hurdleRateBps: hurdleRate ? Math.round(parseFloat(hurdleRate) * 100) : undefined,
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
  const unprojectedCanonicalTheses = (canonicalTheses ?? []).filter(
    (canonical) => !(theses ?? []).some((projection) => projection.sourceCompilationId === canonical.id),
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <DisclaimerBanner />

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-5 w-5" style={{ color: "var(--sh-signal)" }} />
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--sh-text-primary)" }}>
              Capital Aperture
            </h1>
            <Badge variant="outline" className="text-xs">v0 · Paper Only</Badge>
          </div>
          <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>
            Given a thesis, a portfolio, and deployable capital — find what you haven't considered and re-underwrite what you planned.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Run Setup */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">New Run</CardTitle>
                <CardDescription>Discover → Research → Score → Construct</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Thesis */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Thesis</Label>
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
                  {selectedThesisId && theses?.find((t) => t.id === selectedThesisId)?.confidenceNotes?.length ? (
                    <div className="text-xs p-2 rounded" style={{ background: "var(--sh-surface-2)", color: "var(--sh-signal)" }}>
                      ⚠ Compiler notes: {theses.find((t) => t.id === selectedThesisId)!.confidenceNotes!.join(" · ")}
                    </div>
                  ) : null}
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
                  <Label className="text-xs font-medium">Portfolio Account <span className="opacity-50">(optional)</span></Label>
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
                    <Label className="text-xs font-medium">Deployable Capital ($)</Label>
                    <Input
                      placeholder="e.g. 25000"
                      value={deployable}
                      onChange={(e) => setDeployable(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Hurdle Rate (%) <span className="opacity-50">optional</span></Label>
                    <Input
                      placeholder="e.g. 8"
                      value={hurdleRate}
                      onChange={(e) => setHurdleRate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Intended trades */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Intended Trades <span className="opacity-50">(what you were already planning)</span></Label>
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
                      No intended trades — the run will discover from scratch.
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
                  {startRun.isPending ? "Starting…" : "Start Run"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: provider status + recent runs */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Data Providers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {liveProviders.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--sh-text-primary)" }}>{p.label}</span>
                    <Badge className="text-xs px-1.5 py-0" style={{ background: "oklch(0.45 0.15 145)", color: "#fff" }}>live</Badge>
                  </div>
                ))}
                {deadProviders.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--sh-fg-muted)" }}>{p.label}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0 opacity-50">gap</Badge>
                  </div>
                ))}
                {!providers && <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>Loading…</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Recent Runs</CardTitle>
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
                      <span className="font-medium" style={{ color: "var(--sh-text-primary)" }}>Run #{r.id}</span>
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
                      {r.candidateCount ?? "—"} candidates · {formatDistanceToNow(r.createdAt)} ago
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
