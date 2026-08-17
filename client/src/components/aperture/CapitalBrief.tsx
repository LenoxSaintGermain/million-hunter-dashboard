import { ArrowRight, Compass, Eye, Layers3, ShieldAlert, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { friendlyExposureTheme } from "@shared/exposureThemes";

export type CapitalBriefData = {
  horizon: { label: string; specified: boolean; guidance: string };
  thesis: { belief: string | null; seek: string[]; avoid: string[] };
  portfolioContext: {
    deployableCapitalCents: number;
    hurdleRateBps: number | null;
    intendedTradeCount: number;
    uncoveredNodes: string[];
    coveredNodeCount: number;
  };
  evidence: {
    candidateCount: number;
    researchPriorityCount: number;
    memoReadyCount: number;
    verificationCount: number;
    lowConfidenceCount: number;
    decisionCriticalCheckCount: number;
    researchFollowUpCheckCount: number;
    researchReady: boolean;
    paperOrderEligible: boolean;
  };
  nextDecision: {
    stage: "set_horizon" | "validate_evidence" | "compare_postures" | "review_memo" | "monitor";
    title: string;
    detail: string;
    primaryCandidateId: number | null;
  };
  recommendedResearchPosture: { strategyId: number | null; label: string; rationale: string } | null;
  priorityCandidate: { id: number; symbol: string; role: string; confidenceScore: number; verifyCount: number } | null;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function CapitalBrief({
  brief,
  onReviewEvidence,
  onComparePostures,
  onReviewGaps,
  onSetHorizon,
}: {
  brief: CapitalBriefData;
  onReviewEvidence: () => void;
  onComparePostures: () => void;
  onReviewGaps: () => void;
  onSetHorizon: () => void;
}) {
  const gapLabels = brief.portfolioContext.uncoveredNodes.map((path) => friendlyExposureTheme(path).theme);
  const primaryAction = brief.nextDecision.stage === "set_horizon"
    ? { label: "Set thesis horizon", action: onSetHorizon }
    : brief.nextDecision.stage === "compare_postures"
      ? { label: "Compare research postures", action: onComparePostures }
      : { label: "Review evidence queue", action: onReviewEvidence };

  return (
    <section className="overflow-hidden rounded-[1.25rem] border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
      <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--sh-signal)" }}>
            <Compass className="h-3.5 w-3.5" /> Capital brief · decision framing
          </div>
          <h2 className="mt-3 max-w-3xl font-serif text-2xl leading-tight sm:text-3xl" style={{ color: "var(--sh-text-primary)" }}>
            {brief.nextDecision.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: "var(--sh-text-secondary)" }}>
            {brief.nextDecision.detail}
          </p>
          {brief.thesis.belief && (
            <div className="mt-5 border-l-2 pl-4 text-sm leading-6" style={{ borderColor: "var(--sh-signal)", color: "var(--sh-text-secondary)" }}>
              <span className="mr-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Thesis</span>
              {brief.thesis.belief}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button size="sm" onClick={primaryAction.action}>
              {primaryAction.label} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onReviewGaps}>
              <Layers3 className="mr-1.5 h-3.5 w-3.5" /> See portfolio gaps
            </Button>
          </div>
        </div>

        <div className="grid content-center gap-4 border-t p-5 sm:p-7 lg:border-l lg:border-t-0" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
          <BriefMetric label="Research horizon" value={brief.horizon.label} note={brief.horizon.guidance} icon={<Target className="h-4 w-4" />} />
          <BriefMetric
            label="Portfolio question"
            value={brief.portfolioContext.uncoveredNodes.length ? `${brief.portfolioContext.uncoveredNodes.length} exposure theme${brief.portfolioContext.uncoveredNodes.length === 1 ? "" : "s"} to examine` : "Coverage mapped"}
            note={brief.portfolioContext.uncoveredNodes.length ? gapLabels.slice(0, 2).join(" · ") : `${brief.portfolioContext.coveredNodeCount} thesis node(s) already represented`}
            icon={<Layers3 className="h-4 w-4" />}
          />
          <BriefMetric
            label="Evidence posture"
            value={brief.evidence.decisionCriticalCheckCount ? `${brief.evidence.decisionCriticalCheckCount} decision-critical check${brief.evidence.decisionCriticalCheckCount === 1 ? "" : "s"}` : brief.evidence.paperOrderEligible ? "Research gate cleared" : "Memo review remains"}
            note={`${brief.evidence.researchFollowUpCheckCount} supporting check${brief.evidence.researchFollowUpCheckCount === 1 ? "" : "s"} can continue in parallel · ${brief.evidence.memoReadyCount} fact-traced memo${brief.evidence.memoReadyCount === 1 ? "" : "s"} ready`}
            icon={<ShieldAlert className="h-4 w-4" />}
          />
        </div>
      </div>

      {brief.recommendedResearchPosture && (
        <div className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7" style={{ borderColor: "var(--sh-border-1)" }}>
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-fg-muted)" }}>Research posture to compare</p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>{brief.recommendedResearchPosture.label}</p>
            <p className="mt-1 max-w-3xl text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{brief.recommendedResearchPosture.rationale}</p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onComparePostures}>
            Compare postures <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </section>
  );
}

function BriefMetric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--sh-surface-3)", color: "var(--sh-signal)" }}>{icon}</div>
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p>
        <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>{value}</p>
        <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{note}</p>
      </div>
    </div>
  );
}
