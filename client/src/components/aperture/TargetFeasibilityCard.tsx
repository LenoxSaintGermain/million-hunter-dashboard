import type { TargetFeasibility } from "@shared/playUnderwriting";
import { BasisMark, RiskBudgetBar, StateMark } from "./DecisionVisualLanguage";

const money = (value: number | null) => value == null ? "Not measured" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value / 100);

export function TargetFeasibilityCard({ feasibility }: { feasibility: TargetFeasibility }) {
  const state = feasibility.classification === "extreme" ? "blocked" : feasibility.classification === "aggressive" ? "conditional" : "researchable";
  return <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div className="grid gap-px sm:grid-cols-3" style={{ background: "var(--sh-border-1)" }}>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Mission</p><p className="mt-1 font-serif text-2xl">{money(feasibility.capitalBaseCents)}</p><p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{feasibility.targetProfitCents == null ? "No profit target" : `${money(feasibility.targetProfitCents)} / ${feasibility.targetPeriod}`}</p></div>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Target feasibility</p><p className="mt-1 font-serif text-2xl">{feasibility.requiredReturnPct == null ? "Not requested" : `${feasibility.requiredReturnPct}%`}</p><StateMark state={state} label={feasibility.classification} compact /></div>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Risk envelope</p><p className="mt-1 font-serif text-2xl">{money(feasibility.normalPlayRiskCents)} normal</p><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{money(feasibility.highConvictionRiskCents)} high-conviction · {money(feasibility.maxOpenRiskCents)} aggregate</p><BasisMark basis="calculated" label="Target excluded from sizing" formula="min(mission, mandate, portfolio, weekly headroom)" /></div>
    </div>
    <div className="border-t p-4" style={{ borderColor: "var(--sh-border-1)" }}><p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{feasibility.assessment}</p><div className="mt-3"><RiskBudgetBar operatorCapCents={feasibility.riskBudgetCents} perPlayCeilingCents={feasibility.riskBudgetCents} accountEquityCents={feasibility.capitalBaseCents} accountMandatePct={feasibility.capitalBaseCents > 0 ? feasibility.riskBudgetCents / feasibility.capitalBaseCents * 100 : null} concentrationBlocked={feasibility.riskBudgetCents <= 0} /></div></div>
  </section>;
}
