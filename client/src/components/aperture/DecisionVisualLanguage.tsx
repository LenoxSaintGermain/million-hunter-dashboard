import { AlertTriangle, CircleSlash2, Clock3, OctagonX, SearchCheck, ShieldCheck, ShieldX } from "lucide-react";

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

export function TypedStatusStrip({ state, horizon, operatorCapCents, syncedAt, catalystLabel }: { state: WorkflowState; horizon: string; operatorCapCents: number | null; syncedAt: number | null | undefined; catalystLabel?: string | null }) {
  const stale = syncedAt == null || Date.now() - syncedAt > 60 * 60 * 1000;
  const freshness = syncedAt == null ? "synced —" : `synced ${Math.max(0, Math.floor((Date.now() - syncedAt) / 3_600_000))}h ago`;
  return <div className="grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-5" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-border-1)" }}>
    <div className="flex min-w-0 items-center gap-2 px-3 py-2" style={{ background: "var(--sh-surface-2)" }}><StateMark state={state} compact /><span className="sr-only">Workflow state</span></div>
    <div className="min-w-0 px-3 py-2" style={{ background: "var(--sh-surface-2)" }}><BasisMark basis="declared" label="Horizon" /><p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{horizon}</p></div>
    <div className="min-w-0 px-3 py-2" style={{ background: "var(--sh-surface-2)" }}><BasisMark basis="declared" label="Operator loss cap" /><p className="mt-1 text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{formatMoney(operatorCapCents)}</p></div>
    <div className="min-w-0 px-3 py-2" style={{ background: "var(--sh-surface-2)" }}><BasisMark basis={catalystLabel ? "measured" : "unknown"} label="Catalyst" /><p className="mt-1 truncate text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{catalystLabel ?? "—"}</p></div>
    <div className={`min-w-0 px-3 py-2 ${stale ? "border-dashed" : ""}`} style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-fg-muted)" }}><StateMark state={stale ? "stale" : "rule_qualified"} label={freshness} compact /></div>
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
  return <section aria-label="Decision argument rail" className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}><div className="grid gap-px sm:grid-cols-5" style={{ background: "var(--sh-border-1)" }}>{nodes.map((node, index) => <button key={node.title} type="button" className="min-h-20 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ background: "var(--sh-surface-2)" }}><p className="text-[0.58rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{index + 1}. {node.title}</p><div className="mt-2"><StateMark state={node.state} compact /></div><p className="mt-1 text-[11px] leading-4" style={{ color: "var(--sh-text-primary)" }}>{node.detail}</p></button>)}</div></section>;
}

export function RiskBudgetBar({ operatorCapCents, perPlayCeilingCents, concentrationBlocked }: { operatorCapCents: number | null; perPlayCeilingCents: number | null; concentrationBlocked: boolean }) {
  if (operatorCapCents == null || perPlayCeilingCents == null || perPlayCeilingCents <= 0) return <section className="rounded-xl border border-dashed p-4" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><div className="flex items-center gap-2"><StateMark state="unknown" compact /><BasisMark basis="unknown" label="Risk budget —" /></div><p className="mt-2 text-xs leading-5">Operator cap or per-play ceiling is not measured. Remaining ceiling is withheld.</p></section>;
  const utilization = Math.min(100, Math.max(0, operatorCapCents / perPlayCeilingCents * 100));
  const remaining = Math.max(0, perPlayCeilingCents - operatorCapCents);
  return <section className="rounded-xl border p-4" style={{ borderColor: concentrationBlocked ? "var(--sh-red)" : "var(--sh-border-1)", background: "var(--sh-surface-2)" }}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Risk budget</p><p className="mt-1 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{formatMoney(operatorCapCents)} operator cap <span style={{ color: "var(--sh-fg-muted)" }}>/ {formatMoney(perPlayCeilingCents)} per-play ceiling</span></p></div><BasisMark basis="calculated" label={`${utilization.toFixed(0)}% utilized`} formula="operator cap ÷ per-play ceiling" /></div><div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: "var(--sh-border-1)" }} role="progressbar" aria-label="Operator cap as a share of per-play ceiling" aria-valuemin={0} aria-valuemax={100} aria-valuenow={utilization} aria-valuetext={`${utilization.toFixed(0)}% of per-play ceiling; ${formatMoney(remaining)} remaining`}><div className="h-full" style={{ width: `${utilization}%`, background: concentrationBlocked ? "var(--sh-red)" : "var(--sh-emerald)" }} /></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span style={{ color: "var(--sh-fg-muted)" }}>{formatMoney(remaining)} remaining ceiling</span>{concentrationBlocked ? <StateMark state="blocked" label="Blocked by concentration" compact /> : <StateMark state="rule_qualified" label="Cap is a boundary, not eligibility" compact />}</div></section>;
}
