/**
 * Portfolio Gap Map — a decision-first exposure surface.
 * Internal research tool — not investment advice.
 */
import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Circle, Layers3, SearchCheck, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { buildExposureThemes, exposureSegments } from "@shared/exposureThemes";

const sourceLabel: Record<string, string> = {
  holding: "Held",
  intended: "Paper plan",
  candidate: "Research candidate",
};

export default function ExposureMap() {
  const [, params] = useRoute("/aperture/run/:id/exposure");
  const runId = Number(params?.id);
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading } = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });

  const themes = useMemo(() => {
    if (!data) return [];
    const legacyNodes = data.brief.portfolioContext.uncoveredNodes.map((path) => ({
      label: path,
      path,
      depth: Math.max(1, exposureSegments(path).length - 1),
    }));
    return buildExposureThemes(data.thesisNodes.length ? data.thesisNodes : legacyNodes, data.coverageDetail);
  }, [data]);
  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Mapping research coverage…</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Brief not found.</div></DashboardLayout>;

  const uncovered = themes.filter((theme) => !theme.covered);
  const covered = themes.filter((theme) => theme.covered);
  const visible = (showAll ? uncovered : uncovered.slice(0, 6));
  const nextTheme = uncovered[0];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        <div className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
          Internal research tool — not investment advice. Coverage shows research context, not a trade instruction.
        </div>

        <header className="max-w-3xl">
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · Run #{runId}</p>
          <h1 className="font-serif text-3xl sm:text-4xl" style={{ color: "var(--sh-text-primary)" }}>Where your thesis needs evidence next</h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>
            This map translates your thesis into a short research agenda. It shows themes your paper context already touches and the themes that still need evidence before any paper decision.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Coverage summary">
          <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Represented" value={covered.length} note="themes connected to current context" tone="ok" />
          <Metric icon={<SearchCheck className="h-4 w-4" />} label="Needs evidence" value={uncovered.length} note="themes to validate before a paper view" tone="signal" />
          <Metric icon={<Layers3 className="h-4 w-4" />} label="In this brief" value={themes.length} note="research themes mapped from the thesis" tone="muted" />
        </section>

        {nextTheme && (
          <section className="relative overflow-hidden rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--sh-signal)", background: "linear-gradient(135deg, var(--sh-surface-2), color-mix(in oklab, var(--sh-surface-2) 84%, var(--sh-signal)))" }}>
            <div className="absolute right-5 top-4 opacity-20"><Sparkles className="h-14 w-14" style={{ color: "var(--sh-signal)" }} /></div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-signal)" }}>Next research question</p>
            <h2 className="mt-2 max-w-2xl font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>Is <span style={{ color: "var(--sh-signal)" }}>{nextTheme.theme}</span> material enough to earn a place in the paper decision?</h2>
            {nextTheme.context && <p className="mt-2 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Thesis context: {nextTheme.context}</p>}
            <Link href={`/aperture/run/${runId}`} className="mt-5 inline-flex"><Button size="sm">Review the evidence queue <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></Link>
          </section>
        )}

        <section className="rounded-2xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-1)" }}>
          <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)" }}>
            <div>
              <h2 className="font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Research agenda</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Start with the themes that are absent from your paper context. Expand only if the first evidence checks support the thesis.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}>
              <span className="inline-flex items-center gap-1"><Circle className="h-2.5 w-2.5" style={{ color: "var(--sh-signal)" }} /> Needs evidence</span>
              <span className="inline-flex items-center gap-1"><Circle className="h-2.5 w-2.5" style={{ color: "oklch(0.55 0.15 145)" }} /> Represented</span>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>
            {visible.length ? visible.map((theme, index) => <ThemeRow key={theme.key} theme={theme} rank={index + 1} />) : (
              <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Every mapped theme is represented in the current paper context. Use the evidence queue to validate quality, not to add breadth.</div>
            )}
          </div>
          {uncovered.length > visible.length && <div className="p-4 text-center"><Button variant="outline" size="sm" onClick={() => setShowAll(true)}>Show all {uncovered.length} uncovered themes</Button></div>}
          {showAll && uncovered.length > 6 && <div className="p-4 pt-0 text-center"><Button variant="ghost" size="sm" onClick={() => setShowAll(false)}>Show fewer themes</Button></div>}
        </section>

        {covered.length > 0 && (
          <section className="rounded-2xl border p-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <h2 className="font-serif text-lg" style={{ color: "var(--sh-text-primary)" }}>Already represented</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>These themes have a connection to a current holding, a paper plan, or a research candidate. Representation is context—not validation.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {covered.slice(0, 8).map((theme) => <Badge key={theme.key} variant="outline" className="gap-1.5 py-1.5"><CheckCircle2 className="h-3 w-3" style={{ color: "oklch(0.55 0.15 145)" }} />{theme.theme}{theme.symbols.length ? ` · ${theme.symbols.join(", ")}` : ""}</Badge>)}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: number; note: string; tone: "ok" | "signal" | "muted" }) {
  const color = tone === "ok" ? "oklch(0.55 0.15 145)" : tone === "signal" ? "var(--sh-signal)" : "var(--sh-fg-muted)";
  return <div className="rounded-2xl border p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-1)" }}><div className="flex items-center gap-2 text-xs font-medium" style={{ color }}><span>{icon}</span>{label}</div><div className="mt-3 text-3xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>{value}</div><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{note}</p></div>;
}

function ThemeRow({ theme, rank }: { theme: ReturnType<typeof buildExposureThemes>[number]; rank: number }) {
  return <div className="flex gap-3 px-4 py-4 sm:px-5"><div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "color-mix(in oklab, var(--sh-signal) 14%, transparent)", color: "var(--sh-signal)" }}>{rank}</div><div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{theme.theme}</h3>{theme.context && <p className="mt-0.5 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{theme.context}</p>}</div><Badge variant="outline" className="w-fit" style={{ color: "var(--sh-signal)", borderColor: "color-mix(in oklab, var(--sh-signal) 45%, var(--sh-border-1))" }}><AlertCircle className="mr-1 h-3 w-3" />Needs evidence</Badge></div></div></div>;
}
