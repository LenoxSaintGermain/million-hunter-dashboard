import type { AttentionMonitoringFinding, AttentionSourceIssue } from "../../shared/apertureAttention";
import { MONITORING_FRESHNESS_MS, monitoringReviewState, type MonitoringInstrumentContext, type MonitoringObservation } from "../../shared/monitoringState";

type DeskOrder = MonitoringInstrumentContext & { id: number; runId: number; candidateId: number | null; accountId: number; status: string; reason?: string | null };
type Check = MonitoringObservation & { id: number; checkType: string; symbol?: string };
type ActivePlay = { id: number; accountId: number; symbol: string };
const monitorHref = (order: DeskOrder) => `/aperture/run/${order.runId}/execute${order.candidateId == null ? "?" : `?candidate=${order.candidateId}&`}lifecycle=monitoring`;

/** Pure adapter for already-authorized desk records. No queries, providers, or writes. */
export function deskMonitoringFindings(orders: DeskOrder[], byCandidate: ReadonlyMap<number, Check[]>): AttentionMonitoringFinding[] {
  const findings = new Map<string, AttentionMonitoringFinding>();
  for (const order of orders) {
    if (order.status !== "filled") continue;
    for (const check of order.candidateId == null ? [] : byCandidate.get(order.candidateId) ?? []) {
      if (!check.flagged || !check.finding) continue;
      // One candidate/check can affect more than one selected expression. Keep both orders.
      findings.set(`${order.id}:${check.id}`, {
        id: check.id, orderId: order.id, runId: order.runId, candidateId: order.candidateId,
        symbol: order.underlyingSymbol ?? order.symbol,
        kind: check.checkType === "thesis_invalidation" ? "invalidation" : "material_change",
        checkType: check.checkType, finding: check.finding, citations: check.citations, checkedAt: check.checkedAt,
        rationale: order.reason ?? null,
        instrument: { symbol: order.symbol, instrumentType: order.instrumentType, underlyingSymbol: order.underlyingSymbol, optionExpirationDate: order.optionExpirationDate, optionStrikePriceCents: order.optionStrikePriceCents },
      });
    }
  }
  return Array.from(findings.values());
}

export function deskAttentionSourceIssues({ orders, activePlays, monitoringByCandidate, monitoringUnavailable, positionsUnavailable, now }: {
  orders: DeskOrder[]; activePlays: ActivePlay[]; monitoringByCandidate: ReadonlyMap<number, Check[]>;
  monitoringUnavailable: boolean; positionsUnavailable: boolean; now: number;
}): AttentionSourceIssue[] {
  const issues: AttentionSourceIssue[] = [];
  if (monitoringUnavailable) issues.push({ source: "monitoring", state: "unavailable", label: "Sourced monitoring records", impact: "Monitoring findings could not be read. Unaffected order records remain available.", lastSuccessAt: null, actionLabel: "Retry monitoring status", href: null, recovery: "refresh_status" });
  else for (const order of orders.filter(order => order.status === "filled")) {
    const checks = order.candidateId == null ? [] : monitoringByCandidate.get(order.candidateId) ?? [];
    const missing = ["catalyst", "thesis_invalidation", "earnings", "macro"].filter(type => !checks.some(check => check.checkType === type));
    const unknown = checks.filter(check => monitoringReviewState(check, now).state === "unknown");
    if (!missing.length && !unknown.length) continue;
    const good = checks.filter(check => monitoringReviewState(check, check.checkedAt).state !== "unknown" && Number.isFinite(check.checkedAt));
    const stale = checks.some(check => Number.isFinite(check.checkedAt) && now - check.checkedAt > MONITORING_FRESHNESS_MS);
    issues.push({ source: "monitoring", state: missing.length || !stale ? "missing" : "stale", label: `${order.underlyingSymbol ?? order.symbol} monitoring · order #${order.id}`,
      impact: missing.length ? `Missing checks: ${missing.map(type => type.replaceAll("_", " ")).join(", ")}. Current monitoring eligibility is not established.` : "Recorded checks are stale or unverified; they cannot establish current monitoring eligibility.",
      lastSuccessAt: good.length ? Math.min(...good.map(check => check.checkedAt)) : null,
      actionLabel: `Review ${order.underlyingSymbol ?? order.symbol} checks`, href: monitorHref(order), recovery: "review_checks" });
  }
  for (const play of activePlays) {
    if (orders.some(order => order.status === "filled" && order.accountId === play.accountId && (order.underlyingSymbol ?? order.symbol) === play.symbol && order.candidateId != null)) continue;
    issues.push({ source: "monitoring", state: "missing", label: `${play.symbol} monitoring · play #${play.id}`, impact: "This active record has no linked candidate checks. Inspect its recorded context before relying on monitoring.", lastSuccessAt: null, actionLabel: "Inspect this play", href: `/aperture/plays?play=${play.id}`, recovery: "inspect_record" });
  }
  if (positionsUnavailable) issues.push({ source: "positions", state: "unavailable", label: "Position snapshots", impact: "Recorded position valuation could not be read. No current P&L conclusion is supported.", lastSuccessAt: null, actionLabel: "Retry position status", href: null, recovery: "refresh_status" });
  return issues;
}
