import { ArrowRight, Eye, ShieldAlert, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WEEKLY_EXECUTION_BUCKETS,
  WEEKLY_EXECUTION_TARGET_CENTS,
  buildOperatorAction,
  type OperatorOrderSummary,
} from "@shared/operatorExecutionPlan";

const money = (cents: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
}).format(cents / 100);

export function OperatorDecisionBrief({
  chooseCount,
  orders,
  onOpenAction,
}: {
  chooseCount: number;
  orders: OperatorOrderSummary[];
  onOpenAction: (target: { runId: number | null; candidateId: number | null; lifecycle: "orders" | "monitoring" | null }) => void;
}) {
  const action = buildOperatorAction({ chooseCount, orders });
  const canOpen = action.targetRunId != null || chooseCount > 0;

  return <section className="overflow-hidden rounded-xl border" style={{ borderColor: action.state === "action_required" ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div className="grid gap-px lg:grid-cols-[1.55fr_0.85fr]" style={{ background: "var(--sh-border-1)" }}>
      <div className="p-4 sm:p-5" style={{ background: "var(--sh-surface)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--sh-signal)" }}>What to do now</p>
          <span className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: action.state === "action_required" ? "var(--sh-signal)" : "var(--sh-border-1)", color: action.state === "action_required" ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>{action.state === "action_required" ? "Action required" : "Hold"}</span>
        </div>
        <h2 className="mt-2 font-serif text-2xl leading-tight" style={{ color: "var(--sh-text-primary)" }}>{action.assetStrategy}</h2>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--sh-fg-muted)" }}>{action.currentState}</p>
        <div className="mt-4 border-l-2 pl-3" style={{ borderColor: "var(--sh-signal)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Immediate milestone</p><p className="mt-1 text-sm font-semibold leading-6" style={{ color: "var(--sh-text-primary)" }}>{action.immediateAction}</p></div>
        {canOpen && <Button className="mt-4 min-h-11 w-full sm:w-auto" onClick={() => onOpenAction({ runId: action.targetRunId, candidateId: action.targetCandidateId, lifecycle: action.lifecycle })}>{action.nextActionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Button>}
      </div>

      <aside className="p-4 sm:p-5" style={{ background: "var(--sh-surface-2)" }}>
        <div className="flex items-center gap-2"><Eye className="h-4 w-4" style={{ color: action.watchFinding ? "var(--sh-red)" : "var(--sh-signal)" }} /><p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-text-primary)" }}>Watch my six</p></div>
        {action.watchFinding ? <><p className="mt-3 text-sm font-semibold leading-5" style={{ color: "var(--sh-text-primary)" }}>Negative catalyst detected</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{action.watchFinding}</p>{action.defensiveExpression && <p className="mt-3 rounded-lg border p-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}>{action.defensiveExpression}</p>}{action.watchSourceUrl && <a href={action.watchSourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold underline underline-offset-4" style={{ color: "var(--sh-signal)" }}>Open source</a>}</> : <><p className="mt-3 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>No sourced alert needs review.</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>This means no current cited monitoring record is flagged. It is not a claim that no risk exists.</p></>}
      </aside>
    </div>

    <details className="group border-t" style={{ borderColor: "var(--sh-border-1)" }}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold"><span className="flex items-center gap-2"><Target className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />Weekly execution plan · {money(WEEKLY_EXECUTION_TARGET_CENTS)}</span><span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>Target—not a forecast</span></summary>
      <div className="grid gap-px border-t md:grid-cols-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>{WEEKLY_EXECUTION_BUCKETS.map((bucket) => <article key={bucket.id} className="p-4" style={{ background: "var(--sh-surface-2)" }}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{bucket.label}</p><span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--sh-signal)" }}>{money(bucket.targetLowCents)}–{money(bucket.targetHighCents)}</span></div><p className="mt-2 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{bucket.mandate}</p><p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{bucket.actionRule}</p></article>)}</div>
      <div className="flex gap-3 border-t px-4 py-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--sh-signal)" }} /><p><strong style={{ color: "var(--sh-text-primary)" }}>Win House:</strong> after a verified realized gain exceeds 125% of the recorded plan, earmark 70% for cash reserve and 30% for re-underwriting. The split stays informational until realized P&amp;L and the original plan are both measured.</p></div>
    </details>
  </section>;
}
