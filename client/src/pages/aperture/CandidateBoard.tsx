/** Capital Aperture — decision-first evidence queue. Paper-only internal research. */
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Loader2, SearchCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { CapitalBrief } from "@/components/aperture/CapitalBrief";
import { ResearchLedger } from "@/components/aperture/ResearchLedger";

type Role = "core" | "complementary" | "remainder" | "alternative_expression";

const ROLE_LABELS: Record<Role, string> = { core: "Direct expression", complementary: "Portfolio complement", remainder: "Reserve-capital idea", alternative_expression: "Alternative expression" };
const ROLE_DESCRIPTIONS: Record<Role, string> = {
  core: "Most directly connected to the thesis; validate its evidence and invalidation first.",
  complementary: "May strengthen, diversify, or balance the thesis exposure.",
  remainder: "A lower-priority research path for capital not committed to the thesis.",
  alternative_expression: "A different instrument for the same underlying thesis exposure.",
};

function percent(value: number | null | undefined) { return `${Math.round((value ?? 0) * 100)}%`; }

export default function CandidateBoard() {
  const [, params] = useRoute("/aperture/run/:id");
  const [, navigate] = useLocation();
  const runId = Number(params?.id);
  const [view, setView] = useState<"brief" | "evidence" | "ledger">("brief");
  const [activeRole, setActiveRole] = useState<Role | "all">("all");
  const [generatingMemo, setGeneratingMemo] = useState<number | null>(null);
  const { data, isLoading, refetch } = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });
  const refreshMacro = trpc.aperture.macro.refresh.useMutation({
    onSuccess: (result) => { toast.success(`Macro ledger refreshed — ${result.factsWritten} FRED observations recorded`); refetch(); },
    onError: (error) => toast.error(`Could not refresh macro evidence: ${error.message}`),
  });
  const genMemo = trpc.aperture.generateMemo.useMutation({
    onSuccess: (_result, variables) => { toast.success("Memo generated — opening the fact-traced record"); refetch(); setGeneratingMemo(null); navigate(`/aperture/memos/${variables.candidateId}`); },
    onError: (error) => { toast.error(error.message); setGeneratingMemo(null); },
  });

  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Assembling your research brief…</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Run not found.</div></DashboardLayout>;

  const { run, candidates, macroFacts, brief } = data;
  const roles: Array<Role | "all"> = ["all", "core", "complementary", "remainder", "alternative_expression"];
  const filtered = activeRole === "all" ? candidates : candidates.filter((candidate) => candidate.role === activeRole);

  const openEvidence = () => { setView("evidence"); setActiveRole("all"); };
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} /> Internal research tool — not investment advice. Paper-only decisions require human approval.
        </div>

        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: "var(--sh-border-1)" }}>
          <div className="flex items-start gap-2">
            <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" onClick={() => navigate("/aperture")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sh-fg-muted)" }}>Capital Aperture · run #{runId}</p>
              <h1 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>From research signals to a deliberate portfolio decision</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>{run.candidateCount ?? candidates.length} evidence candidates · {run.status} {run.droppedNote ? `· ${run.droppedNote}` : ""}</p>
            </div>
          </div>
          <div className="flex rounded-lg border p-1" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
            <button onClick={() => setView("brief")} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "brief" ? "var(--sh-surface)" : "transparent", color: view === "brief" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Decision brief</button>
            <button onClick={() => setView("evidence")} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "evidence" ? "var(--sh-surface)" : "transparent", color: view === "evidence" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Evidence queue</button>
            <button onClick={() => setView("ledger")} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: view === "ledger" ? "var(--sh-surface)" : "transparent", color: view === "ledger" ? "var(--sh-text-primary)" : "var(--sh-fg-muted)" }}>Research ledger</button>
          </div>
        </header>

        {view === "brief" ? (
          <CapitalBrief
            brief={brief}
            onReviewEvidence={openEvidence}
            onComparePostures={() => navigate(`/aperture/run/${runId}/strategies`)}
            onReviewGaps={() => navigate(`/aperture/run/${runId}/exposure`)}
            onSetHorizon={() => navigate("/thesis?scope=capital")}
          />
        ) : view === "ledger" ? (
          <ResearchLedger macroFacts={macroFacts} onRefresh={() => refreshMacro.mutate()} refreshing={refreshMacro.isPending} />
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>Evidence queue</p>
                <p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>These symbols support research questions. They are not a ranked instruction to trade.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/aperture/run/${runId}/strategies`)}>Compare postures</Button>
                <Button variant="ghost" size="sm" onClick={() => setView("brief")}>Back to brief</Button>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {roles.map((role) => {
                const count = role === "all" ? candidates.length : candidates.filter((candidate) => candidate.role === role).length;
                return <button key={role} onClick={() => setActiveRole(role)} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: activeRole === role ? "var(--sh-signal)" : "var(--sh-surface-2)", color: activeRole === role ? "var(--sh-primary-fg)" : "var(--sh-fg-muted)" }}>{role === "all" ? "All research" : ROLE_LABELS[role]} ({count})</button>;
              })}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.map((candidate) => {
                const verifyFields = Array.isArray(candidate.verifyFields) ? candidate.verifyFields as string[] : [];
                const role = candidate.role as Role;
                return (
                  <Card key={candidate.id} className="border transition-shadow hover:shadow-md" style={{ borderColor: "var(--sh-border-1)" }}>
                    <CardContent className="space-y-4 pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>{ROLE_LABELS[role]}</p>
                          <h2 className="mt-1 text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>Research {candidate.symbol} as a {role === "core" ? "thesis expression" : "portfolio option"}</h2>
                          <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{ROLE_DESCRIPTIONS[role]}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">{percent(candidate.confidenceScore)} evidence confidence</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 rounded-lg p-3" style={{ background: "var(--sh-surface-2)" }}>
                        <div><p className="text-[0.64rem] uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Research fit</p><p className="mt-1 text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>{candidate.compositeScore ?? "—"}<span className="ml-1 text-xs font-normal" style={{ color: "var(--sh-fg-muted)" }}>/100</span></p></div>
                        <div><p className="text-[0.64rem] uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Open checks</p><p className="mt-1 text-lg font-semibold" style={{ color: verifyFields.length ? "var(--sh-signal)" : "var(--sh-text-primary)" }}>{verifyFields.length}</p></div>
                      </div>
                      {verifyFields.length > 0 ? <div className="flex flex-wrap gap-1">{verifyFields.slice(0, 4).map((field) => <Badge key={field} variant="outline" className="text-[0.65rem]" style={{ color: "var(--sh-signal)" }}>verify: {field}</Badge>)}</div> : <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--sh-fg-muted)" }}><SearchCheck className="h-3.5 w-3.5" /> No open evidence checks recorded for this candidate.</p>}
                      <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--sh-border-1)" }}>
                        <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{candidate.memoStatus === "ok" ? "Fact-traced memo ready" : "Decision memo not generated"}</span>
                        {candidate.memoStatus === "ok" ? <Button variant="ghost" size="sm" onClick={() => navigate(`/aperture/memos/${candidate.id}`)}><FileText className="mr-1.5 h-3.5 w-3.5" /> Read decision memo</Button> : <Button variant="outline" size="sm" disabled={generatingMemo === candidate.id} onClick={() => { setGeneratingMemo(candidate.id); genMemo.mutate({ runId, candidateId: candidate.id }); }}>{generatingMemo === candidate.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="mr-1.5 h-3.5 w-3.5" />} Generate evidence memo</Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
