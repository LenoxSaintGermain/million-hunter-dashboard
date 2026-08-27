import { useLocation } from "wouter";
import { ArrowLeft, ArrowUpRight, CheckCircle2, FileText, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

function formatUpdated(value: number | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not measured";
}

export default function ApertureTheses() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: theses, isLoading, error, refetch } = trpc.aperture.thesis.list.useQuery();
  const { data: activeContext } = trpc.thesis.activeCapital.useQuery();
  const activate = trpc.aperture.thesis.activate.useMutation({
    onSuccess: () => {
      utils.aperture.thesis.list.invalidate();
      utils.thesis.activeCapital.invalidate();
      toast.success("Active Capital context updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const activeId = activeContext?.thesis?.id;

  return <DashboardLayout>
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3"><Button variant="ghost" size="icon" aria-label="Back to Capital decision center" onClick={() => navigate("/aperture")}><ArrowLeft className="h-4 w-4" /></Button><div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Capital Operator · saved contexts</p><h1 className="mt-1 font-serif text-3xl" style={{ color: "var(--sh-text-primary)" }}>Saved theses</h1><p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Choose the thesis that should frame today’s paper research. These records are scoped to your operator account; no other owner’s thesis is shown or changed here.</p></div></div>
        <Button onClick={() => navigate("/thesis")}><Sparkles className="mr-2 h-4 w-4" />New canonical thesis</Button>
      </div>

      <div className="grid gap-px overflow-hidden rounded-xl border sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
        <div className="p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Active context</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{activeContext?.thesis?.name ?? "No active Capital thesis"}</p></div>
        <div className="p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Decision use</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Frames research only</p></div>
        <div className="p-3" style={{ background: "var(--sh-surface-2)" }}><p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Execution boundary</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Paper-only · human approval</p></div>
      </div>

      {error ? <Card><CardContent className="space-y-4 pt-6"><div><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Saved Capital theses could not load.</p><p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>No decision context has been substituted. Retry the read or return to the Decision Center.</p></div><p className="text-xs font-medium" style={{ color: "var(--sh-fg-muted)" }}>Diagnostic: THESIS-LIST-READ</p><div className="flex flex-wrap gap-2"><Button onClick={() => refetch()}><Loader2 className="mr-2 h-4 w-4" />Retry</Button><Button variant="outline" onClick={() => navigate("/aperture")}>Return to Decision Center</Button></div>{import.meta.env.DEV ? <details className="text-xs" style={{ color: "var(--sh-fg-muted)" }}><summary>Development diagnostic</summary><pre className="mt-2 whitespace-pre-wrap">{error.message}</pre></details> : null}</CardContent></Card> : isLoading ? <div className="flex items-center gap-2 rounded-xl border p-5 text-sm" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><Loader2 className="h-4 w-4 animate-spin" />Loading your saved Capital contexts…</div> : !theses?.length ? <Card><CardContent className="space-y-3 pt-6"><p className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>No saved Capital thesis yet.</p><p className="text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Create and compile a canonical thesis first; its linked Capital projection will appear here for paper research.</p><Button onClick={() => navigate("/thesis")}><ArrowUpRight className="mr-2 h-4 w-4" />Open Thesis Engine</Button></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{theses.map((thesis) => {
        const isActive = thesis.id === activeId || thesis.isPrimary;
        const recovered = thesis.confidenceNotes?.some((note: string) => note.startsWith("Recovered verbatim"));
        return <Card key={thesis.id} className="border" style={{ borderColor: isActive ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><CardContent className="space-y-4 pt-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em]" style={{ color: "var(--sh-signal)" }}>{isActive ? "Active decision context" : "Saved context"}</p><h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{thesis.name ?? "Untitled Capital thesis"}</h2><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Updated {formatUpdated(thesis.updatedAt)}</p></div><div className="flex flex-wrap justify-end gap-1">{isActive && <Badge variant="outline" style={{ color: "var(--sh-signal)", borderColor: "var(--sh-signal)" }}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />active</Badge>}<Badge variant="outline">{thesis.status}</Badge></div></div><p className="line-clamp-4 whitespace-pre-line text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{thesis.rawText}</p>{thesis.readDiagnostics.confidenceNotes.status === "unknown" ? <p className="rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>Legacy compiler notes were withheld rather than inferred. Diagnostic: {thesis.readDiagnostics.confidenceNotes.code}</p> : null}{recovered && <p className="rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>Recovered verbatim from approved source. No outcomes, run history, or measurements were backfilled.</p>}<div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}><Button variant="outline" size="sm" onClick={() => navigate(`/aperture/thesis/${thesis.id}`)}><FileText className="mr-1.5 h-3.5 w-3.5" />Review context</Button>{!isActive && <Button size="sm" disabled={activate.isPending} onClick={() => activate.mutate({ id: thesis.id })}>{activate.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}Use for today</Button>}</div></CardContent></Card>;
      })}</div>}
    </div>
  </DashboardLayout>;
}
