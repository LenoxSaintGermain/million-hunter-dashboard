import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Loader2, XCircle, Database, Filter,
  Cpu, PackageCheck, AlertTriangle, TrendingUp, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Phase definitions ────────────────────────────────────────────────────────
const PHASES = [
  { key: "Initializing scan engine",   icon: Database,    label: "Connect",  desc: "Connecting to marketplaces" },
  { key: "Scanning marketplaces",      icon: Database,    label: "Scan",     desc: "Fetching listings" },
  { key: "Extracting deal data",       icon: Database,    label: "Extract",  desc: "Parsing deal data" },
  { key: "Applying filters",           icon: Filter,      label: "Filter",   desc: "Applying criteria" },
  { key: "AI scoring",                 icon: Cpu,         label: "Score",    desc: "AI scoring deals" },
  { key: "Finalizing results",         icon: PackageCheck,label: "Finalize", desc: "Building pipeline" },
  { key: "Scan complete",              icon: CheckCircle2,label: "Done",     desc: "Complete" },
];

function getPhaseIndex(currentPhase: string | null | undefined): number {
  if (!currentPhase) return 0;
  const idx = PHASES.findIndex((p) => p.key === currentPhase);
  return idx >= 0 ? idx : 0;
}

interface ScanProgressProps {
  jobId: number;
  onComplete?: () => void;
  onRetry?: () => void;
  className?: string;
}

export default function ScanProgress({ jobId, onComplete, onRetry, className }: ScanProgressProps) {
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Poll every 1.2 seconds while running
  const { data: job, isLoading } = trpc.scan.getStatus.useQuery(
    { jobId },
    {
      refetchInterval: done ? false : 1200,
      refetchIntervalInBackground: true,
    }
  );

  useEffect(() => {
    if (job?.status === "completed" && !done) {
      setDone(true);
      setTimeout(() => onCompleteRef.current?.(), 1800);
    }
  }, [job?.status, done]);

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
  const isRunning = job.status === "running" || job.status === "pending";
  const phaseIdx = getPhaseIndex(job.currentPhase);
  const pct = job.progressPct ?? 0;
  const elapsed = job.startedAt
    ? Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000)
    : 0;

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
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
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isFailed
                ? (job.errorMessage ?? "Unknown error")
                : isComplete
                ? `${job.listingsFound ?? 0} listings found · ${job.listingsQualified ?? 0} qualified · ${job.dealsScored ?? 0} scored`
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
      {!isFailed && (
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
      <div className="px-4 py-3">
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
      </div>

      {/* Results summary (shown on complete) */}
      {isComplete && (
        <div className="px-4 pb-4 pt-0">
          <div className="rounded-lg bg-muted/20 border border-border/40 p-3 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{job.listingsFound ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Listings Found</p>
            </div>
            <div className="text-center border-x border-border/30">
              <p className="text-lg font-bold text-[var(--amber)] tabular-nums">{job.listingsQualified ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Qualified</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--sage)] tabular-nums">{job.dealsScored ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Scored & Added</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[var(--sage)]" />
            Deals are now in your pipeline — check the Command Center
          </p>
        </div>
      )}

      {/* Error detail */}
      {isFailed && (
        <div className="px-4 pb-4 pt-0">
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--clay)] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--clay)]">Pipeline error</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{job.errorMessage ?? "An unexpected error occurred. Please retry."}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
