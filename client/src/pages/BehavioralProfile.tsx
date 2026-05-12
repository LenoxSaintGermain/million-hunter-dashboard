/**
 * BehavioralProfile.tsx
 *
 * Owner Behavioral Profile — Signal Hunter Editorial Edition.
 * Features:
 * - Agentic Insight card (Fraunces 32px headline, model attribution)
 * - Negotiation Rehearsal scenarios
 * - Owner psychology deep-dive
 * - Framer Motion blur-fade entrance animations
 */

import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowLeft, Building2, Brain, AlertTriangle, CheckCircle2, MessageSquare, Target, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const fadeUp = { initial: { opacity: 0, y: 12, filter: "blur(4px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.4 } };
const fadeUpDelay = (d: number) => ({ initial: { opacity: 0, y: 12, filter: "blur(4px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.4, delay: d } });

function AgenticInsightCard({ title, insight, model, type = "insight" }: {
  title: string;
  insight: string;
  model?: string;
  type?: "insight" | "warning" | "friction";
}) {
  const styles = {
    insight: { border: "border-[#ffba20]/30", bg: "bg-[#fffdf7]", accent: "text-[#ffba20]", icon: "lightbulb" },
    warning: { border: "border-amber-300/50", bg: "bg-amber-50", accent: "text-amber-600", icon: "warning" },
    friction: { border: "border-red-200", bg: "bg-red-50", accent: "text-red-600", icon: "block" },
  };
  const s = styles[type];
  return (
    <div className={cn("border rounded-xl p-5 space-y-3", s.border, s.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("material-symbols-outlined text-[18px]", s.accent)}>{s.icon}</span>
          <h3 className="text-sm font-semibold text-[#1a1208]" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
            {title}
          </h3>
        </div>
        {model && (
          <span className="text-[10px] font-mono text-[#8b7355] bg-white border border-[#e8e0d4] px-2 py-0.5 rounded shrink-0">
            {model}
          </span>
        )}
      </div>
      <p className="text-sm text-[#3d2e1e] leading-relaxed">{insight}</p>
    </div>
  );
}

function NegotiationScenario({ scenario, index }: { scenario: any; index: number }) {
  return (
    <motion.div
      {...fadeUpDelay(index * 0.1)}
      className="border border-[#e8e0d4] rounded-xl overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-[#faf7f2] border-b border-[#e8e0d4]">
        <div className="w-6 h-6 rounded-full bg-[#1a1208] text-white flex items-center justify-center text-xs font-bold">
          {index + 1}
        </div>
        <span className="text-sm font-semibold text-[#1a1208]">{scenario.title ?? `Scenario ${index + 1}`}</span>
        {scenario.risk && (
          <span className={cn(
            "ml-auto text-xs font-medium px-2 py-0.5 rounded",
            scenario.risk === "high" ? "bg-red-100 text-red-700" :
            scenario.risk === "medium" ? "bg-amber-100 text-amber-700" :
            "bg-emerald-100 text-emerald-700"
          )}>
            {scenario.risk} risk
          </span>
        )}
      </div>
      <div className="p-4 space-y-3">
        {scenario.ownerMove && (
          <div className="flex gap-3">
            <div className="w-16 shrink-0">
              <span className="text-xs font-medium text-[#8b7355] uppercase tracking-wider">Owner</span>
            </div>
            <div className="flex-1 p-2.5 bg-[#f9f5ef] border border-[#e8e0d4] rounded-lg">
              <p className="text-xs text-[#3d2e1e] italic">"{scenario.ownerMove}"</p>
            </div>
          </div>
        )}
        {scenario.yourResponse && (
          <div className="flex gap-3">
            <div className="w-16 shrink-0">
              <span className="text-xs font-medium text-[#ffba20] uppercase tracking-wider">You</span>
            </div>
            <div className="flex-1 p-2.5 bg-white border border-[#ffba20]/30 rounded-lg">
              <p className="text-xs text-[#1a1208]">"{scenario.yourResponse}"</p>
            </div>
          </div>
        )}
        {scenario.rationale && (
          <p className="text-xs text-[#8b7355] leading-relaxed pl-[76px]">{scenario.rationale}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function BehavioralProfile() {
  const params = useParams<{ id: string }>();
  const dealId = Number(params.id);
  const { toast } = useToast();

  const { data, isLoading, refetch } = trpc.deals.getById.useQuery({ id: dealId });

  const analyzeSignals = trpc.signals.analyze.useMutation({
    onSuccess: () => { toast({ title: "Behavioral analysis complete" }); refetch(); },
    onError: (e) => toast({ title: "Analysis failed", description: e.message, variant: "destructive" }),
  });

  const runBehavioral = trpc.agent.triggerRun.useMutation({
    onSuccess: () => { toast({ title: "Deep behavioral analysis started" }); refetch(); },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const { data: agentRuns } = trpc.agent.getLatestRuns.useQuery({ dealId }, { enabled: !!dealId });
  const behavioralRun = agentRuns?.find(r => r.analysisType === "behavioral" && r.status === "complete");
  const behavioral = behavioralRun?.behavioralProfile as any;

  const toNum = (v: any) => v == null ? null : parseFloat(String(v));
  const pct = (n: any) => { const v = toNum(n); return v == null ? "—" : `${Math.round(v * 100)}%`; };

  if (isLoading) {
    return (
      <EditorialTopNav>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </EditorialTopNav>
    );
  }

  if (!data) {
    return (
      <EditorialTopNav>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Deal not found</p>
          <Link href="/scan">
            <Button variant="outline" size="sm" className="mt-4">
              <ArrowLeft className="w-3 h-3 mr-1.5" /> Back to Scan
            </Button>
          </Link>
        </div>
      </EditorialTopNav>
    );
  }

  const { deal, signal } = data;

  // Parse negotiation scenarios from signal or behavioral run
  let scenarios: any[] = [];
  if ((signal as any)?.negotiationScenarios) {
    try { scenarios = JSON.parse(String((signal as any).negotiationScenarios)); } catch { scenarios = []; }
  }
  if (behavioral?.negotiationScenarios?.length > 0) {
    scenarios = behavioral.negotiationScenarios;
  }

  return (
    <EditorialTopNav>
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/deal/${dealId}`}>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-[#8b7355] hover:text-[#1a1208] -ml-2">
            <ArrowLeft className="w-3 h-3 mr-1.5" />
            Back to Dossier
          </Button>
        </Link>
        <span className="text-[#c4b49a] text-xs">·</span>
        <span className="text-xs font-medium text-[#8b7355] uppercase tracking-wider">Behavioral Profile</span>
      </div>

      {/* Article header */}
      <motion.div {...fadeUp} className="mb-8">
        <div className="text-xs font-mono font-bold text-[#ffba20] uppercase tracking-widest mb-3">
          Owner Psychology · Negotiation Intelligence
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-normal text-[#1a1208] leading-tight mb-3" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
          {deal.name}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          {deal.industry && <span className="text-sm text-[#8b7355]">{deal.industry}</span>}
          {deal.location && (
            <>
              <span className="text-[#c4b49a]">·</span>
              <span className="text-sm text-[#8b7355]">{deal.location}</span>
            </>
          )}
        </div>
        <div className="mt-4 h-px bg-gradient-to-r from-[#ffba20]/40 via-[#e8e0d4] to-transparent" />
      </motion.div>

      {/* Main grid */}
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">

        {/* Left: Behavioral intelligence */}
        <div className="space-y-8">

          {/* Agentic Insight card — main feature */}
          {signal?.ownerProfileSummary ? (
            <motion.div {...fadeUpDelay(0.1)}>
              <AgenticInsightCard
                title="Agentic Friction Detected"
                insight={String(signal.ownerProfileSummary)}
                model="Gemini 3.1 Pro"
                type={signal.ownerDistressScore && toNum(signal.ownerDistressScore)! > 0.6 ? "warning" : "insight"}
              />
            </motion.div>
          ) : behavioral?.ownerArchetype ? (
            <motion.div {...fadeUpDelay(0.1)}>
              <AgenticInsightCard
                title={`Owner Archetype: ${behavioral.ownerArchetype}`}
                insight={behavioral.openingMove ?? "Deep behavioral analysis complete. Review negotiation scenarios below."}
                model="Claude 3.7 Sonnet"
                type="insight"
              />
            </motion.div>
          ) : (
            <motion.div {...fadeUpDelay(0.1)}>
              <div className="border border-dashed border-[#e8e0d4] rounded-xl p-8 text-center">
                <Brain className="w-10 h-10 text-[#c4b49a] mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-[#1a1208] mb-1" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                  No Behavioral Analysis Yet
                </h3>
                <p className="text-xs text-[#8b7355] mb-4">Run Third Signal or Deep Behavioral analysis to unlock owner psychology insights.</p>
                <div className="flex gap-2 justify-center">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-[#1a1208] hover:bg-[#2d1f0e] text-white"
                    onClick={() => analyzeSignals.mutate({ dealId })}
                    disabled={analyzeSignals.isPending}
                  >
                    <Brain className="w-3 h-3 mr-1.5" />
                    {analyzeSignals.isPending ? "Analyzing..." : "Run Third Signal"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-[#e8e0d4] hover:border-[#ffba20]"
                    onClick={() => runBehavioral.mutate({ dealId, analysisType: "behavioral" })}
                    disabled={runBehavioral.isPending}
                  >
                    {runBehavioral.isPending ? "Running..." : "Deep Analysis"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Psychology metrics */}
          {signal && (
            <motion.div {...fadeUpDelay(0.2)} className="space-y-4">
              <h2 className="text-lg font-semibold text-[#1a1208]" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                Psychology Metrics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Distress Score", value: pct(signal.ownerDistressScore), icon: AlertTriangle, high: toNum(signal.ownerDistressScore) != null && toNum(signal.ownerDistressScore)! > 0.6 },
                  { label: "Retirement Signal", value: signal.ownerRetirementSignal ? "Detected" : "Not Detected", icon: CheckCircle2, high: signal.ownerRetirementSignal ?? false },
                  { label: "Negotiation Style", value: signal.ownerNegotiationStyle ?? "—", icon: MessageSquare, high: false },
                  { label: "Urgency Level", value: (signal as any).ownerUrgencyLevel ? `${(signal as any).ownerUrgencyLevel}/10` : "—", icon: Target, high: (signal as any).ownerUrgencyLevel != null && (signal as any).ownerUrgencyLevel > 6 },
                ].map(({ label, value, icon: Icon, high }) => (
                  <div key={label} className={cn(
                    "p-3 border rounded-lg",
                    high ? "bg-amber-50 border-amber-200" : "bg-[#faf7f2] border-[#e8e0d4]"
                  )}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className={cn("w-3 h-3", high ? "text-amber-600" : "text-[#8b7355]")} />
                      <span className="text-xs font-medium text-[#8b7355] uppercase tracking-wider">{label}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#1a1208] capitalize">{value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Friction points from behavioral run */}
          {behavioral?.frictionPoints?.length > 0 && (
            <motion.div {...fadeUpDelay(0.3)} className="space-y-3">
              <h2 className="text-lg font-semibold text-[#1a1208]" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                Friction Points
              </h2>
              <div className="space-y-2">
                {behavioral.frictionPoints.map((fp: string, i: number) => (
                  <AgenticInsightCard key={i} title={`Friction Point ${i + 1}`} insight={fp} type="friction" />
                ))}
              </div>
            </motion.div>
          )}

          {/* Negotiation Rehearsal */}
          {scenarios.length > 0 ? (
            <motion.div {...fadeUpDelay(0.35)} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#1a1208]" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                  Negotiation Rehearsal
                </h2>
                <span className="text-xs text-[#8b7355]">{scenarios.length} scenarios</span>
              </div>
              <div className="space-y-3">
                {scenarios.map((s, i) => (
                  <NegotiationScenario key={i} scenario={s} index={i} />
                ))}
              </div>
            </motion.div>
          ) : signal && (
            <motion.div {...fadeUpDelay(0.35)}>
              <div className="border border-dashed border-[#e8e0d4] rounded-xl p-6 text-center">
                <MessageSquare className="w-8 h-8 text-[#c4b49a] mx-auto mb-2" />
                <div className="text-sm text-[#8b7355]">No negotiation scenarios yet</div>
                <div className="text-xs text-[#c4b49a] mt-1">Run Deep Behavioral analysis to generate rehearsal scenarios</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-7 text-xs border-[#e8e0d4] hover:border-[#ffba20]"
                  onClick={() => runBehavioral.mutate({ dealId, analysisType: "behavioral" })}
                  disabled={runBehavioral.isPending}
                >
                  {runBehavioral.isPending ? "Running..." : "Generate Scenarios"}
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right aside — quick profile */}
        <div className="space-y-4">
          <motion.div
            {...fadeUpDelay(0.15)}
            className="sticky top-4 space-y-4"
          >
            {/* Owner archetype card */}
            <div className="p-4 bg-[#1a1208] text-white rounded-xl">
              <div className="text-xs font-mono text-[#ffba20] uppercase tracking-wider mb-3">Owner Archetype</div>
              <div className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}>
                {behavioral?.ownerArchetype ?? signal?.ownerNegotiationStyle ?? "Unknown"}
              </div>
              {behavioral?.openingMove && (
                <p className="text-xs text-white/70 leading-relaxed mt-2">{behavioral.openingMove}</p>
              )}
            </div>

            {/* Recommended approach */}
            {(behavioral?.recommendedApproach ?? signal?.ownerProfileSummary) && (
              <div className="p-4 bg-[#faf7f2] border border-[#e8e0d4] rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-3.5 h-3.5 text-[#8b7355]" />
                  <span className="text-xs font-medium text-[#8b7355] uppercase tracking-wider">Recommended Approach</span>
                </div>
                <p className="text-xs text-[#3d2e1e] leading-relaxed">
                  {behavioral?.recommendedApproach ?? String(signal?.ownerProfileSummary ?? "").slice(0, 200)}
                </p>
              </div>
            )}

            {/* Quick links */}
            <div className="p-4 bg-white border border-[#e8e0d4] rounded-xl space-y-2">
              <div className="text-xs font-medium text-[#8b7355] uppercase tracking-wider mb-3">Quick Links</div>
              <Link href={`/deal/${dealId}`}>
                <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs border-[#e8e0d4] text-[#3d2e1e] hover:border-[#ffba20]">
                  <span className="material-symbols-outlined text-[14px] mr-2">description</span>
                  Intelligence Dossier
                </Button>
              </Link>
              <Link href={`/ic-review/${dealId}`}>
                <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs border-[#e8e0d4] text-[#3d2e1e] hover:border-[#ffba20]">
                  <span className="material-symbols-outlined text-[14px] mr-2">how_to_vote</span>
                  IC Review
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </EditorialTopNav>
  );
}
