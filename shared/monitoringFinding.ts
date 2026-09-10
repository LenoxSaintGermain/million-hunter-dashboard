import type { MonitoringObservation } from "./monitoringState";

export type VersionedMonitoringFinding = MonitoringObservation & { id: number; checkType?: string };
export type MonitoringFindingSelection = { orderId: number; findingId: number; findingVersion: string };
export type MonitoringFindingRoute = MonitoringFindingSelection | { invalid: true } | null;

/** Exact local task identity for inline review; ownership/version remain server-checked. */
export function inlineMonitoringTarget(href: string): (MonitoringFindingSelection & { runId: number; candidateId: number }) | null {
  const match = /^\/aperture\/run\/([1-9][0-9]*)\/execute\?([^#]+)$/.exec(href);
  if (!match) return null;
  const query = new URLSearchParams(match[2]);
  const runId = Number(match[1]);
  const candidateId = Number(query.get('candidate'));
  const selected = parseMonitoringFindingSelection(match[2]);
  if (query.get('lifecycle') !== 'monitoring' || !selected || 'invalid' in selected
    || ![runId, candidateId].every(n => Number.isSafeInteger(n) && n > 0)) return null;
  return { ...selected, runId, candidateId };
}

/** A consistency token, not authorization. The server re-reads the owned record. */
export function monitoringFindingVersion(check: VersionedMonitoringFinding): string {
  const bytes = JSON.stringify([check.id, check.checkType ?? "", check.checkedAt, check.flagged, check.finding ?? null, check.citations ?? null]);
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes.charCodeAt(i), 16777619);
  return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function monitoringFindingHref(check: VersionedMonitoringFinding & { runId: number; candidateId: number | null; orderId: number }) {
  const query = new URLSearchParams({ candidate: String(check.candidateId ?? ""), lifecycle: "monitoring", order: String(check.orderId), finding: String(check.id), findingVersion: monitoringFindingVersion(check) });
  return `/aperture/run/${check.runId}/execute?${query}`;
}

export function parseMonitoringFindingSelection(search: string): MonitoringFindingRoute {
  const query = new URLSearchParams(search);
  if (!query.has("finding") && !query.has("findingVersion")) return null;
  const orderId = Number(query.get("order")), findingId = Number(query.get("finding"));
  const findingVersion = query.get("findingVersion") ?? "";
  if (![orderId, findingId].every(n => Number.isSafeInteger(n) && n > 0) || !/^v1-[a-f0-9]{8}$/.test(findingVersion)) return { invalid: true };
  return { orderId, findingId, findingVersion };
}

/** Never silently replace a missing/stale-link version with a different finding. */
export function selectMonitoringFinding<T extends VersionedMonitoringFinding>(checks: readonly T[], selection: MonitoringFindingRoute): {
  state: "none" | "invalid" | "missing" | "version_mismatch" | "selected";
  check?: T; historical?: boolean;
} {
  if (!selection) return { state: "none" };
  if ("invalid" in selection) return { state: "invalid" };
  const check = checks.find(item => item.id === selection.findingId);
  if (!check) return { state: "missing" };
  if (monitoringFindingVersion(check) !== selection.findingVersion) return { state: "version_mismatch" };
  return { state: "selected", check, historical: checks.some(item => item.checkType === check.checkType && (item.checkedAt > check.checkedAt || item.checkedAt === check.checkedAt && item.id > check.id)) };
}

export type MonitoringReviewDecision = "reviewed_unresolved" | "needs_fresh_evidence";
export type MonitoringReviewReceipt = MonitoringFindingSelection & {
  requestId: string;
  userId: number;
  runId: number;
  candidateId: number;
  reviewedAt: number;
  decision: MonitoringReviewDecision;
  note: string;
  resolved: false;
};
