/**
 * Candidate Board — four role tabs with scored candidates.
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, FileText, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

type Role = "core" | "complementary" | "remainder" | "alternative_expression";

const ROLE_LABELS: Record<Role, string> = {
  core: "Core",
  complementary: "Complementary",
  remainder: "Remainder",
  alternative_expression: "Alt Expression",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  core: "Directly expresses the thesis",
  complementary: "Strengthens or diversifies it",
  remainder: "Optimises capital that would sit idle",
  alternative_expression: "A different way to hold the same idea",
};

function ScorePill({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "oklch(0.55 0.15 145)" : score >= 40 ? "var(--sh-signal)" : "var(--sh-fg-muted)";
  return (
    <div className="text-center">
      <div className="text-lg font-bold tabular-nums" style={{ color }}>{score}</div>
      <div className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{label}</div>
    </div>
  );
}

export default function CandidateBoard() {
  const [, params] = useRoute("/aperture/run/:id");
  const [, navigate] = useLocation();
  const runId = Number(params?.id);
  const [activeRole, setActiveRole] = useState<Role | "all">("all");
  const [generatingMemo, setGeneratingMemo] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });
  const genMemo = trpc.aperture.generateMemo.useMutation({
    onSuccess: () => { toast.success("Memo generated"); refetch(); setGeneratingMemo(null); },
    onError: (e) => { toast.error(e.message); setGeneratingMemo(null); },
  });

  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading…</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Run not found.</div></DashboardLayout>;

  const { run, candidates } = data;
  const roles: Array<Role | "all"> = ["all", "core", "complementary", "remainder", "alternative_expression"];
  const filtered = activeRole === "all" ? candidates : candidates.filter((c) => c.role === activeRole);

  const statusColor = run.status === "completed" ? "oklch(0.55 0.15 145)" :
    run.status === "failed" ? "var(--sh-red)" : "var(--sh-signal)";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
          Internal research tool — not investment advice. Modeled figures are labeled as such.
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/aperture")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>
                Run #{runId} · Candidates
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" style={{ color: statusColor }}>{run.status}</Badge>
                <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                  {candidates.length} candidates
                  {run.droppedNote ? ` · ${run.droppedNote}` : ""}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/aperture/run/${runId}/exposure`)}>
              Exposure Map
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/aperture/run/${runId}/strategies`)}>
              Strategies
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/aperture/run/${runId}/execute`)}>
              Execute &amp; Monitor
            </Button>
          </div>
        </div>

        {/* Role tabs */}
        <div className="flex gap-1 flex-wrap">
          {roles.map((role) => {
            const count = role === "all" ? candidates.length : candidates.filter((c) => c.role === role).length;
            return (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: activeRole === role ? "var(--sh-signal)" : "var(--sh-surface-2)",
                  color: activeRole === role ? "#fff" : "var(--sh-fg-muted)",
                }}
              >
                {role === "all" ? "All" : ROLE_LABELS[role]} ({count})
              </button>
            );
          })}
        </div>

        {/* Candidate grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold font-mono" style={{ color: "var(--sh-text-primary)" }}>{c.symbol}</span>
                      <Badge variant="outline" className="text-xs">{ROLE_LABELS[c.role as Role]}</Badge>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>
                      {ROLE_DESCRIPTIONS[c.role as Role]}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <ScorePill score={c.compositeScore ?? 0} label="composite" />
                    <ScorePill score={Math.round((c.confidenceScore ?? 0) * 100)} label="confidence" />
                  </div>
                </div>

                {c.verifyFields && (c.verifyFields as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(c.verifyFields as string[]).map((f) => (
                      <Badge key={f} variant="outline" className="text-xs px-1.5 py-0" style={{ color: "var(--sh-signal)" }}>
                        verify: {f}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                    {c.memoStatus === "ok" && <><CheckCircle2 className="h-3 w-3" style={{ color: "oklch(0.55 0.15 145)" }} /> Memo ready</>}
                    {c.memoStatus === "rejected" && <><TrendingDown className="h-3 w-3" style={{ color: "var(--sh-red)" }} /> Memo rejected</>}
                    {c.memoStatus === "skipped" && <><Minus className="h-3 w-3" /> Memo skipped</>}
                    {c.memoStatus === "pending" && <><Minus className="h-3 w-3" /> No memo yet</>}
                  </div>
                  <div className="flex gap-1">
                    {c.memoStatus === "ok" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/aperture/run/${runId}/memo/${c.id}`)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" /> View Memo
                      </Button>
                    )}
                    {(c.memoStatus === "pending" || c.memoStatus === "rejected") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={generatingMemo === c.id}
                        onClick={() => {
                          setGeneratingMemo(c.id);
                          genMemo.mutate({ runId, candidateId: c.id });
                        }}
                      >
                        {generatingMemo === c.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <TrendingUp className="h-3.5 w-3.5 mr-1" />}
                        Generate Memo
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-12 text-sm" style={{ color: "var(--sh-fg-muted)" }}>
              {run.status === "completed" ? "No candidates in this category." : `Run is ${run.status}…`}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function CheckCircle2({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
