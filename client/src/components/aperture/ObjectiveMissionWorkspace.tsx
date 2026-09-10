import React, { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { replacePrimaryMissionHorizon, type MissionDraftValues, type MissionSection, type MissionStrategyDraft } from "@shared/apertureMissionDraft";
import type { TargetFeasibility } from "@shared/playUnderwriting";
import { ContextHelp } from "./ContextHelp";
import { StateMark } from "./DecisionVisualLanguage";

export type { MissionDraftValues } from "@shared/apertureMissionDraft";
export type ObjectiveMissionAccount = { id: number; label: string; lastSyncedAt?: number | null };
export type ObjectiveMissionCanonicalThesis = { id: number; name: string };
export type ObjectiveMissionSaveState = "loading" | "saving" | "saved" | "unsaved" | "failed";

/** Display-only server result. The parent must clear/invalidate it when its input
 * bindings change. Amounts and explanations must not be calculated by this UI. */
export type ObjectiveMissionRiskPreview = {
  accountId: number;
  feasibility: TargetFeasibility;
  asOf: number | null;
  constraintExplanation: string;
  measuredLimits?: ReadonlyArray<{ label: string; valueCents: number | null; context: string }>;
  /** Only an explicit ready status confirms freshness for the current inputs. */
  status?: "ready" | "loading" | "failed" | "stale";
};

export type ObjectiveMissionWorkspaceProps = {
  values: MissionDraftValues;
  onChange: (values: MissionDraftValues) => void;
  /** Only named paper accounts owned by the operator belong in this list. */
  accounts: ReadonlyArray<ObjectiveMissionAccount>;
  canonicalTheses: ReadonlyArray<ObjectiveMissionCanonicalThesis>;
  /** Refers to these exact values, not a previous successful save. */
  saveState: ObjectiveMissionSaveState;
  loading?: boolean;
  failure?: string | null;
  busy: boolean;
  blockedReason?: string | null;
  onSave: () => void;
  onUnderwrite: () => void;
  riskPreview?: ObjectiveMissionRiskPreview | null;
  onInspectRisk: () => void;
};

const scopeLabels: Record<MissionStrategyDraft["searchScope"], string> = {
  current_thesis: "Current thesis",
  related_opportunities: "Related opportunities",
  broader_permitted_universe: "Broad permitted search",
};
const intentLabels: Record<MissionStrategyDraft["intent"], string> = {
  deploy_excess_capital: "Deploy declared excess capital",
  redeploy_realized_gains: "Explore redeploying gains",
  explore_opportunity: "Explore an opportunity",
  review_material_change: "Review a material change",
};
const horizonLabels: Record<MissionDraftValues["holdingPeriod"], string> = {
  intraday: "Intraday", overnight: "Overnight", swing: "Swing",
  catalyst_window: "Catalyst window", position: "Position",
};
const instrumentLabels = { shares: "Shares", options: "Options", either: "Shares or options" } as const;
const surface = { borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" };
const muted = { color: "var(--sh-fg-muted)" };
const controlClass = "min-h-11 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const money = (cents: number | null) => cents == null || !Number.isFinite(cents)
  ? "Not measured" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
const timestamp = (at: number | null | undefined) => at == null || !Number.isFinite(new Date(at).getTime())
  ? "Not supplied" : new Date(at).toISOString().replace("T", " ").replace(".000Z", " UTC");

// Syntax/range checks on declarations only, never permitted-risk calculations.
// Keep the original string in values, including blank and partially typed input.
function declaredCents(raw: string): bigint | null {
  const text = raw.trim();
  if (text.length > 80 || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? cents : null;
}
type Field = "mission" | "intent" | "canonicalThesisId" | "holdingPeriod" | "targetProfit" | "requestedSymbols" | "accountId" | "capital" | "maxLoss" | "profitReserve";
type Issue = { section: 1 | 2; field: Field; message: string };
function inputIssues({ values, accounts, canonicalTheses }: Pick<ObjectiveMissionWorkspaceProps, "values" | "accounts" | "canonicalTheses">): Issue[] {
  const issues: Issue[] = [];
  const add = (section: 1 | 2, field: Field, message: string) => issues.push({ section, field, message });
  const strategy = values.strategyContext;
  if (values.mission.trim().length < 20) add(1, "mission", "Describe your question in at least 20 characters.");
  if (values.mission.length > 30_000) add(1, "mission", "Draft storage is limited to 30,000 characters; research has a separate 8,000-character combined limit.");
  else if (values.mission.trim().length > 8_000) add(1, "mission", "Research accepts at most 8,000 characters including thesis context. Shorten the question before underwriting; you can still save this draft.");
  if (!strategy) add(1, "intent", "Start a new objective draft in the parent workspace to retain its request identity.");
  if (strategy?.searchScope !== "broader_permitted_universe" && values.canonicalThesisId == null) add(1, "canonicalThesisId", "Choose a saved thesis for this scope, or choose a broad permitted search.");
  if (values.canonicalThesisId != null && !canonicalTheses.some(thesis => thesis.id === values.canonicalThesisId)) add(1, "canonicalThesisId", "This saved thesis is unavailable. Choose another or deliberately clear it for broad search.");
  if (!values.holdingPeriods.includes(values.holdingPeriod)) add(1, "holdingPeriod", "Confirm the primary horizon within the research horizons.");
  const target = declaredCents(values.targetProfit);
  if (values.targetProfit.trim() && (target == null || target <= 0)) add(1, "targetProfit", "Enter a positive dollar target with up to two decimals, or leave it blank.");
  if (strategy && strategy.searchScope !== "broader_permitted_universe" && !strategy.requestedSymbols.length) add(1, "requestedSymbols", "Name the exact securities for this thesis scope. Broad search is a separate choice.");
  if (strategy && (strategy.requestedSymbols.length > 100 || strategy.requestedSymbols.some(symbol => symbol.length > 32 || !/^[a-z]{1,5}(\.[a-z])?$/i.test(symbol.trim())))) add(1, "requestedSymbols", "Use up to 100 US security symbols separated by commas, with no empty entries (for example, AAPL, BRK.B).");
  if (!accounts.some(account => account.id === values.accountId && account.label.trim())) add(2, "accountId", "Choose a named Paper account.");
  const capital = declaredCents(values.capital), loss = declaredCents(values.maxLoss);
  if (capital == null || capital <= 0) add(2, "capital", "Enter positive declared capital with up to two decimals.");
  if (loss == null || loss <= 0) add(2, "maxLoss", "Enter a positive planned-loss limit with up to two decimals.");
  else if (capital != null && loss > capital) add(2, "maxLoss", "Keep planned loss within your declared capital.");
  if (strategy?.sourceOrder && strategy.sourceOrder.accountId !== values.accountId) add(2, "accountId", "The exact source belongs to a different Paper account. Select its account; the source is unchanged.");
  if (strategy?.intent === "redeploy_realized_gains" && !strategy.sourceOrder) add(1, "intent", "Gains redeployment needs an exact source order from the parent workspace. Choose another intent for now.");
  if (strategy?.profitReserve.trim() && declaredCents(strategy.profitReserve) == null) add(2, "profitReserve", "Enter a reserve with up to two decimals, or leave it blank.");
  return issues;
}

function FieldRow({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    {children}
    {error && <p id={`${id}-error`} role="alert" className="text-sm" style={{ color: "var(--sh-red)" }}>{error}</p>}
  </div>;
}

/** New-draft setup only. No identity initialization, persistence, risk authority,
 * receipt reconciliation or job lifecycle belongs in this controlled component. */
export function ObjectiveMissionWorkspace(props: ObjectiveMissionWorkspaceProps) {
  const { values, onChange, accounts, canonicalTheses, saveState, busy, loading = false,
    failure, blockedReason, onSave, onUnderwrite, riskPreview, onInspectRisk } = props;
  const prefix = useId();
  const [attempted, setAttempted] = useState<ReadonlyArray<1 | 2>>([]);
  const strategy = values.strategyContext;
  const issues = inputIssues(props);
  const selectedAccount = accounts.find(account => account.id === values.accountId);
  const selectedThesis = canonicalTheses.find(thesis => thesis.id === values.canonicalThesisId);
  const locked = busy || loading || saveState === "loading" || saveState === "saving";
  const change = (patch: Partial<MissionDraftValues>) => {
    if (!locked) onChange({ ...values, ...patch });
  };
  const changeStrategy = (patch: Partial<MissionStrategyDraft>) => {
    if (strategy) change({ strategyContext: { ...strategy, ...patch } });
  };
  const errors = (field: Field) => issues.find(issue => issue.field === field && attempted.includes(issue.section))?.message;
  const fieldProps = (field: Field) => ({ id: `${prefix}-${field}`, "aria-invalid": !!errors(field), "aria-describedby": errors(field) ? `${prefix}-${field}-error` : undefined });
  const go = (section: MissionSection) => {
    if (locked) return;
    const prior = ([1, 2] as const).filter(step => step < section);
    setAttempted(previous => Array.from(new Set([...previous, ...prior])));
    const missing = issues.find(issue => prior.includes(issue.section));
    change({ activeSection: missing?.section ?? section });
  };
  const receiptPresent = values.baseDecisionRunId != null || values.baseDecisionRevisionId != null;
  const identityIssue = !strategy?.requestId ? "Start a new objective draft in the parent workspace first."
    : strategy.intent === "deploy_excess_capital" && !strategy.declarationId ? "The parent workspace must initialize the capital declaration before this draft can be underwritten." : null;
  const failureText = failure || (saveState === "failed" ? "Draft save failed. Your inputs are still here; retry saving." : null);
  const unavailable = receiptPresent ? "This mission is already accepted. Continue from its receipt in the parent workspace."
    : values.branch !== "research" ? "This setup builds research. Continue hold or cash decisions in the parent workspace."
    : identityIssue;
  const matchingPreview = riskPreview?.accountId === values.accountId ? riskPreview : null;
  const previewCurrent = matchingPreview?.status === "ready" && matchingPreview.asOf != null && Number.isFinite(matchingPreview.asOf);
  const previewWarning = matchingPreview && !previewCurrent
    ? `Constraint ${matchingPreview.status === "loading" ? "refreshing" : matchingPreview.status === "failed" ? "refresh failed" : matchingPreview.status === "stale" ? "is stale" : "freshness is unconfirmed"}. Recorded values only; current eligibility is not confirmed.` : null;
  const actionBlock = unavailable || (loading || saveState === "loading" ? "Loading the draft and account choices." : null)
    || (busy ? "Underwriting is in progress." : null)
    || (saveState === "saving" ? "Saving your draft. Wait for confirmation." : null)
    || failureText || blockedReason || previewWarning || issues[0]?.message
    || (saveState !== "saved" ? "Save this draft before underwriting." : null);
  const effectiveSaveState = failureText ? "failed" : loading ? "loading" : saveState;
  const saveLabel = { loading: "Loading draft", saving: "Saving…", saved: "Saved", unsaved: "Unsaved changes", failed: "Save or action failed" }[effectiveSaveState];
  const summaries = {
    1: `${strategy ? scopeLabels[strategy.searchScope] : "Choose intent"} · ${horizonLabels[values.holdingPeriod]}${values.canonicalThesisId == null ? " · No canonical thesis selected" : ` · ${selectedThesis?.name ?? "Selected thesis unavailable"}`}`,
    2: `${selectedAccount?.label || "Choose a named account"} · Paper · Declared capital ${values.capital ? `$${values.capital}` : "not entered"} · Planned loss ${values.maxLoss ? `$${values.maxLoss}` : "not entered"}`,
    3: "Confirm your declarations and the returned constraint.",
  };
  const sectionHeader = (section: MissionSection, title: string) => <div className="flex items-start justify-between gap-3">
    <div className="min-w-0"><h3 id={`${prefix}-heading-${section}`} className="text-base font-semibold">{section}. {title}</h3>
      {values.activeSection !== section && <p className="mt-1 break-words text-sm" style={muted}>{summaries[section]}</p>}
      {values.activeSection !== section && issues.filter(issue => issue.section === section && attempted.includes(issue.section)).map(issue => <p key={issue.field} role="alert" className="mt-1 text-sm" style={{ color: "var(--sh-red)" }}>{issue.message}</p>)}
    </div>
    <Button type="button" variant="ghost" className="min-h-11" disabled={locked}
      aria-expanded={values.activeSection === section} aria-controls={`${prefix}-section-${section}`}
      onClick={() => go(section)}>{values.activeSection === section ? "Editing" : section === 3 ? "Review" : `Edit ${title.toLowerCase()}`}</Button>
  </div>;
  const source = strategy?.sourceOrder;
  const thesisScope = strategy != null && strategy.searchScope !== "broader_permitted_universe";

  return <section aria-label="Objective Mission setup" aria-busy={locked} className="space-y-3" style={{ color: "var(--sh-text-primary)" }}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-serif text-2xl">Your mission</h2><p className="mt-1 text-sm" style={muted}>Start with a question. A thesis is optional for broad research.</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <span role="status"><StateMark state={effectiveSaveState === "saved" ? "rule_qualified" : effectiveSaveState === "failed" ? "blocked" : "unknown"} label={saveLabel} /></span>
        <Button type="button" variant="outline" className="min-h-11" disabled={locked || receiptPresent} onClick={() => { if (!locked && !receiptPresent) onSave(); }}>{saveState === "saving" ? "Saving…" : saveState === "failed" ? "Retry save" : "Save draft"}</Button>
      </div>
    </header>
    {failureText && <p role="alert" className="text-sm" style={{ color: "var(--sh-red)" }}>{failureText}</p>}
    {unavailable && <p role="alert" className="text-sm" style={{ color: "var(--sh-signal)" }}>{unavailable}</p>}
    {values.activeSection !== 3 && previewWarning && <p role="alert" className="text-sm" style={{ color: "var(--sh-signal)" }}>{previewWarning}</p>}
    {values.activeSection !== 3 && (blockedReason || locked) && <p role="status" className="text-sm" style={{ color: "var(--sh-signal)" }}>{blockedReason || (busy ? "Underwriting is in progress." : loading || saveState === "loading" ? "Loading the draft and account choices." : "Saving your draft. Wait for confirmation.")}</p>}
    <section aria-labelledby={`${prefix}-heading-1`} className="rounded-xl border p-4" style={surface}>
      {sectionHeader(1, "Question & scope")}
      <div id={`${prefix}-section-1`} hidden={values.activeSection !== 1} className="mt-4 space-y-4">
        <FieldRow id={`${prefix}-mission`} label="What should we research?" error={errors("mission")}>
          <Input {...fieldProps("mission")} className="min-h-11" value={values.mission} disabled={locked}
            onChange={event => change({ mission: event.target.value, missionDirty: true })} />
        </FieldRow>
        <p className="text-sm" style={muted}>Research limit: 8,000 characters including any selected thesis context. Saving a draft does not validate that combined limit.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow id={`${prefix}-intent`} label="Intent" error={errors("intent")}>
            <select {...fieldProps("intent")} className={controlClass} style={surface} value={strategy?.intent ?? ""} disabled={locked || !strategy}
              onChange={event => { const intent = event.target.value as MissionStrategyDraft["intent"]; if (intent !== "redeploy_realized_gains" || source) changeStrategy({ intent }); }}>
              <option value="" disabled>Choose intent</option>
              {Object.entries(intentLabels).map(([value, label]) => <option key={value} value={value} disabled={value === "redeploy_realized_gains" && !source}>{label}{value === "redeploy_realized_gains" && !source ? " — source needed" : ""}</option>)}
            </select>
          </FieldRow>
          <FieldRow id={`${prefix}-scope`} label="Search scope">
            <select id={`${prefix}-scope`} className={controlClass} style={surface} value={strategy?.searchScope ?? ""} disabled={locked || !strategy}
              onChange={event => changeStrategy({ searchScope: event.target.value as MissionStrategyDraft["searchScope"] })}>
              <option value="" disabled>Choose scope</option>
              {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FieldRow>
        </div>
        <FieldRow id={`${prefix}-canonicalThesisId`} label={strategy?.searchScope === "broader_permitted_universe" ? "Canonical thesis (optional)" : "Canonical thesis"} error={errors("canonicalThesisId")}>
          <select {...fieldProps("canonicalThesisId")} className={controlClass} style={surface} value={values.canonicalThesisId ?? ""} disabled={locked}
            onChange={event => change({ canonicalThesisId: event.target.value ? Number(event.target.value) : null })}>
            <option value="">No canonical thesis selected</option>
            {values.canonicalThesisId != null && !selectedThesis && <option value={values.canonicalThesisId}>Selected thesis unavailable (#{values.canonicalThesisId})</option>}
            {canonicalTheses.map(thesis => <option key={thesis.id} value={thesis.id}>{thesis.name}</option>)}
          </select>
        </FieldRow>
        <FieldRow id={`${prefix}-holdingPeriod`} label="Primary horizon" error={errors("holdingPeriod")}>
          <select {...fieldProps("holdingPeriod")} className={controlClass} style={surface} value={values.holdingPeriod} disabled={locked}
            onChange={event => { const next = event.target.value as MissionDraftValues["holdingPeriod"]; change({ holdingPeriod: next, holdingPeriods: replacePrimaryMissionHorizon(values.holdingPeriod, next, values.holdingPeriods) }); }}>
            {Object.entries(horizonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {values.holdingPeriods.length > 1 && <p className="text-sm" style={muted}>Research horizons retained: {values.holdingPeriods.map(period => horizonLabels[period]).join(", ")}.</p>}
          {!values.holdingPeriods.includes(values.holdingPeriod) && <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={() => change({ holdingPeriods: [values.holdingPeriod] })}>Use primary horizon only</Button>}
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow id={`${prefix}-targetProfit`} label="Profit target (optional, USD)" error={errors("targetProfit")}>
            <Input {...fieldProps("targetProfit")} className="min-h-11" inputMode="decimal" value={values.targetProfit} disabled={locked} onChange={event => change({ targetProfit: event.target.value })} />
          </FieldRow>
          {values.targetProfit !== "" && <FieldRow id={`${prefix}-targetPeriod`} label="Target period">
            <select id={`${prefix}-targetPeriod`} className={controlClass} style={surface} value={values.targetPeriod} disabled={locked} onChange={event => change({ targetPeriod: event.target.value as MissionDraftValues["targetPeriod"] })}>
              <option value="session">Session</option><option value="week">Week</option><option value="month">Month</option>
            </select>
          </FieldRow>}
        </div>
        <p className="text-sm" style={muted}>A target is an aspiration, not a forecast or permission to take more risk.</p>
        <details open={thesisScope || errors("requestedSymbols") ? true : undefined}>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{thesisScope ? "Requested symbols (required for this scope)" : "Requested symbols (optional)"}</summary>
          <FieldRow id={`${prefix}-requestedSymbols`} label="Symbols to include in research" error={errors("requestedSymbols")}>
            <Input {...fieldProps("requestedSymbols")} className="min-h-11" value={strategy?.requestedSymbols.join(",") ?? ""} disabled={locked || !strategy}
              onChange={event => changeStrategy({ requestedSymbols: event.target.value === "" ? [] : event.target.value.split(",") })} />
          </FieldRow>
          <p className="mt-1 text-sm" style={muted}>{thesisScope ? "Name the exact securities to research within this thesis scope." : "Broad research needs no symbols."} Separate symbols with commas.</p>
        </details>
        <Button type="button" className="min-h-11" disabled={locked} onClick={() => go(2)}>Continue to account & risk</Button>
      </div>
    </section>
    <section aria-labelledby={`${prefix}-heading-2`} className="rounded-xl border p-4" style={surface}>
      {sectionHeader(2, "Account & risk")}
      {source && <p className="mt-2 break-words text-sm" style={{ color: "var(--sh-signal)" }}>Hypothetical until verified · Source account #{source.accountId} / run #{source.runId} / candidate #{source.candidateId} / order #{source.orderId}. This reference does not verify gains or available capital.</p>}
      <div id={`${prefix}-section-2`} hidden={values.activeSection !== 2} className="mt-4 space-y-4">
        <FieldRow id={`${prefix}-accountId`} label="Named Paper account" error={errors("accountId")}>
          <select {...fieldProps("accountId")} className={controlClass} style={surface} value={values.accountId ?? ""} disabled={locked}
            onChange={event => change({ accountId: event.target.value ? Number(event.target.value) : null })}>
            <option value="">Choose a Paper account</option>
            {values.accountId != null && !selectedAccount && <option value={values.accountId}>Selected account unavailable (#{values.accountId})</option>}
            {accounts.map(account => <option key={account.id} value={account.id}>{account.label} · Paper</option>)}
          </select>
          <p className="text-sm" style={muted}>Last synced: {timestamp(selectedAccount?.lastSyncedAt)}. Account balances are not allocated capital.</p>
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow id={`${prefix}-capital`} label="Declared capital (USD)" error={errors("capital")}>
            <Input {...fieldProps("capital")} className="min-h-11" inputMode="decimal" value={values.capital} disabled={locked} onChange={event => change({ capital: event.target.value })} />
          </FieldRow>
          <FieldRow id={`${prefix}-maxLoss`} label="Maximum planned loss (USD)" error={errors("maxLoss")}>
            <Input {...fieldProps("maxLoss")} className="min-h-11" inputMode="decimal" value={values.maxLoss} disabled={locked} onChange={event => change({ maxLoss: event.target.value })} />
          </FieldRow>
        </div>
        <div className="flex items-start justify-between gap-3"><p className="text-sm" style={muted}>These are your declarations. Server checks may return a lower effective constraint.</p><ContextHelp title="Declared capital and loss" what="An account balance or source-order reference does not allocate capital. Your planned-loss limit is a ceiling you declare, not permission to use it." next="Review the server-returned constraint before underwriting." /></div>
        {(strategy?.intent === "redeploy_realized_gains" || strategy?.profitReserve) && <FieldRow id={`${prefix}-profitReserve`} label="Profit reserve (optional, USD)" error={errors("profitReserve")}>
          <Input {...fieldProps("profitReserve")} className="min-h-11" inputMode="decimal" value={strategy?.profitReserve ?? ""} disabled={locked} onChange={event => changeStrategy({ profitReserve: event.target.value })} />
        </FieldRow>}
        <FieldRow id={`${prefix}-instrument`} label="Instrument preference">
          <select id={`${prefix}-instrument`} className={controlClass} style={surface} value={values.instrument} disabled={locked} onChange={event => change({ instrument: event.target.value as MissionDraftValues["instrument"] })}>
            {Object.entries(instrumentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FieldRow>
        {values.instrument !== "shares" && <p className="text-sm" style={muted}>Options preference is research only. Contract selection and defined-loss checks come after research.</p>}
        <Button type="button" className="min-h-11" disabled={locked} onClick={() => go(3)}>Review mission</Button>
      </div>
    </section>
    <section aria-labelledby={`${prefix}-heading-3`} className="rounded-xl border p-4" style={surface}>
      {sectionHeader(3, "Review")}
      <div id={`${prefix}-section-3`} hidden={values.activeSection !== 3} className="mt-4 space-y-3">
        <p className="break-words text-sm">{values.mission || "Question not entered."}</p>
        <p className="text-sm" style={muted}>{strategy ? intentLabels[strategy.intent] : "Intent not initialized"} · {instrumentLabels[values.instrument]}{values.targetProfit ? ` · Target $${values.targetProfit} / ${values.targetPeriod}` : " · No profit target"}</p>
        <div aria-label="Server risk preview" className="space-y-2 rounded-lg border p-3" style={{ ...surface, background: "var(--sh-surface-2)" }}>
          <h4 className="text-sm font-semibold">{matchingPreview && !previewCurrent ? "Recorded effective constraint" : "Effective constraint"} <span className="mt-1 block font-serif text-2xl tabular-nums">{matchingPreview ? money(matchingPreview.feasibility.riskBudgetCents) : "Not measured"}</span></h4>
          {matchingPreview ? <>
            {previewWarning && <p role="alert" className="text-sm" style={{ color: "var(--sh-signal)" }}>{previewWarning}</p>}
            <p className="text-sm">{matchingPreview.constraintExplanation || "The server has not supplied a constraint explanation."}</p>
            <p className="text-xs" style={muted}>Server preview as of {timestamp(matchingPreview.asOf)}. This is not order approval.</p>
            {matchingPreview.feasibility.targetProfitCents != null && <div className="border-t pt-2" style={{ borderColor: "var(--sh-border-1)" }}>
              <StateMark state={matchingPreview.feasibility.classification === "extreme" ? "blocked" : "conditional"} label={`${previewCurrent ? "Target feasibility" : "Recorded target feasibility"}: ${matchingPreview.feasibility.classification.replaceAll("_", " ")}`} />
              <p className="mt-1 text-sm">{matchingPreview.feasibility.requiredReturnPct == null ? "Required return not measured" : `${matchingPreview.feasibility.requiredReturnPct}% required`}{matchingPreview.feasibility.targetPeriod ? ` / ${matchingPreview.feasibility.targetPeriod}` : " · period not measured"}. {matchingPreview.feasibility.assessment}</p>
              <p className="mt-1 text-sm" style={muted}>Aspirational, not a forecast. The target never increases allowed risk.</p>
            </div>}
            {!!matchingPreview.measuredLimits?.length && <details>
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Measured limit context</summary>
              <dl className="space-y-2 text-sm">{matchingPreview.measuredLimits.map((limit, index) => <div key={`${limit.label}-${index}`}><dt className="font-medium">{limit.label}: {money(limit.valueCents)}</dt><dd style={muted}>{limit.context}</dd></div>)}</dl>
            </details>}
          </> : <p className="text-sm" style={muted}>No matching server preview yet. No permitted risk is inferred from your declarations.</p>}
          <Button type="button" variant="outline" className="min-h-11" onClick={onInspectRisk}>Inspect effective constraint</Button>
        </div>
        {issues.length > 0 && <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={() => { setAttempted([1, 2]); change({ activeSection: issues[0].section }); }}>Review missing values</Button>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="min-h-11" disabled={!!actionBlock} aria-describedby={`${prefix}-effect ${prefix}-blocked`} onClick={() => { if (!actionBlock) onUnderwrite(); }}>{busy ? "Underwriting…" : "Underwrite my mission"}</Button>
        </div>
        <p id={`${prefix}-effect`} className="text-sm" style={muted}>Builds research. No order is created or submitted.</p>
        <p id={`${prefix}-blocked`} role="status" className="text-sm" style={{ color: actionBlock ? "var(--sh-signal)" : "var(--sh-fg-muted)" }}>{actionBlock ?? "Ready for your explicit request."}</p>
      </div>
    </section>
  </section>;
}
