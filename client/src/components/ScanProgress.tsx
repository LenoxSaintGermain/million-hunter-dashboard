import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Loader2, XCircle, Database, Filter,
  Cpu, PackageCheck, AlertTriangle, TrendingUp, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcquisitionThesisComparison } from "./AcquisitionThesisComparison";
import { AcquisitionV2Report } from "./AcquisitionV2Report";

// ─── Phase definitions ────────────────────────────────────────────────────────
const PHASES = [
  { key: "Initializing scan engine",   icon: Database,    label: "Connect",  desc: "Connecting to marketplaces" },
  { key: "Scanning marketplaces",      icon: Database,    label: "Scan",     desc: "Fetching listings" },
  { key: "Extracting deal data",       icon: Database,    label: "Extract",  desc: "Parsing deal data" },
  { key: "Applying filters",           icon: Filter,      label: "Filter",   desc: "Applying criteria" },
  { key: "AI scoring",                 icon: Cpu,         label: "Score",    desc: "Validation scoring" },
  { key: "Finalizing results",         icon: PackageCheck,label: "Finalize", desc: "Populating queue" },
  { key: "Scan complete",              icon: CheckCircle2,label: "Done",     desc: "Complete" },
];

function getPhaseIndex(currentPhase: string | null | undefined): number {
  if (!currentPhase) return 0;
  if (currentPhase === "Scoring candidates") return PHASES.findIndex(p => p.key === "AI scoring");
  const idx = PHASES.findIndex((p) => p.key === currentPhase);
  return idx >= 0 ? idx : 0;
}

interface ScanProgressProps {
  jobId: number;
  onComplete?: () => void;
  onRetry?: () => void;
  className?: string;
}

/** True when the server says this search does not exist for the signed-in user. */
export function isScanNotFoundError(error: unknown): boolean {
  const e = error as { data?: { code?: string; httpStatus?: number } } | null | undefined;
  return e?.data?.code === "NOT_FOUND" || e?.data?.httpStatus === 404;
}

export const scanStatusQueryOptions = (done: boolean) => ({
  // Stop polling once the search is finished or the server says it does not exist.
  refetchInterval: (query: { state: { error: unknown } }) =>
    done || isScanNotFoundError(query.state.error) ? false : 1200,
  refetchIntervalInBackground: true,
  retry: (failureCount: number, error: unknown) => !isScanNotFoundError(error) && failureCount < 3,
});

export default function ScanProgress({ jobId, onComplete, onRetry, className }: ScanProgressProps) {
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Poll every 1.2 seconds while running
  const { data: job, isLoading, isError, error, refetch } = trpc.scan.getStatus.useQuery(
    { jobId },
    scanStatusQueryOptions(done) as any,
  );
  const notFound = isScanNotFoundError(error);

  useEffect(() => { setDone(false); }, [jobId]);

  useEffect(() => {
    if ((job?.status === "completed" || job?.status === "failed") && !done) {
      setDone(true);
      if (job.status === "completed") onCompleteRef.current?.();
    }
  }, [job?.status, done]);

  if (notFound && !job) return (
    <div role="alert" className={className}>
      <p>Search status unavailable. This search is not on your account, so there is nothing to follow here. Start a new search from your thesis if you still need one.</p>
      <Button variant="outline" onClick={() => refetch()}>Reload search status</Button>
    </div>
  );
  if (isError && !job) return (
    <div role="alert" className={className}>
      <p>Search status unavailable. The search may still be running; do not start a duplicate.</p>
      <Button variant="outline" onClick={() => refetch()}>Reload search status</Button>
    </div>
  );
  if (isLoading || !job) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Connecting to scan engine…
      </div>
    );
  }

  const isFailed = job.status === "failed";
  const isComplete = job.status === "completed";
  // This persisted marker identifies V2 jobs even after screening completes.
  // dealsScored belongs to the legacy shared catalog, not the V2 receipt.
  const isV2 = Array.isArray(job.sources) && job.sources.includes("__acquisition_v2_pending__");
  const isRunning = job.status === "running" || job.status === "pending";
  const phaseIdx = getPhaseIndex(job.currentPhase);
  const pct = job.progressPct ?? 0;
  const elapsed = job.startedAt
    ? Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000)
    : 0;

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {isError && <p role="alert">Status refresh failed. Showing the last recorded result.</p>}
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between border-b border-border/50",
        isComplete ? "bg-emerald-500/5" : isFailed ? "bg-red-500/5" : "bg-primary/5"
      )}>
        <div className="flex items-center gap-2.5">
          {isFailed ? (
            <XCircle className="w-4 h-4 text-[var(--clay)] shrink-0" />
          ) : isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-[var(--sage)] shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          )}
          <div>
            <p className="text-xs font-semibold text-foreground">
              {isFailed ? "Scan Failed" : isComplete ? "Scan Complete" : "Market Scan Running"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isFailed
                ? "Search could not finish. Any saved results are incomplete; this is not a no-opportunity conclusion."
                : isComplete
                ? isV2
                  ? `${job.listingsFound ?? "Not recorded"} source records · ${job.listingsQualified ?? "Not recorded"} screening candidates · V2 receipt`
                  : `${job.listingsFound ?? 0} listings found · ${job.listingsQualified ?? 0} qualified · ${job.dealsScored ?? 0} scored`
                : job.phaseDetail ?? "Initializing…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{elapsed}s</span>
          )}
          {isFailed && onRetry && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRetry}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="h-1 bg-muted/30 w-full">
          <div
            className={cn(
              "h-full transition-all duration-700 ease-out",
              isComplete ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Phase steps */}
      {!isComplete && <div className="px-4 py-3">
        <div className="flex items-center gap-0">
          {PHASES.slice(0, -1).map((phase, i) => {
            const isActive = i === phaseIdx && isRunning;
            const isPast = i < phaseIdx || isComplete;
            const Icon = phase.icon;
            const isLast = i === PHASES.length - 2;

            return (
              <div key={phase.key} className="flex items-center flex-1 min-w-0">
                {/* Step dot */}
                <div className="flex flex-col items-center shrink-0">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300",
                    isActive ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-card" :
                    isPast ? "bg-emerald-500/20 text-[var(--sage)]" :
                    "bg-muted/40 text-muted-foreground/40"
                  )}>
                    {isActive ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isPast ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Icon className="w-3 h-3" />
                    )}
                  </div>
                  <span className={cn(
                    "text-[9px] mt-1 font-medium text-center leading-tight",
                    isActive ? "text-primary" :
                    isPast ? "text-[var(--sage)]" :
                    "text-muted-foreground/40"
                  )}>
                    {phase.label}
                  </span>
                </div>
                {/* Connector line */}
                {!isLast && (
                  <div className={cn(
                    "flex-1 h-px mx-1 mb-4 transition-all duration-500",
                    isPast ? "bg-emerald-500/40" : "bg-border/40"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>}

      {/* Results summary (shown on complete) */}
      {isComplete && (
        <details className="px-4 py-2">
          <summary className="min-h-11 cursor-pointer py-3 text-sm">{isV2 ? `Source-screening receipt · ${job.listingsFound ?? "Not recorded"} source records / ${job.listingsQualified ?? "Not recorded"} screening candidates` : `Search receipt · ${job.listingsFound ?? 0} found / ${job.dealsScored ?? 0} scored`}</summary>
          <div className={cn("rounded-lg bg-muted/20 border border-border/40 p-3 grid gap-3", isV2 ? "grid-cols-2" : "grid-cols-3")}>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{job.listingsFound ?? (isV2 ? "Not recorded" : 0)}</p>
              <p className="text-[10px] text-muted-foreground">{isV2 ? "Source records" : "Listings Found"}</p>
            </div>
            <div className="text-center border-x border-border/30">
              <p className="text-lg font-bold text-[var(--amber)] tabular-nums">{job.listingsQualified ?? (isV2 ? "Not recorded" : 0)}</p>
              <p className="text-[10px] text-muted-foreground">{isV2 ? "Screening candidates" : "Qualified"}</p>
            </div>
            {!isV2 && <div className="text-center">
              <p className="text-lg font-bold text-[var(--sage)] tabular-nums">{job.dealsScored ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Scored</p>
            </div>}
          </div>
          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[var(--sage)]" />
            {isV2
              ? "Source screening is complete. Review the V2 receipt for candidate outcomes, unavailable checks and unverified source claims. No shared catalog scores changed."
              : (job.dealsScored ?? 0) > 0
              ? "Scored listings are available in the validation queue. Verify source claims before proceeding."
              : "No candidates were added in this search. Review the saved criteria and any screening reasons before searching again."}
          </p>
          {job.phaseDetail && <p className="text-sm text-muted-foreground mt-2">{job.phaseDetail}</p>}
        </details>
      )}

      {isComplete && <AcquisitionThesisComparison jobId={jobId} />}
      {isFailed && <AcquisitionV2Report jobId={jobId} />}

      {/* Error detail */}
      {isFailed && (
        <div className="px-4 pb-4 pt-0">
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--clay)] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--clay)]">Pipeline error</p>
              <p className="text-sm text-muted-foreground mt-0.5">Search could not finish. Review your saved criteria before starting another search. Any already-saved results remain available.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
