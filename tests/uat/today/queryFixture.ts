import { useSyncExternalStore } from "react";
import { deriveApertureAttention, type ApertureAttentionInput } from "../../../shared/apertureAttention";

export const scenarios = ["Quiet", "Cold loading", "Partial dispatch", "Retrying partial", "Failed refresh", "Research loading"] as const;
const now = Date.UTC(2026, 8, 9, 14, 42);
const listeners = new Set<() => void>();
let version = 0;
export const receipts = { seenWrites: 0, statusReads: 0, lifecycleMutations: 0 };
type Query = { data: any; isLoading: boolean; isFetching: boolean; error: any; refetch: () => void };
const names = ["desk", "account", "thesis", "plays", "runway", "cockpit", "trigger"] as const;
const records = Object.fromEntries(names.map(name => [name, {}])) as Record<typeof names[number], Query>;
const notify = () => { version++; listeners.forEach(listener => listener()); };
export function setScenario(name: typeof scenarios[number]) {
  const input: ApertureAttentionInput = {
    now, mission: { decisionRunId: 1, revisionId: 2, state: "complete", title: "Illustrative UAT", updatedAt: now },
    underwriting: null, evidenceTasks: [], orders: [], activePlays: [], pendingReviews: [], monitoringFindings: [],
    checks: { state: name.includes("partial") || name === "Partial dispatch" ? "partial" : "complete", asOf: now, monitoring: "on_demand" },
  };
  if (name === "Partial dispatch" || name === "Retrying partial") input.orders = [
    { id: 8, runId: 3, candidateId: 9, symbol: "TEST", status: "submitted", qty: 3, filledQty: 1, brokerOrderId: null, updatedAt: now },
  ];
  for (const key of names) records[key] = { data: null, isLoading: false, isFetching: false, error: null, refetch: () => { receipts.statusReads++; if (key === "desk") { records.desk = { ...records.desk, isFetching: true }; notify(); } } };
  records.desk.data = { attention: deriveApertureAttention(input, null) };
  records.account.data = [{ id: 1, label: "Illustrative UAT paper account", isPaper: true, brokerId: "manual", lastSyncedAt: now }];
  records.thesis.data = { thesis: { name: "Illustrative saved belief" } };
  records.plays.data = { plays: [], inMotionPlayCount: 0, expiredPlayCount: 0 };
  if (name === "Cold loading") for (const key of ["desk", "account", "thesis", "plays"] as const) Object.assign(records[key], { data: undefined, isLoading: true, isFetching: true });
  if (name === "Research loading") Object.assign(records.plays, { data: undefined, isLoading: true, isFetching: true });
  if (name === "Retrying partial") Object.assign(records.desk, { isFetching: true, error: { message: "INTERNAL_ERROR_NOT_FOR_UI" } });
  if (name === "Failed refresh") records.desk.error = { message: "INTERNAL_ERROR_NOT_FOR_UI" };
  notify();
}
export function completeRefresh() { records.desk = { ...records.desk, isFetching: false, error: null }; notify(); }
setScenario("Quiet");
const useQuery = (key: typeof names[number]) => { useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => version); return records[key]; };
const forbidden = () => { receipts.lifecycleMutations++; throw new Error("Lifecycle mutation is forbidden in this renderer fixture"); };
const mutation = { useMutation: () => ({ mutate: forbidden, isPending: false }) };
export const trpc = {
  aperture: {
    account: { list: { useQuery: () => useQuery("account") } }, cockpit: { useQuery: () => useQuery("cockpit") },
    desk: { summary: { useQuery: () => useQuery("desk") }, markSeen: { useMutation: () => ({ mutate: (_: unknown, callbacks: any) => { receipts.seenWrites++; callbacks?.onSuccess?.(); callbacks?.onSettled?.(); } }) } },
    play: { list: { useQuery: () => useQuery("plays") }, trigger: { useQuery: () => useQuery("trigger") }, decide: mutation },
    runway: { latest: { useQuery: () => useQuery("runway") } }, ledger: { captureCurrentWindow: mutation },
  },
  thesis: { activeCapital: { useQuery: () => useQuery("thesis") } },
  useUtils: () => ({ aperture: { play: { list: { invalidate: forbidden } }, ledger: { list: { invalidate: forbidden } } } }),
};
