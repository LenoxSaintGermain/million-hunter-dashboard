/** Portfolio posture comparison — research-only, never a return forecast or order ticket. */
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import { DecisionFocusCard } from "@/components/aperture/DecisionFocusCard";
import { decisionPriority } from "@shared/decisionFocus";

const KIND_LABELS: Record<string, string> = { concentrated: "Concentrated", expanded: "Expanded Aperture", risk_balanced: "Risk-Balanced", dry_powder: "Dry Powder", human_baseline: "Your starting plan" };
const KIND_DESCRIPTIONS: Record<string, string> = {
  concentrated: "Fewer research exposures; the highest concentration trade-off.",
  expanded: "Broader thesis coverage; more research surface to validate.",
  risk_balanced: "Limits correlated exposure while preserving the thesis question.",
  dry_powder: "Preserves optionality until evidence improves.",
  human_baseline: "The paper plan you entered before this research brief.",
};
const fmt = (cents: number | null | undefined) => cents == null ? "—" : `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function StrategyCompare() {
  const [, params] = useRoute("/aperture/run/:id/strategies");
  const runId = Number(params?.id);
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });
  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Preparing portfolio comparison…</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Run not found.</div></DashboardLayout>;

  const { strategies, brief, candidates } = data;
  const focusCandidate = candidates.find((candidate) => candidate.symbol === brief?.priorityCandidate?.symbol)
    ?? candidates.slice().sort((a, b) => decisionPriority(b) - decisionPriority(a))[0];
  const heldSymbols = data.paperContext?.positions?.map((position) => position.symbol) ?? [];
  const human = strategies.find((strategy) => strategy.kind === "human_baseline");
  const others = strategies.filter((strategy) => strategy.kind !== "human_baseline");

  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-6 pb-12">
    <div className="flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", borderColor: "var(--sh-border-1)" }}><AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />Internal research tool — not investment advice. These are modeled research postures, not expected-return forecasts or order tickets.</div>
    <header><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/aperture/run/${runId}`)}><ArrowLeft className="h-4 w-4" /></Button><div><p className="text-[0.68rem] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--sh-signal)" }}>Capital Aperture · Run #{runId}</p><h1 className="font-serif text-3xl" style={{ color: "var(--sh-text-primary)" }}>What would change in the paper portfolio?</h1></div></div><p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>Start with the machine’s unresolved question. Compare postures only after the human decision checks are cleared; none of these views predicts or guarantees return.</p></header>
    {focusCandidate && <DecisionFocusCard candidate={focusCandidate} positions={data.paperContext?.positions ?? []} onOpenMemo={focusCandidate.memoStatus === "ok" ? () => navigate(`/aperture/memos/${focusCandidate.id}`) : undefined} onReviewEvidence={() => navigate(`/aperture/run/${runId}`)} />}
    {brief?.recommendedResearchPosture && <section className="rounded-2xl border p-5" style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Machine posture to compare first</p><h2 className="mt-1 font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>{brief.recommendedResearchPosture.label}</h2><p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{brief.recommendedResearchPosture.rationale}</p><p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--sh-fg-muted)" }}><CircleAlert className="h-3.5 w-3.5" style={{ color: "var(--sh-signal)" }} />{brief.evidence.verificationCount} evidence checks remain before a paper order can be considered.</p></section>}
    {human && <PostureCard posture={human} heldSymbols={heldSymbols} baseline />}
    <section><h2 className="font-serif text-xl" style={{ color: "var(--sh-text-primary)" }}>Research postures to compare after the gate clears</h2><p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Each view changes the research exposure set and cash reserve—not your expected return.</p><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{others.map((posture) => <PostureCard key={posture.id} posture={posture} heldSymbols={heldSymbols} />)}</div></section>
    {!strategies.length && <div className="py-12 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>No postures yet — this brief may still be constructing.</div>}
  </div></DashboardLayout>;
}

function PostureCard({ posture, heldSymbols, baseline = false }: { posture: any; heldSymbols: string[]; baseline?: boolean }) {
  const allocations = (posture.allocations as Array<{ symbol: string; dollarsCents: number; pctOfDeployable: number }>) ?? [];
  const introduced = allocations.filter((item) => !heldSymbols.includes(item.symbol)).map((item) => item.symbol);
  return <Card style={{ borderColor: baseline ? "var(--sh-signal)" : "var(--sh-border-1)" }}><CardHeader className="pb-2"><div className="flex items-center gap-2"><CardTitle className="text-base">{KIND_LABELS[posture.kind] ?? posture.kind}</CardTitle>{baseline && <Badge variant="outline" style={{ color: "var(--sh-signal)" }}>Starting point</Badge>}</div><CardDescription>{KIND_DESCRIPTIONS[posture.kind] ?? posture.rationale}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2">{allocations.map((allocation) => <div key={allocation.symbol} className="flex items-center gap-2"><span className="w-14 font-mono text-xs" style={{ color: "var(--sh-text-primary)" }}>{allocation.symbol}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--sh-surface-2)" }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, allocation.pctOfDeployable)}%`, background: "var(--sh-signal)" }} /></div><span className="w-16 text-right text-xs tabular-nums" style={{ color: "var(--sh-fg-muted)" }}>{allocation.pctOfDeployable.toFixed(0)}%</span></div>)}</div>{posture.cashRetainedCents != null && <div className="border-t pt-3 text-xs" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>Modeled cash retained: <span style={{ color: "var(--sh-text-primary)" }}>{fmt(posture.cashRetainedCents)}</span></div>}<div className="rounded-lg px-3 py-2 text-xs leading-5" style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)" }}><span className="font-medium" style={{ color: "var(--sh-text-primary)" }}>Portfolio effect: </span>{introduced.length ? `would introduce ${introduced.join(", ")} as new research exposure${introduced.length > 1 ? "s" : ""}.` : "would change weights of securities already in the paper context."} This does not establish a return outcome.</div>{posture.rationale && <p className="border-t pt-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>{posture.rationale}</p>}</CardContent></Card>;
}
