/**
 * Memo Drawer — evidence-backed investment memo for one candidate.
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink, CheckCircle2, XCircle, SkipForward } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function MemoDrawer() {
  const [, params] = useRoute("/aperture/run/:runId/memo/:candidateId");
  const runId = Number(params?.runId);
  const candidateId = Number(params?.candidateId);

  const { data, isLoading } = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });

  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading…</div></DashboardLayout>;

  const candidate = data?.candidates.find((c) => c.id === candidateId);
  if (!candidate) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Candidate not found.</div></DashboardLayout>;

  const memo = candidate.memo as any;
  const citations = (candidate.citations as string[]) ?? [];

  const confidenceColor = memo?.researchConfidence === "high" ? "oklch(0.55 0.15 145)" :
    memo?.researchConfidence === "medium" ? "var(--sh-signal)" : "var(--sh-fg-muted)";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
          Internal research tool — not investment advice. All figures traced to the fact ledger.
        </div>

        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold font-mono" style={{ color: "var(--sh-text-primary)" }}>{candidate.symbol}</span>
          <Badge variant="outline">{candidate.role}</Badge>
          {candidate.memoStatus === "ok" && <Badge style={{ background: "oklch(0.45 0.15 145)", color: "#fff" }}>Memo validated</Badge>}
          {candidate.memoStatus === "rejected" && <Badge style={{ background: "var(--sh-red)", color: "#fff" }}>Rejected</Badge>}
          {candidate.memoStatus === "skipped" && <Badge variant="outline">Skipped</Badge>}
        </div>

        {candidate.memoStatus === "rejected" && (
          <div className="p-3 rounded-lg text-sm" style={{ background: "var(--sh-surface-2)", color: "var(--sh-red)" }}>
            <div className="flex items-center gap-2 mb-1 font-medium">
              <XCircle className="h-4 w-4" /> Memo rejected by fact validator
            </div>
            <p style={{ color: "var(--sh-fg-muted)" }}>{candidate.memoRejectReason}</p>
          </div>
        )}

        {candidate.memoStatus === "skipped" && (
          <div className="p-3 rounded-lg text-sm" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}>
            <div className="flex items-center gap-2 mb-1 font-medium">
              <SkipForward className="h-4 w-4" /> Memo skipped
            </div>
            <p>{candidate.memoRejectReason ?? "Insufficient sourced facts to write a memo."}</p>
          </div>
        )}

        {memo && candidate.memoStatus === "ok" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: "var(--sh-fg-muted)" }}>Research confidence:</span>
              <Badge variant="outline" style={{ color: confidenceColor }}>{memo.researchConfidence}</Badge>
            </div>

            {[
              { key: "thesisFit", label: "Thesis Fit" },
              { key: "whyNow", label: "Why Now" },
              { key: "catalyst", label: "Catalyst" },
              { key: "whatWouldInvalidate", label: "What Would Invalidate This" },
              { key: "relationToPortfolio", label: "Relation to Portfolio" },
              { key: "whyThisDeservesCapital", label: "Why This Deserves Capital" },
              { key: "downsideScenario", label: "Downside Scenario" },
            ].filter((f) => memo[f.key]).map((f) => (
              <Card key={f.key}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm">{f.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-primary)" }}>{memo[f.key]}</p>
                </CardContent>
              </Card>
            ))}

            {memo.risks?.length > 0 && (
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Risks</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {memo.risks.map((r: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2" style={{ color: "var(--sh-text-primary)" }}>
                        <span style={{ color: "var(--sh-signal)" }}>·</span> {r}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {memo.unknowns?.length > 0 && (
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Unknowns — What the Memo Could Not Assess</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {memo.unknowns.map((u: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2" style={{ color: "var(--sh-fg-muted)" }}>
                        <span>·</span> {u}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {citations.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--sh-fg-muted)" }}>Sources</p>
                <div className="space-y-1">
                  {citations.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs hover:underline"
                      style={{ color: "var(--sh-signal)" }}
                    >
                      <ExternalLink className="h-3 w-3" /> {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
