import type { NoTradeDecision, TargetFeasibility } from "@shared/playUnderwriting";
import { BasisMark, StateMark } from "./DecisionVisualLanguage";

const money = (value: number | null) => value == null ? "Not measured" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value / 100);

export function TargetFeasibilityCard({ feasibility, noTrade, remainingHeadroomCents, operatorMaxLossCents }: { feasibility: TargetFeasibility; noTrade?: NoTradeDecision | null; remainingHeadroomCents?: number | null; operatorMaxLossCents?: number | null }) {
  const state = feasibility.classification === "extreme" ? "blocked" : feasibility.classification === "aggressive" ? "conditional" : "researchable";
  const hasExplicitTarget = feasibility.targetProfitCents != null && feasibility.targetPeriod != null;
  const targetPeriodMissing = feasibility.targetProfitCents != null && feasibility.targetPeriod == null;
  const hasPlannedLossLimit = (operatorMaxLossCents ?? feasibility.lossLimitCents) > 0;
  const headroomExhausted = noTrade?.reason === "portfolio_headroom_exhausted" || (remainingHeadroomCents != null && remainingHeadroomCents <= 0);
  const capacityMessage = headroomExhausted
    ? "Portfolio headroom exhausted"
    : !hasPlannedLossLimit
      ? "Planned-loss limit missing"
      : feasibility.riskBudgetCents <= 0
        ? "No proposal capacity remains"
        : null;
  const riskMessage = headroomExhausted
    ? (feasibility.clarification ?? "Your planned-loss limit is configured, but portfolio risk headroom is exhausted. Deployable broker cash is liquid, but the Mandate Planned-Loss Envelope is 100% committed by active positions.")
    : !hasPlannedLossLimit
      ? "A planned-loss limit is not configured yet. Enter one before underwriting a proposal."
      : feasibility.assessment;
  return <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <div className="grid gap-px sm:grid-cols-3" style={{ background: "var(--sh-border-1)" }}>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Mission</p><p className="mt-1 font-serif text-2xl">{money(feasibility.capitalBaseCents)}</p><p className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>{hasExplicitTarget ? `${money(feasibility.targetProfitCents)} / ${feasibility.targetPeriod}` : "No profit target requested"}</p></div>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Target feasibility</p><p className="mt-1 font-serif text-2xl">{feasibility.requiredReturnPct == null ? "Not requested" : `${feasibility.requiredReturnPct}%`}</p><StateMark state={state} label={feasibility.classification} compact /></div>
      <div className="p-4" style={{ background: "var(--sh-surface)" }}><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Risk envelope</p><p className="mt-1 font-serif text-2xl">{money(feasibility.normalPlayRiskCents)} normal</p><p className="mt-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>{money(feasibility.highConvictionRiskCents)} high-conviction · {money(feasibility.maxOpenRiskCents)} aggregate</p><BasisMark basis="calculated" label="Target excluded from sizing" formula="min(mission, mandate, portfolio, weekly headroom)" /></div>
    </div>
    <div className="border-t p-4" style={{ borderColor: "var(--sh-border-1)" }}>
      {capacityMessage && <p className="text-xs font-semibold" style={{ color: headroomExhausted || !hasPlannedLossLimit ? "var(--sh-red)" : "var(--sh-text-primary)" }}>{capacityMessage}</p>}
      <p className="mt-1 text-xs leading-5" style={{ color: headroomExhausted ? "var(--sh-red)" : "var(--sh-fg-muted)" }}>{targetPeriodMissing ? "A profit amount was recorded without a target period, so no return rate or aspiration is shown." : riskMessage}</p>
      
      {headroomExhausted && (
        <div className="mt-3 rounded-lg border p-3 text-xs space-y-2" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
          <p className="font-semibold text-[11px] uppercase tracking-wider text-amber-500">
            Three-Layer Capacity Attribution
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="rounded p-2.5 border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <p className="font-medium text-muted-foreground">1. Broker Layer (Cash)</p>
              <p className="mt-0.5 font-semibold text-emerald-500">Liquid / Unconstrained</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Purchasing power accommodates execution</p>
            </div>
            <div className="rounded p-2.5 border border-amber-500/50" style={{ background: "rgba(245, 158, 11, 0.08)" }}>
              <p className="font-medium text-amber-500">2. Mandate Risk Layer</p>
              <p className="mt-0.5 font-semibold text-amber-500">100% Committed (Binding)</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{money(feasibility.maxOpenRiskCents)} downside loss envelope saturated</p>
            </div>
            <div className="rounded p-2.5 border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <p className="font-medium text-muted-foreground">3. Mission Layer</p>
              <p className="mt-0.5 font-semibold">{money(feasibility.capitalBaseCents)} Sizing</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Bounded by Mandate downside ceiling</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-normal">
            <strong>Operating Clarification:</strong> Nominal cash balance does not grant incremental risk capacity. The Mandate Planned-Loss Envelope restricts aggregate open downside risk across all active plays.
          </p>
        </div>
      )}

      <dl className="mt-3 grid gap-px overflow-hidden rounded-lg border text-xs sm:grid-cols-3" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
        <div className="p-3" style={{ background: "var(--sh-surface-2)" }}><dt style={{ color: "var(--sh-fg-muted)" }}>Your planned-loss limit</dt><dd className="mt-1 font-semibold">{hasPlannedLossLimit ? money(operatorMaxLossCents ?? feasibility.lossLimitCents) : "Not configured"}</dd></div>
        <div className="p-3" style={{ background: "var(--sh-surface-2)" }}><dt style={{ color: "var(--sh-fg-muted)" }}>Effective normal-play risk</dt><dd className="mt-1 font-semibold">{money(feasibility.normalPlayRiskCents)}</dd></div>
        <div className="p-3" style={{ background: "var(--sh-surface-2)" }}><dt style={{ color: "var(--sh-fg-muted)" }}>Remaining aggregate headroom</dt><dd className="mt-1 font-semibold">{money(remainingHeadroomCents ?? feasibility.maxOpenRiskCents)}</dd></div>
      </dl>
      <p className="mt-2 text-[10px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>The tightest measured constraint controls. Target pressure explains feasibility; it never increases allowed risk.</p>
    </div>
  </section>;
}
