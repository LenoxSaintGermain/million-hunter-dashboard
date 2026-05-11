/**
 * AgentMonitoringPanel.tsx
 *
 * The "Agent Monitoring Panel" from the Signal Hunter Editorial Edition.
 * Shows live orchestration status across Claude, Gemini, and Sonar.
 * Displays the latest run results for each analysis type.
 * Allows triggering new runs.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type AnalysisType = "consensus" | "behavioral" | "redteam" | "capital_stack" | "digital_alpha";

const ANALYSIS_TYPES: { id: AnalysisType; label: string; icon: string; description: string }[] = [
  { id: "consensus", label: "IC Consensus", icon: "how_to_vote", description: "3-model investment committee vote" },
  { id: "behavioral", label: "Owner Profile", icon: "psychology", description: "Negotiation playbook & psychology" },
  { id: "redteam", label: "Red Team", icon: "security", description: "Devil's advocate risk analysis" },
  { id: "capital_stack", label: "Capital Stack", icon: "account_balance", description: "SBA structure optimization" },
  { id: "digital_alpha", label: "Digital Alpha", icon: "bolt", description: "AI leverage & tech audit" },
];

const MODEL_LABELS = [
  { key: "claudeOutput", label: "Claude", color: "text-amber-600" },
  { key: "geminiOutput", label: "Gemini", color: "text-blue-600" },
  { key: "sonarOutput", label: "Sonar", color: "text-purple-600" },
];

function VerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict) return null;
  const map: Record<string, string> = {
    GO: "bg-emerald-50 text-emerald-700 border-emerald-200",
    HOLD: "bg-amber-50 text-amber-700 border-amber-200",
    PASS: "bg-red-50 text-red-700 border-red-200",
    BANKABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CONDITIONAL: "bg-amber-50 text-amber-700 border-amber-200",
    UNBANKABLE: "bg-red-50 text-red-700 border-red-200",
    HIGH_ALPHA: "bg-blue-50 text-blue-700 border-blue-200",
    MODERATE_ALPHA: "bg-sky-50 text-sky-700 border-sky-200",
    LOW_ALPHA: "bg-slate-50 text-slate-600 border-slate-200",
    ANALYZED: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", map[verdict] ?? "bg-slate-50 text-slate-600 border-slate-200")}>
      {verdict.replace(/_/g, " ")}
    </span>
  );
}

function RunCard({ run, isActive }: { run: any; isActive: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const consensus = run.consensus as any;
  const behavioral = run.behavioralProfile as any;
  const redTeam = run.redTeamAnalysis as any;
  const digital = run.digitalAlpha as any;
  const claude = run.claudeOutput as any;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border rounded-lg overflow-hidden transition-all",
        isActive ? "border-[#ffba20]/40 bg-[#fffdf7]" : "border-[#e8e0d4] bg-white"
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#f9f5ef] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[18px] text-[#8b7355]">
            {ANALYSIS_TYPES.find(t => t.id === run.analysisType)?.icon ?? "analytics"}
          </span>
          <div>
            <div className="text-sm font-medium text-[#1a1208]">
              {ANALYSIS_TYPES.find(t => t.id === run.analysisType)?.label ?? run.analysisType}
            </div>
            <div className="text-xs text-[#8b7355]">
              {run.completedAt
                ? new Date(run.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                : "In progress..."}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {run.status === "running" && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <span className="animate-pulse">●</span> Running
            </span>
          )}
          {run.status === "complete" && (
            <>
              {consensus && <VerdictBadge verdict={consensus.verdict} />}
              {!consensus && claude && <VerdictBadge verdict={claude.verdict} />}
            </>
          )}
          {run.status === "failed" && (
            <span className="text-xs text-red-600">Failed</span>
          )}
          <span className="material-symbols-outlined text-[16px] text-[#8b7355] transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
            expand_more
          </span>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && run.status === "complete" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-[#e8e0d4]">

              {/* Consensus summary */}
              {consensus && (
                <div className="pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#8b7355] uppercase tracking-wider">Consensus</span>
                    {consensus.divergence && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        Models diverged
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#3d2e1e] leading-relaxed">{consensus.summary}</p>
                  {consensus.actionItem && (
                    <div className="mt-2 p-2 bg-[#f9f5ef] rounded border border-[#e8e0d4]">
                      <span className="text-xs font-medium text-[#8b7355]">Next Action: </span>
                      <span className="text-xs text-[#3d2e1e]">{consensus.actionItem}</span>
                    </div>
                  )}
                  {/* Model votes */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {MODEL_LABELS.map(({ key, label, color }) => {
                      const output = run[key] as any;
                      if (!output) return null;
                      return (
                        <div key={key} className="text-center p-2 bg-white border border-[#e8e0d4] rounded">
                          <div className={cn("text-xs font-medium mb-1", color)}>{label}</div>
                          <VerdictBadge verdict={output.verdict} />
                          {output.confidence != null && (
                            <div className="text-xs text-[#8b7355] mt-1">{(output.confidence * 100).toFixed(0)}%</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Behavioral profile */}
              {behavioral && (
                <div className="pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#8b7355] uppercase tracking-wider">Owner Archetype</span>
                    <span className="text-xs font-semibold text-[#1a1208]">{behavioral.ownerArchetype}</span>
                  </div>
                  {behavioral.openingMove && (
                    <div className="p-2 bg-[#f9f5ef] rounded border border-[#e8e0d4]">
                      <span className="text-xs font-medium text-[#8b7355]">Opening Move: </span>
                      <span className="text-xs text-[#3d2e1e]">{behavioral.openingMove}</span>
                    </div>
                  )}
                  {behavioral.frictionPoints?.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-[#8b7355] mb-1">Friction Points</div>
                      <ul className="space-y-1">
                        {behavioral.frictionPoints.slice(0, 2).map((fp: string, i: number) => (
                          <li key={i} className="text-xs text-[#3d2e1e] flex items-start gap-1">
                            <span className="text-amber-500 mt-0.5">—</span> {fp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Red team */}
              {redTeam && (
                <div className="pt-3 space-y-2">
                  {redTeam.dealBreakers?.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-red-600 mb-1">Deal Breakers</div>
                      <ul className="space-y-1">
                        {redTeam.dealBreakers.slice(0, 2).map((db: string, i: number) => (
                          <li key={i} className="text-xs text-[#3d2e1e] flex items-start gap-1">
                            <span className="text-red-500 mt-0.5">✕</span> {db}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {redTeam.worstCaseScenario && (
                    <div className="p-2 bg-red-50 rounded border border-red-100">
                      <span className="text-xs font-medium text-red-700">Worst Case: </span>
                      <span className="text-xs text-red-800">{redTeam.worstCaseScenario}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Digital alpha */}
              {digital && (
                <div className="pt-3 space-y-2">
                  {digital.quickWins?.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-blue-700 mb-1">90-Day Quick Wins</div>
                      <ul className="space-y-1">
                        {digital.quickWins.slice(0, 3).map((qw: string, i: number) => (
                          <li key={i} className="text-xs text-[#3d2e1e] flex items-start gap-1">
                            <span className="text-blue-500 mt-0.5">→</span> {qw}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {digital.estimatedEfficiencyGain && (
                    <div className="text-xs text-[#8b7355]">
                      Estimated efficiency gain: <span className="font-semibold text-blue-700">{digital.estimatedEfficiencyGain}</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface AgentMonitoringPanelProps {
  dealId: number;
}

export default function AgentMonitoringPanel({ dealId }: AgentMonitoringPanelProps) {
  const { toast } = useToast();
  const [activeRun, setActiveRun] = useState<AnalysisType | null>(null);

  const { data: latestRuns, refetch, isLoading } = trpc.agent.getLatestRuns.useQuery(
    { dealId },
    { refetchInterval: activeRun ? 3000 : false }
  );

  const triggerRun = trpc.agent.triggerRun.useMutation({
    onSuccess: (data) => {
      toast({ title: "Analysis started", description: "Results will appear when complete." });
      setActiveRun(null);
      refetch();
    },
    onError: (err) => {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
      setActiveRun(null);
    },
  });

  const handleTrigger = (type: AnalysisType) => {
    setActiveRun(type);
    triggerRun.mutate({ dealId, analysisType: type });
  };

  const runsByType = new Map<string, any>();
  for (const run of latestRuns ?? []) {
    runsByType.set(run.analysisType, run);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-[#8b7355] uppercase tracking-wider mb-0.5">Agent Orchestration</div>
          <div className="text-sm font-semibold text-[#1a1208]">Analysis Runs</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            activeRun || triggerRun.isPending ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
          )} />
          <span className="text-xs text-[#8b7355]">
            {activeRun || triggerRun.isPending ? "Running" : "Ready"}
          </span>
        </div>
      </div>

      {/* Model status strip */}
      <div className="grid grid-cols-3 gap-2">
        {MODEL_LABELS.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-[#e8e0d4] rounded text-xs">
            <span className={cn("w-1.5 h-1.5 rounded-full", activeRun ? "animate-pulse bg-amber-400" : "bg-emerald-400")} />
            <span className={cn("font-medium", color)}>{label}</span>
          </div>
        ))}
      </div>

      {/* Trigger buttons */}
      <div className="grid grid-cols-1 gap-1.5">
        {ANALYSIS_TYPES.map((type) => {
          const existing = runsByType.get(type.id);
          const isRunning = activeRun === type.id || existing?.status === "running";
          return (
            <button
              key={type.id}
              onClick={() => handleTrigger(type.id)}
              disabled={triggerRun.isPending}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded border text-left transition-all",
                "hover:border-[#ffba20] hover:bg-[#fffdf7]",
                isRunning ? "border-amber-300 bg-amber-50" : "border-[#e8e0d4] bg-white",
                triggerRun.isPending && "opacity-60 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#8b7355]">{type.icon}</span>
                <div>
                  <div className="text-xs font-medium text-[#1a1208]">{type.label}</div>
                  <div className="text-[11px] text-[#8b7355]">{type.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {existing?.status === "complete" && (
                  <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                )}
                {isRunning && (
                  <span className="text-[11px] text-amber-600 animate-pulse">●</span>
                )}
                <span className="material-symbols-outlined text-[14px] text-[#c4b49a]">play_arrow</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-xs text-[#8b7355] text-center py-4">Loading runs...</div>
      ) : latestRuns && latestRuns.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[#8b7355] uppercase tracking-wider">Latest Results</div>
          {latestRuns.map((run) => (
            <RunCard key={run.id} run={run} isActive={run.analysisType === activeRun} />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-[#e8e0d4] rounded-lg">
          <span className="material-symbols-outlined text-[32px] text-[#c4b49a] block mb-2">smart_toy</span>
          <div className="text-sm text-[#8b7355]">No analysis runs yet</div>
          <div className="text-xs text-[#c4b49a] mt-1">Trigger an analysis above to begin</div>
        </div>
      )}
    </div>
  );
}
