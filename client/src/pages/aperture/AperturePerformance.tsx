import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import ApertureShell from "@/components/aperture/ApertureShell";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";
import { QuickPlayPerformance, StrategistPerformance } from "@/components/aperture/PerformanceView";

/** Performance: saved syncs and recorded fills for one account at a time. Read-only. */
export default function AperturePerformance() {
  const { isGuided } = useExperienceMode();
  const { data: accounts, isLoading: loadingAccounts, isError: accountsFailed } = trpc.aperture.account.list.useQuery();
  const [picked, setPicked] = useState<number | null>(null);
  const accountId = useMemo(() => {
    if (!accounts?.length) return null;
    if (picked != null && accounts.some((a) => a.id === picked)) return picked;
    return (accounts.find((a) => a.lastSyncedAt != null) ?? accounts[0]).id;
  }, [accounts, picked]);
  const { data, isLoading, isError, refetch } = trpc.aperture.performance.overview.useQuery(
    { accountId: accountId ?? 0 },
    { enabled: accountId != null },
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (data) setNow(Date.now()); }, [data]);

  return (
    <ApertureShell>
      {accounts && accounts.length > 1 ? (
        <label className="perf-picker">Account
          <select value={accountId ?? ""} onChange={(e) => setPicked(Number(e.target.value))}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
      ) : null}
      {loadingAccounts || (accountId != null && isLoading) ? (
        <p className="perf-empty"><Loader2 className="inline h-4 w-4 animate-spin" aria-hidden="true" /> Loading your results…</p>
      ) : accountsFailed || isError ? (
        <p className="perf-empty">Your results could not be loaded. <button type="button" className="underline" onClick={() => refetch()}>Try again</button></p>
      ) : accountId == null ? (
        <p className="perf-empty">Add a practice account on the Portfolio tab to see results here.</p>
      ) : data ? (
        isGuided ? <QuickPlayPerformance data={data} now={now} /> : <StrategistPerformance data={data} now={now} />
      ) : null}
    </ApertureShell>
  );
}
