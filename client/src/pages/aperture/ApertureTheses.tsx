import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import "@/styles/research-library.css";
import { ThesisRiskComparison } from "@/components/aperture/MandateRiskPortrait";
import { isTestThesisName } from "@shared/activeThesis";

function formatUpdated(value: number | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not measured";
}

const money = (cents: number | null | undefined) =>
  cents == null ? "Not set" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** An excerpt of the saved text, never a generated summary. */
export function thesisPremisePreview(value: string | null | undefined) {
  const text = value?.trim() || "No thesis text recorded.";
  if (text.length <= 140) return text;
  const prefix = text.slice(0, 140);
  const boundary = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, boundary > 100 ? boundary : 140).trimEnd()}…`;
}

export default function ApertureTheses() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<"all" | "active" | "review" | "archived">("all");
  const { data: theses, isLoading, error, refetch } = trpc.aperture.thesis.list.useQuery();
  const { data: canonicalTheses } = trpc.thesis.list.useQuery();
  const { data: activeContext, isLoading: contextLoading, error: contextError } = trpc.thesis.activeCapital.useQuery();
  const activate = trpc.aperture.thesis.activate.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        utils.aperture.invalidate(),
        utils.thesis.invalidate(),
      ]);
      toast.success(`Active Capital thesis switched to "${data.name ?? "selected thesis"}". Play Desk, Mission, and Research are now synchronized.`);
    },
    onError: (error) => toast.error(error.message),
  });

  const [query, setQuery] = useState("");
  const [showTest, setShowTest] = useState(false);
  const activeCompilationId = activeContext?.thesis?.id;

  const mergedTheses = useMemo(() => {
    const list: any[] = theses ? [...theses] : [];
    if (canonicalTheses && Array.isArray(canonicalTheses)) {
      for (const c of canonicalTheses as any[]) {
        const alreadyIncluded = list.some(
          (t) => t.sourceCompilationId === c.id || (t.name && t.name.toLowerCase() === c.name?.toLowerCase())
        );
        if (!alreadyIncluded) {
          list.push({
            id: c.id,
            name: c.name ?? `Thesis #${c.id}`,
            rawText: c.thesisText ?? "",
            sourceCompilationId: c.id,
            status: (c.status as any) ?? "active",
            isPrimary: false,
            updatedAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
            confidenceNotes: [],
            missionDefaults: {
              holdingPeriod: null,
              instrumentPreference: null,
              maxPlannedLossCents: null,
            },
            readDiagnostics: {
              confidenceNotes: { status: "valid", code: "CANONICAL_SOURCE" },
            },
            isCanonicalOnly: true,
          });
        }
      }
    }
    return list;
  }, [theses, canonicalTheses, activeCompilationId]);

  // Active comes only from thesis.activeCapital, never a projection's isPrimary flag (#6).
  const isActiveThesis = (t: any) => activeCompilationId != null && t.sourceCompilationId === activeCompilationId;
  // Test/UAT theses stay out of the library unless asked for; the active one is never hidden.
  const testCount = mergedTheses.filter((t) => isTestThesisName(t.name) && !isActiveThesis(t)).length;
  const filteredTheses = useMemo(() => {
    const matching = mergedTheses
      .filter((t) => showTest || !isTestThesisName(t.name) || isActiveThesis(t))
      .filter(t => `${t.name ?? ""} ${t.rawText ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
    if (filter === "all") return matching;
    if (filter === "active") return matching.filter(isActiveThesis);
    if (filter === "review") return matching.filter((t) => t.status === "review" || t.status === "compiling");
    if (filter === "archived") return matching.filter((t) => t.status === "archived");
    return matching;
  }, [mergedTheses, filter, activeCompilationId, query, showTest]);

  return (
    <DashboardLayout>
      <div className="research-library mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" aria-label="Back to Capital decision center" onClick={() => navigate("/aperture")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>
                Capital Aperture / Thesis library
              </p>
              <h1 className="mt-1 font-serif text-3xl" style={{ color: "var(--sh-text-primary)" }}>What’s your conviction?</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>
                Revisit the argument. Choose the context for your next paper decision.
              </p>
            </div>
          </div>
          <Button onClick={() => navigate("/thesis?new=1")}>
            <Sparkles className="mr-2 h-4 w-4" />New canonical thesis
          </Button>
        </div>

        <div className="desk-context-strip grid gap-px overflow-hidden rounded-xl border sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
          <div className="p-3" style={{ background: "var(--sh-surface-2)" }}>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Active focus thesis</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{contextLoading ? "Reading active context…" : contextError ? "Active context unavailable" : activeContext?.thesis?.name ?? "No active Capital thesis"}</p>
          </div>
          <div className="p-3" style={{ background: "var(--sh-surface-2)" }}>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Lifecycle tracking</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{isLoading || error ? "Not available" : `${theses?.length ?? 0} saved thesis books`}</p>
          </div>
          <div className="p-3" style={{ background: "var(--sh-surface-2)" }}>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Execution boundary</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Paper-only · human approval</p>
          </div>
        </div>

        <p className="desk-caption">Selecting a thesis does not start research or create an order.</p>
        <label className="desk-search">Find a thesis<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or thesis text" /></label>
        {/* Local filters never trigger research. */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3" style={{ borderColor: "var(--sh-border-1)" }}>
          <span className="text-xs font-medium mr-1" style={{ color: "var(--sh-fg-muted)" }}>Thesis Lifecycle:</span>
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            className="h-7 px-3 text-xs"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "active" ? "default" : "outline"}
            className="h-7 px-3 text-xs"
            aria-pressed={filter === "active"}
            onClick={() => setFilter("active")}
          >
            Active Focus
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "review" ? "default" : "outline"}
            className="h-7 px-3 text-xs"
            aria-pressed={filter === "review"}
            onClick={() => setFilter("review")}
          >
            Under Review
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "archived" ? "default" : "outline"}
            className="h-7 px-3 text-xs"
            aria-pressed={filter === "archived"}
            onClick={() => setFilter("archived")}
          >
            Archived
          </Button>
          {(testCount > 0 || showTest) && <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-xs"
            aria-pressed={showTest}
            onClick={() => setShowTest((value) => !value)}
          >
            {showTest ? "Hide test theses" : `Show ${testCount} test ${testCount === 1 ? "thesis" : "theses"}`}
          </Button>}
        </div>

        {!error && !isLoading && !!theses?.length && <ThesisRiskComparison theses={filteredTheses} activeCompilationId={activeCompilationId} onReview={id => navigate(`/aperture/thesis/${id}`)} />}

        {error ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Saved Capital theses could not load.</p>
                <p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>No decision context has been substituted. Retry the read or return to the Decision Center.</p>
              </div>
              <p className="text-xs font-medium" style={{ color: "var(--sh-fg-muted)" }}>Diagnostic: THESIS-LIST-READ</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => refetch()}><Loader2 className="mr-2 h-4 w-4" />Retry</Button>
                <Button variant="outline" onClick={() => navigate("/aperture")}>Return to Decision Center</Button>
              </div>
              {import.meta.env.DEV ? (
                <details className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                  <summary>Development diagnostic</summary>
                  <pre className="mt-2 whitespace-pre-wrap">{error.message}</pre>
                </details>
              ) : null}
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border p-5 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" />Loading your saved Capital contexts…
          </div>
        ) : !theses?.length ? (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>No saved Capital thesis yet.</p>
              <p className="text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Create and compile a canonical thesis first; its linked Capital projection will appear here for paper research.</p>
              <Button onClick={() => navigate("/thesis")}><ArrowUpRight className="mr-2 h-4 w-4" />Open Thesis Engine</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {!filteredTheses.length && <section className="desk-empty"><h2>No theses match this view.</h2><button className="desk-link" onClick={() => { setFilter("all"); setQuery(""); }}>Clear library filters</button></section>}
            {filteredTheses.map((thesis) => {
              const isActive = isActiveThesis(thesis);
              const recovered = thesis.confidenceNotes?.some((note: string) => note.startsWith("Recovered verbatim"));
              return (
                <Card
                  key={thesis.id}
                  className="desk-thesis border"
                  style={{
                    borderColor: isActive ? "var(--sh-signal)" : "var(--sh-border-1)",
                    background: "var(--sh-surface-2)",
                  }}
                >
                  <CardContent className="space-y-4 pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-signal)" }}>
                          {isActive ? "Active decision context" : "Saved context"}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>
                          {thesis.name ?? "Untitled Capital thesis"}
                        </h2>
                        <p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Updated {formatUpdated(thesis.updatedAt)}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {isActive && (
                          <Badge variant="outline" style={{ color: "var(--sh-signal)", borderColor: "var(--sh-signal)" }}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />active
                          </Badge>
                        )}
                        <Badge variant="outline">{thesis.status}</Badge>
                      </div>
                    </div>

                    <p className="desk-premise-preview text-sm" style={{ color: "var(--sh-fg-muted)" }}>
                      {thesisPremisePreview(thesis.rawText)}
                    </p>
                    <details className="desk-detail desk-premise-disclosure">
                      <summary>Full premise</summary>
                      <p className="desk-full-text">{thesis.rawText || "No thesis text recorded."}</p>
                    </details>

                    <dl className="desk-evidence">
                      <div><dt>Planned loss / play</dt><dd>{money(thesis.missionDefaults?.maxPlannedLossCents)}</dd></div>
                      <div><dt>Holding period</dt><dd>{thesis.missionDefaults?.holdingPeriod?.replace(/_/g, " ") ?? "Not set"}</dd></div>
                    </dl>
                    <Button className="desk-action" onClick={() => navigate((thesis as any).isCanonicalOnly ? `/thesis?inspect=${thesis.id}` : `/aperture/thesis/${thesis.id}`)}>
                      {(thesis as any).isCanonicalOnly ? "Open in Thesis Engine →" : "Review context →"}
                    </Button>
                    <details className="desk-detail"><summary>Mandate, source &amp; focus</summary>
                      <p>Instrument: {thesis.missionDefaults?.instrumentPreference?.replace(/_/g, " ") ?? "Not set"}</p>
                      <p className="desk-caption">Canonical compilation: {thesis.sourceCompilationId ?? "Not linked"}. Saved mandate values are not measured exposure or available risk capacity.</p>
                    {thesis.readDiagnostics.confidenceNotes.status === "unknown" ? (
                      <p className="rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
                        Legacy compiler notes were withheld rather than inferred. Diagnostic: {thesis.readDiagnostics.confidenceNotes.code}
                      </p>
                    ) : null}
                    {recovered && (
                      <p className="rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
                        Recovered verbatim from approved source. No outcomes, run history, or measurements were backfilled.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>
                      {!isActive && (
                        <Button
                          size="sm"
                          disabled={activate.isPending || contextLoading || !!contextError}
                          onClick={() => activate.mutate({ id: thesis.id })}
                        >
                          {activate.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                          Use for today
                        </Button>
                      )}
                    </div>
                    <p className="desk-caption">Switching the shared context for Today, Mission and Research is not an order approval.</p>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
