import { AlertTriangle, CircleSlash2, Clock3, OctagonX, SearchCheck, ShieldCheck, ShieldX } from "lucide-react";
import { resolveEffectiveRiskLimit } from "@shared/effectiveRiskLimit";

export type WorkflowState = "researchable" | "conditional" | "blocked" | "stale" | "rule_qualified" | "cash" | "unknown";
export type NumberBasis = "measured" | "declared" | "calculated" | "modeled" | "aspirational" | "unknown";

const workflowSpecs: Record<WorkflowState, { label: string; icon: typeof SearchCheck; color: string; border?: string }> = {
  researchable: { label: "Researchable", icon: SearchCheck, color: "var(--sh-cyan)", border: "var(--sh-cyan)" },
  conditional: { label: "Conditional", icon: AlertTriangle, color: "var(--sh-amber)", border: "var(--sh-amber)" },
  blocked: { label: "Blocked", icon: OctagonX, color: "var(--sh-red)", border: "var(--sh-red)" },
  stale: { label: "Stale", icon: Clock3, color: "var(--sh-fg-muted)", border: "var(--sh-fg-muted)" },
  rule_qualified: { label: "Rule-qualified", icon: ShieldCheck, color: "var(--sh-emerald)", border: "var(--sh-emerald)" },
  cash: { label: "Cash / control", icon: CircleSlash2, color: "var(--sh-fg-muted)", border: "var(--sh-fg-muted)" },
  unknown: { label: "Unknown", icon: ShieldX, color: "var(--sh-fg-muted)", border: "var(--sh-fg-muted)" },
};

const basisLabels: Record<NumberBasis, string> = {
  measured: "Measured",
  declared: "Operator-set",
  calculated: "Calculated",
  modeled: "Modeled",
  aspirational: "Aspirational",
  unknown: "Unknown",
};

function basisGeometry(basis: NumberBasis) {
  if (basis === "measured") return "rounded-full bg-current";
  if (basis === "declared") return "bg-current";
  if (basis === "calculated") return "rotate-45 border-2 border-current";
  if (basis === "modeled") return "border-2 border-dashed border-current rounded-sm";
  if (basis === "aspirational") return "rounded-full border-2 border-dotted border-current opacity-70";
  return "rounded-full border-2 border-current bg-transparent";
}

export function StateMark({ state, label, compact = false }: { state: WorkflowState; label?: string; compact?: boolean }) {
  const spec = workflowSpecs[state];
  const Icon = spec.icon;
  return <span className="inline-flex items-center gap-1.5" style={{ color: spec.color }}><Icon aria-hidden="true" className={compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} strokeWidth={1.8} /><span className={compact ? "text-[0.62rem] font-semibold uppercase tracking-[0.1em]" : "text-xs font-semibold"}>{label ?? spec.label}</span></span>;
}

export function BasisMark({ basis, label, formula }: { basis: NumberBasis; label?: string; formula?: string }) {
  const text = label ?? basisLabels[basis];
  return <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em]" style={{ color: basis === "aspirational" ? "var(--sh-fg-muted)" : "var(--sh-fg-muted)" }} title={formula}><span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 ${basisGeometry(basis)}`} /><span>{text}{formula ? " · fx" : ""}</span></span>;
}

export function workflowStyle(state: WorkflowState) {
  const spec = workflowSpecs[state];
  return { color: spec.color, borderColor: spec.border };
}

function formatMoney(cents: number | null | undefined) {
  return cents == null ? "—" : `$${Math.round(cents / 100).toLocaleString()}`;
}

function formatMoneyExact(cents: number | null | undefined) {
  return cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export function TypedStatusStrip({ state, horizon, operatorCapCents, syncedAt, catalystLabel }: { state: WorkflowState; horizon: string; operatorCapCents: number | null; syncedAt: number | null | undefined; catalystLabel?: string | null }) {
  const stale = syncedAt == null || Date.now() - syncedAt > 60 * 60 * 1000;
  const freshness = syncedAt == null ? "synced —" : `synced ${Math.max(0, Math.floor((Date.now() - syncedAt) / 3_600_000))}h ago`;
  return <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border lg:grid-cols-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
    <div className="flex min-w-0 items-center gap-2 px-3 py-2" style={{ background: "var(--sh-surface-2)" }}><StateMark state={state} compact /><span className="sr-only">Workflow state</span></div>
    <div className="min-w-0 px-3 py-2" style={{ background: "var(--sh-surface-2)" }}><BasisMark basis="declared" label="Horizon" /><p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{horizon}</p></div>
    <div className="min-w-0 px-3 py-2" style={{ background: "var(--sh-surface-2)" }}><BasisMark basis="declared" label="Operator loss cap" /><p className="mt-1 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{formatMoney(operatorCapCents)}</p></div>
    <div className="min-w-0 px-3 py-2" style={{ background: "var(--sh-surface-2)" }}><BasisMark basis={catalystLabel ? "declared" : "unknown"} label="Catalyst" /><p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{catalystLabel ?? "—"}</p></div>
    <div className={`col-span-2 min-w-0 px-3 py-2 lg:col-span-1 ${stale ? "border-dashed" : ""}`} style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-fg-muted)" }}><StateMark state={stale ? "stale" : "rule_qualified"} label={freshness} compact /></div>
  </div>;
}

export function ArgumentRail({ state, operatorCapCents, evidenceLabel, gateLabel }: { state: WorkflowState; operatorCapCents: number | null; evidenceLabel: string; gateLabel: string }) {
  const nodes: Array<{ title: string; state: WorkflowState; detail: string }> = [
    { title: "Thesis", state: "rule_qualified", detail: "Thesis bound" },
    { title: "Evidence", state: evidenceLabel === "—" ? "unknown" : state === "conditional" ? "conditional" : "researchable", detail: evidenceLabel === "—" ? "Evidence incomplete / unknown" : evidenceLabel },
    { title: "Mechanism", state: "unknown", detail: "Pending until research" },
    { title: "Risk", state: operatorCapCents == null ? "unknown" : "rule_qualified", detail: operatorCapCents == null ? "Operator cap —" : "Risk cap declared" },
    { title: "Gate", state, detail: gateLabel },
  ];
  return <section aria-label="Decision argument rail" className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><div role="list" className="grid grid-cols-2 gap-px sm:grid-cols-5" style={{ background: "var(--sh-border-1)" }}>{nodes.map((node, index) => <div role="listitem" key={node.title} className={`${index === nodes.length - 1 ? "col-span-2 sm:col-span-1" : ""} min-h-16 p-3 text-left sm:min-h-20`} style={{ background: "var(--sh-surface-2)" }}><p className="text-[0.58rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{index + 1}. {node.title}</p><div className="mt-1.5 sm:mt-2"><StateMark state={node.state} compact /></div><p className="mt-1 text-[11px] leading-4" style={{ color: "var(--sh-text-primary)" }}>{node.detail}</p></div>)}</div></section>;
}

export function RiskBudgetBar({ operatorCapCents, perPlayCeilingCents, accountEquityCents, accountMandatePct, concentrationBlocked }: { operatorCapCents: number | null; perPlayCeilingCents: number | null; accountEquityCents?: number | null; accountMandatePct?: number | null; concentrationBlocked: boolean }) {
  const resolved = resolveEffectiveRiskLimit(operatorCapCents, perPlayCeilingCents);
  if (resolved.effectiveLimitCents == null) return <section className="rounded-xl border border-dashed p-4" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><div className="flex items-center gap-2"><StateMark state="unknown" compact /><BasisMark basis="unknown" label="Risk limit —" /></div><p className="mt-2 text-xs leading-5">Your mission limit or the account mandate is not measured. The effective ticket limit is withheld.</p></section>;
  const mandateControls = resolved.controllingLimit === "account_mandate";
  const policyMathReady = accountMandatePct != null && accountEquityCents != null && accountEquityCents > 0 && perPlayCeilingCents != null;
  return <section className="rounded-xl border p-4" style={{ borderColor: concentrationBlocked ? "var(--sh-red)" : mandateControls ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Effective maximum loss</p><p className="mt-1 font-serif text-2xl tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{formatMoneyExact(resolved.effectiveLimitCents)}</p></div><BasisMark basis="calculated" label={mandateControls ? "Account mandate controls" : "Your lower limit controls"} formula="smaller of mission limit and account mandate" /></div><div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border text-xs" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><div className="border-r p-3" style={{ borderColor: "var(--sh-border-1)" }}><p style={{ color: "var(--sh-fg-muted)" }}>You requested</p><p className="mt-1 font-mono font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{formatMoneyExact(operatorCapCents)}</p></div><div className="p-3"><p style={{ color: "var(--sh-fg-muted)" }}>Account mandate</p><p className="mt-1 font-mono font-semibold tabular-nums" style={{ color: "var(--sh-text-primary)" }}>{formatMoneyExact(perPlayCeilingCents)}</p></div></div>{policyMathReady ? <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>Policy math: <strong style={{ color: "var(--sh-text-primary)" }}>{accountMandatePct.toFixed(2)}% of synced equity {formatMoneyExact(accountEquityCents)} = {formatMoneyExact(perPlayCeilingCents)} per play.</strong> The smaller limit controls. Change the account mandate through governance to permit more; mission capital cannot override it.</p> : <p className="mt-2 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>The smaller limit controls every ticket. Increasing mission capital does not raise the account mandate.</p>}{concentrationBlocked && <div className="mt-2"><StateMark state="blocked" label="Blocked by concentration" compact /></div>}</section>;
}
