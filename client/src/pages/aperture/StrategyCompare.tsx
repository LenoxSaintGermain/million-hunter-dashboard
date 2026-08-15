/**
 * Strategy Compare — four strategies side by side + Recomposition diff.
 * INTERNAL RESEARCH TOOL — NOT INVESTMENT ADVICE.
 */
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";

const KIND_LABELS: Record<string, string> = {
  concentrated: "Concentrated",
  expanded: "Expanded Aperture",
  risk_balanced: "Risk-Balanced",
  dry_powder: "Dry Powder",
  human_baseline: "Your Plan",
};

const KIND_DESCRIPTIONS: Record<string, string> = {
  concentrated: "Highest-conviction names only — fewer, larger positions",
  expanded: "Full universe of candidates — maximum thesis coverage",
  risk_balanced: "Optimised for concentration, correlation, and liquidity",
  dry_powder: "Minimal deployment — preserve optionality",
  human_baseline: "Re-underwrite of your original intended trades",
};

function fmt(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function StrategyCompare() {
  const [, params] = useRoute("/aperture/run/:id/strategies");
  const runId = Number(params?.id);
  const [, navigate] = useLocation();

  const { data, isLoading } = trpc.aperture.run.get.useQuery({ id: runId }, { enabled: !!runId });

  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Loading…</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-8 text-center text-sm" style={{ color: "var(--sh-fg-muted)" }}>Run not found.</div></DashboardLayout>;

  const { strategies, brief } = data;
  const human = strategies.find((s) => s.kind === "human_baseline");
  const others = strategies.filter((s) => s.kind !== "human_baseline");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-muted)", border: "1px solid var(--sh-border-1)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sh-signal)" }} />
          Internal research tool — not investment advice. Modeled figures are labeled as such. Paper only — no live execution.
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(`/aperture/run/${runId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-serif text-2xl" style={{ color: "var(--sh-text-primary)" }}>Choose a research posture</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>Run #{runId} · compare concentration, diversification, and retained cash against the stated horizon.</p>
        </div>

        {brief?.recommendedResearchPosture && (
          <Card style={{ borderColor: "var(--sh-signal)", background: "var(--sh-surface-2)" }}>
            <CardContent className="pt-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Research posture to compare first</p>
              <p className="mt-1 text-base font-medium" style={{ color: "var(--sh-text-primary)" }}>{brief.recommendedResearchPosture.label}</p>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{brief.recommendedResearchPosture.rationale}</p>
              <p className="mt-3 text-xs" style={{ color: "var(--sh-fg-muted)" }}>Horizon: {brief.horizon.label} · {brief.evidence.verificationCount} evidence check(s) remain before a paper order can be considered.</p>
            </CardContent>
          </Card>
        )}

        {/* Human baseline first */}
        {human && (
          <Card style={{ borderColor: "var(--sh-signal)" }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{KIND_LABELS[human.kind] ?? human.kind}</CardTitle>
                <Badge variant="outline" style={{ color: "var(--sh-signal)" }}>Baseline</Badge>
              </div>
              <CardDescription>{KIND_DESCRIPTIONS[human.kind] ?? human.rationale}</CardDescription>
            </CardHeader>
            <CardContent>
              <AllocationTable allocations={(human.allocations as any[]) ?? []} cashRetained={human.cashRetainedCents} />
            </CardContent>
          </Card>
        )}

        {/* Other strategies */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {others.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{KIND_LABELS[s.kind] ?? s.kind}</CardTitle>
                <CardDescription className="text-xs">{KIND_DESCRIPTIONS[s.kind] ?? s.rationale}</CardDescription>
              </CardHeader>
              <CardContent>
                <AllocationTable allocations={(s.allocations as any[]) ?? []} cashRetained={s.cashRetainedCents} compact />
                {s.rationale && (
                  <p className="text-xs mt-3 pt-3 border-t border-border" style={{ color: "var(--sh-fg-muted)" }}>{s.rationale}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {strategies.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: "var(--sh-fg-muted)" }}>
            No strategies yet — the run may still be constructing.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function AllocationTable({
  allocations,
  cashRetained,
  compact = false,
}: {
  allocations: Array<{ symbol: string; dollarsCents: number; pctOfDeployable: number }>;
  cashRetained: number | null | undefined;
  compact?: boolean;
}) {
  if (!allocations.length) return <p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>No allocations.</p>;
  return (
    <div className="space-y-1.5">
      {allocations.map((a) => (
        <div key={a.symbol} className="flex items-center gap-2">
          <span className="text-xs font-mono w-16 shrink-0" style={{ color: "var(--sh-text-primary)" }}>{a.symbol}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--sh-surface-2)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, a.pctOfDeployable)}%`, background: "var(--sh-signal)" }}
            />
          </div>
          {!compact && (
            <span className="text-xs tabular-nums w-20 text-right" style={{ color: "var(--sh-fg-muted)" }}>
              {fmt(a.dollarsCents)} ({a.pctOfDeployable.toFixed(1)}%)
            </span>
          )}
        </div>
      ))}
      {cashRetained != null && cashRetained > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <span className="text-xs font-mono w-16 shrink-0" style={{ color: "var(--sh-fg-muted)" }}>CASH</span>
          <span className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{fmt(cashRetained)} retained</span>
        </div>
      )}
    </div>
  );
}
