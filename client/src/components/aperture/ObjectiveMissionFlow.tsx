import React, { useEffect, useRef, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { STALE_ACCOUNT_MS } from "@shared/cockpitRailSummary";
import {
  emptyMissionDraftValues, missionDraftFingerprint, missionDraftSaveState, missionDraftValuesSchema,
  type MissionDraftRecord, type MissionDraftValues,
} from "@shared/apertureMissionDraft";
import { ObjectiveMissionWorkspace, type ObjectiveMissionRiskPreview } from "./ObjectiveMissionWorkspace";
import { ObjectiveDiscoveryResult, type ObjectiveDiscoverySnapshot } from "./ObjectiveDiscoveryResult";

export type ObjectiveMissionFlowProps = {
  initialDraft?: MissionDraftRecord | null;
  receiptTarget?: { decisionRunId: number; revisionId: number } | null;
  newObjective?: boolean;
};
type Identity = { decisionRunId: number; decisionRevisionId: number };
type StartRequest = { requestId: string; expectedVersion: number };
type RiskResponse = inferRouterOutputs<AppRouter>["aperture"]["underwriter"]["preview"];
type Conflict = { remote: MissionDraftRecord | null; compared: boolean };
type UncertainStart = { request: StartRequest; fingerprint: string; state: "checking" | "unknown" | "safe" };
const readOptions = { retry: false as const, refetchOnWindowFocus: false };
const surface = { borderColor: "var(--sh-border-1)", background: "var(--sh-surface)", color: "var(--sh-text-primary)" };
const message = (error: unknown) => error instanceof Error ? error.message : "The request could not be confirmed. Your inputs are retained.";
const sameValues = (a: MissionDraftValues, b: MissionDraftValues) => missionDraftFingerprint(a) === missionDraftFingerprint(b);
const sameIdentity = (a: Identity | null, b: Identity | null) => !!a && !!b && a.decisionRunId === b.decisionRunId && a.decisionRevisionId === b.decisionRevisionId;
const draftIdentity = (record: MissionDraftRecord | null | undefined): Identity | null => record?.values.baseDecisionRunId != null && record.values.baseDecisionRevisionId != null
  ? { decisionRunId: record.values.baseDecisionRunId, decisionRevisionId: record.values.baseDecisionRevisionId } : null;
const freshAt = (at: number | null | undefined, now = Date.now()) => at != null && Number.isFinite(at) && at > 0 && at <= now && now - at <= STALE_ACCOUNT_MS;
const freshRisk = (data: RiskResponse) => freshAt(data.asOf) && freshAt(data.account.lastSyncedAt)
  && Number.isSafeInteger(data.feasibility.riskBudgetCents) && data.feasibility.riskBudgetCents >= 0;

/** Called only for an explicit New objective entry/action, never to repair a
 * missing identity, refresh a draft, or retry an uncertain acceptance. */
function newValues(): MissionDraftValues {
  return { ...emptyMissionDraftValues(), strategyContext: {
    schemaVersion: 1, requestId: crypto.randomUUID(), declarationId: crypto.randomUUID(),
    intent: "deploy_excess_capital", searchScope: "broader_permitted_universe",
    requestedSymbols: [], sourceOrder: null, profitReserve: "",
  } };
}

// Decimal syntax/range validation only. No client sizing or permitted-risk math.
function cents(raw: string): number | null {
  const value = raw.trim();
  if (value.length > 80 || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replaceAll(",", "").split(".");
  const amount = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
}
function riskInput(values: MissionDraftValues) {
  const capital = cents(values.capital), loss = cents(values.maxLoss);
  const target = values.targetProfit.trim() ? cents(values.targetProfit) : null;
  if (!values.accountId || capital == null || capital <= 0 || loss == null || loss <= 0 || loss > capital
    || (values.targetProfit.trim() && (target == null || target <= 0))
    || !values.holdingPeriods.length || !values.holdingPeriods.includes(values.holdingPeriod)) return null;
  return { accountId: values.accountId, objective: {
    deployableCapitalCents: capital, maxPlannedLossCents: loss, targetProfitCents: target,
    targetPeriod: target == null ? null : values.targetPeriod, holdingPeriods: values.holdingPeriods,
    instrumentPreference: values.instrument,
    maxPortfolioOpenRiskCents: null, weeklyLossLimitCents: null, eventRiskLimitCents: null,
  } };
}
const constraintText: Record<RiskResponse["portfolioRisk"]["bindingConstraint"], string> = {
  portfolio_headroom_exhausted: "The server reports no remaining portfolio risk headroom.",
  risk_policy_or_portfolio_headroom: "Server risk policy or portfolio headroom is below your declared maximum loss.",
  mission_max_loss: "The server reports that your declared maximum loss is the binding constraint.",
};
function previewView(data: RiskResponse, status: ObjectiveMissionRiskPreview["status"]): ObjectiveMissionRiskPreview {
  return { accountId: data.account.id, asOf: data.asOf, status, feasibility: data.feasibility,
    constraintExplanation: constraintText[data.portfolioRisk.bindingConstraint],
    measuredLimits: [
      { label: "Portfolio open risk", valueCents: data.portfolioRisk.beforeCents, context: "Server-measured open risk for this Paper account." },
      { label: "Remaining portfolio headroom", valueCents: data.portfolioRisk.remainingHeadroomCents, context: "Server-returned headroom, not an allocation." },
    ] };
}

/** Full field/identity comparison, including nested strategy context. No merge
 * silently elects the local or remote draft as the new source of truth. */
function DraftComparison({ local, remote, accounts, theses }: { local: MissionDraftValues; remote: MissionDraftValues | null;
  accounts: ReadonlyArray<{ id: number; label: string }>; theses: ReadonlyArray<{ id: number; name: string }> }) {
  const rows = (value: MissionDraftValues | null): Record<string, unknown> => {
    if (!value) return {};
    const { strategyContext, ...rest } = value;
    return { ...rest, ...Object.fromEntries(Object.entries(strategyContext ?? { strategyContext: null }).map(([key, entry]) => [`strategy.${key}`, entry])) };
  };
  const left = rows(local), right = rows(remote);
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).filter(key => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
  const labels: Record<string, string> = {
    mission: "Research question", accountId: "Paper account", canonicalThesisId: "Saved thesis",
    capital: "Declared capital", maxLoss: "Maximum planned loss", targetProfit: "Profit target", targetPeriod: "Target period",
    holdingPeriod: "Primary horizon", holdingPeriods: "Research horizons", instrument: "Instrument preference",
    includeHeld: "Include held securities", branch: "Decision", reason: "Reason", blocker: "Waiting on", reopen: "Reopen when",
    "strategy.intent": "Intent", "strategy.searchScope": "Search scope", "strategy.requestedSymbols": "Requested securities", "strategy.profitReserve": "Profit reserve",
  };
  const wording: Record<string, string> = {
    deploy_excess_capital: "Deploy declared excess capital", redeploy_realized_gains: "Explore redeploying gains",
    explore_opportunity: "Explore an opportunity", review_material_change: "Review a material change",
    current_thesis: "Current thesis", related_opportunities: "Related opportunities", broader_permitted_universe: "Broad permitted search",
    intraday: "Intraday", overnight: "Overnight", swing: "Swing", catalyst_window: "Catalyst window", position: "Position",
    shares: "Shares", options: "Options", either: "Shares or options", session: "Session", week: "Week", month: "Month",
    research: "Research", conditional: "Wait for a condition", cash: "Retain capital",
  };
  const display = (key: string, value: unknown): string => {
    if (value == null || value === "") return "Not entered";
    if (key === "accountId") return accounts.find(account => account.id === value)?.label ?? "Unavailable account (see record)";
    if (key === "canonicalThesisId") return theses.find(thesis => thesis.id === value)?.name ?? "Unavailable thesis (see record)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.length ? value.map(item => wording[String(item)] ?? String(item)).join(", ") : "None requested";
    if (["capital", "maxLoss", "targetProfit", "strategy.profitReserve"].includes(key)) return `$${value}`;
    return wording[String(value)] ?? String(value);
  };
  const materialKeys = keys.filter(key => labels[key]);
  return <div className="overflow-x-auto">
    <table className="w-full text-left text-sm"><caption className="py-2 text-left">Draft differences — local edits and saved version</caption>
      <thead><tr><th scope="col">Field</th><th scope="col">Local edits</th><th scope="col">Saved version</th></tr></thead>
      <tbody>{materialKeys.map(key => <tr key={key} className="border-t align-top" style={{ borderColor: "var(--sh-border-1)" }}>
        <th scope="row" className="p-2 font-medium">{labels[key]}</th>
        {[left[key], right[key]].map((value, index) => <td key={index} className="max-w-sm whitespace-pre-wrap break-words p-2">{display(key, value)}</td>)}
      </tr>)}</tbody>
    </table>
    {!materialKeys.length && <p className="text-sm">The question and declared assumptions match. Review any identity, workspace or completion changes in the record.</p>}
    <details><summary className="min-h-11 cursor-pointer py-2 text-sm">Exact identities and remaining changes</summary>
      <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify({
        identities: { local: { requestId: local.strategyContext?.requestId, declarationId: local.strategyContext?.declarationId,
          decisionRunId: local.baseDecisionRunId, revisionId: local.baseDecisionRevisionId, accountId: local.accountId, canonicalThesisId: local.canonicalThesisId },
        saved: remote ? { requestId: remote.strategyContext?.requestId, declarationId: remote.strategyContext?.declarationId,
          decisionRunId: remote.baseDecisionRunId, revisionId: remote.baseDecisionRevisionId, accountId: remote.accountId, canonicalThesisId: remote.canonicalThesisId } : null },
        changes: keys.map(key => ({ field: key, local: left[key] ?? null, saved: right[key] ?? null })),
      }, null, 2)}</pre>
    </details>
  </div>;
}

export function ObjectiveMissionFlow({ initialDraft, receiptTarget, newObjective = false }: ObjectiveMissionFlowProps) {
  const utils = trpc.useUtils();
  const draftQuery = trpc.aperture.runway.draft.get.useQuery(undefined, readOptions);
  // These endpoints are owner-scoped. Do not infer ownership from a label.
  const accountQuery = trpc.aperture.account.list.useQuery(undefined, readOptions);
  const canonicalQuery = trpc.thesis.list.useQuery(undefined, readOptions);
  const capabilities = trpc.aperture.strategy.capabilities.useQuery(undefined, readOptions);
  const saveMutation = trpc.aperture.runway.draft.save.useMutation({ retry: false });
  const startMutation = trpc.aperture.strategy.start.useMutation({ retry: false });
  const runMutation = trpc.aperture.strategy.run.useMutation({ retry: false });
  const [values, setValues] = useState<MissionDraftValues>(() => newObjective ? newValues() : initialDraft?.values ?? emptyMissionDraftValues());
  const [saved, setSaved] = useState<MissionDraftRecord | null>(initialDraft ?? null);
  const [initialized, setInitialized] = useState(!!initialDraft || newObjective);
  const [draftTarget, setTarget] = useState<Identity | null>(() => newObjective ? null : draftIdentity(initialDraft));
  // An explicit route always wins over draft hydration, including the very
  // first render after a prop change (before effects can run).
  const target = receiptTarget ? { decisionRunId: receiptTarget.decisionRunId, decisionRevisionId: receiptTarget.revisionId } : draftTarget;
  const [storedSnapshot, setSnapshot] = useState<ObjectiveDiscoverySnapshot | null>(null);
  const snapshot = sameIdentity(target, storedSnapshot) ? storedSnapshot : null;
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [backup, setBackup] = useState<MissionDraftValues | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [capabilityReadFailed, setCapabilityReadFailed] = useState(false);
  const [uncertain, setUncertain] = useState<UncertainStart | null>(null);
  const [risk, setRisk] = useState<{ binding: string; data: RiskResponse } | null>(null);
  const [riskPending, setRiskPending] = useState(false);
  const [riskFailure, setRiskFailure] = useState<string | null>(null);
  const [, setRiskClock] = useState(0);
  const operation = useRef(false);
  const mounted = useRef(true);
  const seenDraft = useRef<unknown>(undefined);
  const current = useRef({ values, saved, target, conflict, uncertain });
  current.current = { values, saved, target, conflict, uncertain };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const accounts = (accountQuery.data ?? []).filter(account => account.isPaper === true && !!account.label?.trim());
  const canonicalTheses = (canonicalQuery.data ?? []).map(thesis => ({ id: thesis.id, name: thesis.name || `Saved thesis #${thesis.id}` }));
  const account = accounts.find(item => item.id === values.accountId);
  const input = riskInput(values);
  const binding = JSON.stringify({ input, mission: values.mission, strategy: values.strategyContext,
    canonicalThesisId: values.canonicalThesisId, holdingPeriod: values.holdingPeriod,
    accountSyncedAt: account?.lastSyncedAt, accountUpdatedAt: account?.updatedAt });
  const bindingRef = useRef(binding); bindingRef.current = binding;
  const riskCurrent = !!risk && risk.binding === binding && !riskFailure && !riskPending && !accountQuery.error
    && freshAt(account?.lastSyncedAt) && freshRisk(risk.data);
  const riskPreview = risk ? previewView(risk.data, riskFailure ? "failed" : riskPending ? "loading" : riskCurrent ? "ready" : "stale") : null;
  useEffect(() => {
    if (!risk || !freshRisk(risk.data) || !freshAt(account?.lastSyncedAt)) return;
    const expires = Math.min(risk.data.asOf, risk.data.account.lastSyncedAt!, account!.lastSyncedAt!) + STALE_ACCOUNT_MS + 1;
    const timer = setTimeout(() => { if (mounted.current) setRiskClock(expires); }, Math.max(1, expires - Date.now()));
    return () => clearTimeout(timer);
  }, [risk, account?.lastSyncedAt]);

  const resultQuery = trpc.aperture.strategy.get.useQuery(target ?? { decisionRunId: 0, decisionRevisionId: 0 }, {
    ...readOptions, enabled: target != null,
    refetchInterval: query => query.state.data?.job.state === "running" ? 3000 : false,
  });

  function showSnapshot(next: ObjectiveDiscoverySnapshot) {
    if (!mounted.current) return;
    setTarget({ decisionRunId: next.decisionRunId, decisionRevisionId: next.decisionRevisionId });
    setSnapshot(next);
  }
  function observeDraft(remote: MissionDraftRecord | null) {
    if (!mounted.current) return;
    const local = current.current;
    if (!initialized) {
      setInitialized(true); setSaved(remote);
      if (remote?.values.strategyContext) { setValues(remote.values); setTarget(draftIdentity(remote)); }
      else if (remote?.completedAt == null && remote != null) setConflict({ remote, compared: false });
      return;
    }
    if (remote && local.saved && remote.version <= local.saved.version) {
      if (remote.version === local.saved.version && (!sameValues(remote.values, local.saved.values) || remote.completedAt !== local.saved.completedAt)) setConflict({ remote, compared: false });
      return;
    }
    if (!remote && !local.saved) return;
    // A deliberately new objective may use the completed head's version, never
    // silently replace an unrelated unfinished draft.
    if (newObjective && !local.saved && remote?.completedAt != null) { setSaved(remote); return; }
    if (remote?.completedAt == null || !local.saved || remote?.version !== local.saved.version) setConflict({ remote, compared: false });
  }
  useEffect(() => {
    if (draftQuery.isLoading || draftQuery.error || draftQuery.data === undefined || seenDraft.current === draftQuery.data) return;
    seenDraft.current = draftQuery.data;
    // The first read still detects an unfinished draft when an initial record
    // was supplied alongside an explicit New objective entry.
    if (newObjective && draftQuery.data?.completedAt == null && draftQuery.data != null
      && !sameValues(values, draftQuery.data.values)) setConflict({ remote: draftQuery.data, compared: false });
    else observeDraft(draftQuery.data);
  }, [draftQuery.data, draftQuery.isLoading, draftQuery.error]);
  useEffect(() => {
    setFailure(null);
  }, [receiptTarget?.decisionRunId, receiptTarget?.revisionId]);
  useEffect(() => {
    if (resultQuery.data && !resultQuery.error && sameIdentity(target, resultQuery.data)) { setSnapshot(resultQuery.data); setFailure(null); }
  }, [resultQuery.data, resultQuery.error, target?.decisionRunId, target?.decisionRevisionId]);

  const loading = !initialized || draftQuery.isLoading || accountQuery.isLoading || canonicalQuery.isLoading;
  const contextFailure = draftQuery.error || accountQuery.error || canonicalQuery.error;
  const capabilityBlock = capabilities.isLoading || capabilities.isFetching ? "Checking discovery availability."
    : capabilityReadFailed || capabilities.error || capabilities.data?.enabled !== true || capabilities.data?.mode !== "paper"
      ? "Objective discovery is unavailable. Existing drafts and saved findings are retained." : null;
  const saveState = missionDraftSaveState({ initialized, values, saved, saving, error: failure });
  const startBlock = loading ? "Loading the saved draft and account choices."
    : conflict ? "Compare the saved draft before adopting or replacing it."
      : contextFailure ? message(contextFailure) : capabilityBlock
        || (uncertain ? "Reconcile the original start before another action." : null)
        || (!riskCurrent ? "Inspect the effective constraint for these assumptions before underwriting." : null);

  async function refreshDraft() {
    if (operation.current) return;
    setRefreshing(true);
    try { const remote = await utils.aperture.runway.draft.get.fetch(undefined, { staleTime: 0 }); observeDraft(remote); }
    catch (error) { if (mounted.current) setFailure(message(error)); }
    finally { if (mounted.current) setRefreshing(false); }
  }
  async function save(replacement?: MissionDraftRecord | null) {
    if (operation.current || loading || target || uncertain || (replacement === undefined && conflict)) return;
    const checked = missionDraftValuesSchema.safeParse(current.current.values);
    if (!checked.success) { setFailure(checked.error.issues.map(issue => issue.message).join(" ")); return; }
    if (!checked.data.strategyContext) { setFailure("Create an objective explicitly. The existing thesis draft is retained."); return; }
    operation.current = true; setSaving(true); setFailure(null);
    const exactValues = checked.data;
    const base = replacement === undefined ? current.current.saved : replacement;
    try {
      const result = await saveMutation.mutateAsync({ values: exactValues, expectedVersion: base?.version ?? 0,
        ...(replacement !== undefined ? { replaceStrategyContext: true } : {}) });
      if (!mounted.current) return;
      if (result.version !== (base?.version ?? 0) + 1 || result.completedAt != null || !sameValues(result.values, exactValues)) throw new Error("The saved response does not match this draft. Compare the saved version before continuing.");
      setSaved(result); setConflict(null);
    } catch (error) {
      if (!mounted.current) return;
      setFailure(message(error));
      try { const remote = await utils.aperture.runway.draft.get.fetch(undefined, { staleTime: 0 }); if (mounted.current) setConflict({ remote, compared: false }); }
      catch { /* Keep the failed save and exact local inputs; no optimistic Saved. */ }
    } finally { operation.current = false; if (mounted.current) setSaving(false); }
  }
  async function inspectRisk() {
    if (!input || !account || accountQuery.error || riskPending || target) {
      setRiskFailure("Enter valid declared capital, planned loss, target and horizons, and choose a named Paper account."); return;
    }
    const requestedBinding = binding;
    setRiskPending(true); setRiskFailure(null);
    try {
      const result = await utils.aperture.underwriter.preview.fetch(input, { staleTime: 0 });
      if (!mounted.current || bindingRef.current !== requestedBinding) return;
      if (result.account.id !== input.accountId || result.account.isPaper !== true || result.asOf == null || !Number.isFinite(result.asOf)
        || result.objective.deployableCapitalCents !== input.objective.deployableCapitalCents
        || result.objective.maxPlannedLossCents !== input.objective.maxPlannedLossCents
        || result.objective.targetProfitCents !== input.objective.targetProfitCents
        || result.objective.targetPeriod !== input.objective.targetPeriod
        || result.objective.instrumentPreference !== input.objective.instrumentPreference
        || JSON.stringify(result.objective.holdingPeriods) !== JSON.stringify(input.objective.holdingPeriods)) throw new Error("The server preview does not match the selected account and declarations. Current risk is unconfirmed.");
      if (!Number.isSafeInteger(result.feasibility.riskBudgetCents) || result.feasibility.riskBudgetCents < 0) throw new Error("The server did not return a measured effective constraint. Current risk is unconfirmed.");
      setRisk({ binding: requestedBinding, data: result });
    } catch (error) { if (mounted.current && bindingRef.current === requestedBinding) setRiskFailure(message(error)); }
    finally { if (mounted.current) setRiskPending(false); }
  }

  async function reconcile(attempt: UncertainStart) {
    setUncertain({ ...attempt, state: "checking" });
    const [accepted, remote] = await Promise.allSettled([
      utils.aperture.strategy.resume.fetch({ requestId: attempt.request.requestId }, { staleTime: 0 }),
      utils.aperture.runway.draft.get.fetch(undefined, { staleTime: 0 }),
    ]);
    if (!mounted.current) return;
    if (accepted.status === "fulfilled" && accepted.value) {
      const found = accepted.value;
      if (found.acceptedValues.strategyContext?.requestId !== attempt.request.requestId || found.sourceDraftVersion !== attempt.request.expectedVersion) {
        setFailure("The accepted request has a different source version. Keep the original identity and compare its record.");
        setUncertain({ ...attempt, state: "unknown" }); return;
      }
      showSnapshot(found); setUncertain(null); setFailure(null); return;
    }
    if (remote.status === "fulfilled") observeDraft(remote.value);
    const exactDraft = remote.status === "fulfilled" && remote.value?.completedAt == null && remote.value != null
      && remote.value.version === attempt.request.expectedVersion
      && remote.value.values.strategyContext?.requestId === attempt.request.requestId
      && missionDraftFingerprint(remote.value.values) === attempt.fingerprint;
    if (accepted.status === "fulfilled" && accepted.value === null && exactDraft) {
      setUncertain({ ...attempt, state: "safe" });
      setFailure("No accepted Mission was found and the exact saved draft is unchanged. Retry only this original request.");
    } else {
      setUncertain({ ...attempt, state: "unknown" });
      setFailure("Start outcome is unconfirmed. Your original request identity and local edits are retained. Check the saved start again; do not create another request.");
    }
  }
  async function start(retry = false) {
    if (operation.current || target || conflict || loading || contextFailure || capabilityBlock) return;
    const local = current.current;
    if (!local.saved || local.saved.completedAt != null || !local.values.strategyContext || !sameValues(local.values, local.saved.values)) return;
    if (!riskCurrent || !risk || !freshRisk(risk.data) || !freshAt(account?.lastSyncedAt) || !input || !account) return;
    if (retry ? local.uncertain?.state !== "safe" || local.uncertain.fingerprint !== missionDraftFingerprint(local.values) : !!local.uncertain) return;
    const attempt: UncertainStart = retry ? local.uncertain! : {
      request: { requestId: local.saved.values.strategyContext!.requestId, expectedVersion: local.saved.version },
      fingerprint: missionDraftFingerprint(local.saved.values), state: "checking",
    };
    operation.current = true; setBusy(true); setFailure(null);
    try {
      // Retry permission is time-sensitive: repeat both reads immediately before
      // retrying, and never replace the original requestId/version.
      if (retry) {
        const [found, remote] = await Promise.all([
          utils.aperture.strategy.resume.fetch({ requestId: attempt.request.requestId }, { staleTime: 0 }),
          utils.aperture.runway.draft.get.fetch(undefined, { staleTime: 0 }),
        ]);
        if (!mounted.current) return;
        if (found) { await reconcile(attempt); return; }
        if (!remote || remote.completedAt != null || remote.version !== attempt.request.expectedVersion || missionDraftFingerprint(remote.values) !== attempt.fingerprint) { await reconcile(attempt); return; }
      }
      if (!mounted.current || bindingRef.current !== binding || !freshRisk(risk.data) || !freshAt(account.lastSyncedAt)) return;
      // The server's start transaction accepts AND executes discovery. A
      // second client run here would duplicate the deliberately requested work.
      const result = await startMutation.mutateAsync(attempt.request);
      if (!mounted.current) return;
      if (result.acceptedValues.strategyContext?.requestId !== attempt.request.requestId || result.sourceDraftVersion !== attempt.request.expectedVersion) throw new Error("The start response does not match the original saved request.");
      showSnapshot(result); setUncertain(null);
    } catch (error) {
      if (!mounted.current) return;
      setFailure(message(error)); await reconcile(attempt);
    } finally { operation.current = false; if (mounted.current) setBusy(false); }
  }
  async function refreshResult() {
    if (!target || operation.current) return;
    const exact = target; setRefreshing(true);
    try {
      const [result, availability] = await Promise.allSettled([
        utils.aperture.strategy.get.fetch(exact, { staleTime: 0 }),
        utils.aperture.strategy.capabilities.fetch(undefined, { staleTime: 0 }),
      ]);
      if (!mounted.current || !sameIdentity(current.current.target, exact)) return;
      // Availability is independent of the persisted result. A failed capability
      // read can block new actions, but cannot turn a Complete receipt into Failed.
      setCapabilityReadFailed(availability.status === "rejected");
      if (result.status === "fulfilled" && sameIdentity(result.value, exact)) { setSnapshot(result.value); setFailure(null); }
      else if (result.status === "rejected") setFailure(message(result.reason));
    }
    finally { if (mounted.current) setRefreshing(false); }
  }
  async function run(retry: boolean) {
    if (!target || !snapshot || operation.current || capabilityBlock) return;
    const exact = target, jobId = snapshot.job.jobId;
    operation.current = true; setBusy(true); setFailure(null);
    try {
      const fresh = await utils.aperture.strategy.get.fetch(exact, { staleTime: 0 });
      if (!mounted.current || !sameIdentity(current.current.target, exact) || !sameIdentity(fresh, exact)) return;
      setSnapshot(fresh);
      if (retry ? !fresh.job.canRetry || jobId == null || fresh.job.jobId !== jobId : fresh.job.state !== "not_started") return;
      const result = await runMutation.mutateAsync({ ...exact, ...(retry ? { retryJobId: jobId! } : {}) });
      if (mounted.current && sameIdentity(current.current.target, exact) && sameIdentity(result, exact)) setSnapshot(result);
    } catch (error) {
      if (!mounted.current) return;
      setFailure(message(error));
      try { const fresh = await utils.aperture.strategy.get.fetch(exact, { staleTime: 0 }); if (mounted.current && sameIdentity(current.current.target, exact) && sameIdentity(fresh, exact)) setSnapshot(fresh); }
      catch { /* A previous receipt remains visible, explicitly stale. */ }
    } finally { operation.current = false; if (mounted.current) setBusy(false); }
  }

  return <section aria-label="Connected objective mission" className="space-y-4" style={{ color: "var(--sh-text-primary)" }}>
    {target ? <>
      {!snapshot && <p role={resultQuery.error || failure ? "alert" : "status"}>{failure || (resultQuery.error ? "The exact accepted receipt could not be read. No draft was substituted." : "Loading the exact accepted Mission and its saved job…")}</p>}
      {snapshot && <section aria-label="Accepted Mission assumptions" className="space-y-2 rounded-xl border p-4" style={surface}>
        <h3 className="text-base font-semibold">Accepted Mission · source draft version {snapshot.sourceDraftVersion}</h3>
        <p className="whitespace-pre-wrap break-words text-sm">{snapshot.acceptedValues.mission}</p>
        <details><summary className="min-h-11 cursor-pointer py-2 text-sm">Exact accepted inputs and identities</summary>
          <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify({ decisionRunId: snapshot.decisionRunId, decisionRevisionId: snapshot.decisionRevisionId, values: snapshot.acceptedValues }, null, 2)}</pre>
        </details>
      </section>}
      {snapshot && <ObjectiveDiscoveryResult snapshot={snapshot} busy={busy} refreshing={refreshing || resultQuery.isFetching}
        failure={failure || (resultQuery.error ? message(resultQuery.error) : null)}
        actionBlockedReason={capabilityBlock}
        onRefresh={refreshResult} onRetry={() => run(true)} onStart={() => run(false)} />}
      {!snapshot && <Button type="button" variant="outline" className="min-h-11" onClick={refreshResult} disabled={refreshing}>Refresh saved receipt</Button>}
      {snapshot && !sameValues(values, snapshot.acceptedValues) && <details className="rounded-xl border p-4" style={surface}>
        <summary className="min-h-11 cursor-pointer py-2">Local draft retained — not the accepted assumptions</summary>
        <DraftComparison local={values} remote={snapshot.acceptedValues} accounts={accounts} theses={canonicalTheses} />
      </details>}
    </> : <>
      <ObjectiveMissionWorkspace values={values} onChange={next => { if (!operation.current) { setValues(next); setFailure(null); } }}
        accounts={accounts} canonicalTheses={canonicalTheses} saveState={saveState} loading={loading}
        failure={failure || (contextFailure ? message(contextFailure) : null)} busy={busy || saving}
        blockedReason={startBlock} onSave={() => save()} onUnderwrite={() => start()}
        riskPreview={riskPreview} onInspectRisk={inspectRisk} />
      {(riskFailure || riskPending) && <p role={riskFailure ? "alert" : "status"} className="text-sm" style={{ color: "var(--sh-signal)" }}>{riskFailure || "Reading the effective constraint from the server…"}</p>}
      <Button type="button" variant="ghost" className="min-h-11" onClick={refreshDraft} disabled={refreshing || busy || saving}>Refresh saved draft</Button>
      {!values.strategyContext && !loading && <Button type="button" variant="outline" className="min-h-11" onClick={() => {
        if (operation.current) return;
        setBackup(values); setValues(newValues()); setFailure(null);
        if (saved?.completedAt == null && saved != null) setConflict({ remote: saved, compared: false });
      }}>Create objective draft</Button>}
    </>}
    {uncertain && <section aria-label="Start reconciliation" className="space-y-3 rounded-xl border p-4" style={surface}>
      <p className="break-all text-sm">Original request {uncertain.request.requestId} · saved version {uncertain.request.expectedVersion}. No identity was reset.</p>
      <Button type="button" variant="outline" className="min-h-11" disabled={busy || uncertain.state === "checking"} onClick={() => reconcile(uncertain)}>Check saved start</Button>
      {uncertain.state === "safe" && <Button type="button" className="min-h-11" disabled={busy || !!capabilityBlock || !!conflict || !riskCurrent || uncertain.fingerprint !== missionDraftFingerprint(values)} onClick={() => start(true)}>Retry original start</Button>}
    </section>}
    {conflict && !target && <section aria-label="Draft recovery" className="space-y-3 rounded-xl border p-4" style={surface}>
      <h3 className="text-base font-semibold">Saved draft needs review</h3>
      <p className="text-sm">Your local edits are intact. {conflict.remote ? `Saved version ${conflict.remote.version}${conflict.remote.values.strategyContext ? " contains a capital objective" : " contains a thesis draft"}.` : "No saved draft was returned."} Nothing has been replaced.</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setConflict({ ...conflict, compared: true })}>Compare saved draft</Button>
      {conflict.compared && <>
        <DraftComparison local={values} remote={conflict.remote?.values ?? null} accounts={accounts} theses={canonicalTheses} />
        {conflict.remote && <Button type="button" variant="outline" className="min-h-11" disabled={busy || saving || !!uncertain} onClick={() => {
          if (operation.current || uncertain || !conflict.remote) return;
          setBackup(values); setValues(conflict.remote.values); setSaved(conflict.remote); setInitialized(true);
          setTarget(draftIdentity(conflict.remote)); setConflict(null); setFailure(null);
        }}>Use saved draft; retain local copy</Button>}
        {values.strategyContext && <Button type="button" variant="outline" className="min-h-11" disabled={busy || saving || !!uncertain} onClick={() => save(conflict.remote)}>Replace saved draft with my edits</Button>}
      </>}
    </section>}
    {backup && <details className="rounded-xl border p-4" style={surface}>
      <summary className="min-h-11 cursor-pointer py-2">Retained local copy</summary>
      <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(backup, null, 2)}</pre>
    </details>}
  </section>;
}
