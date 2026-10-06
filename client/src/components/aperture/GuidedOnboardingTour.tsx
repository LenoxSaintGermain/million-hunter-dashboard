import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Compass, Eye, Shield, Sparkles, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface GuidedOnboardingTourProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  onStartPractice?: () => void;
  onComplete?: () => void;
}

const TOUR_STEPS = [
  {
    step: 1,
    title: "1. Start With an Idea (Not a Guess)",
    badge: "Idea Phase",
    icon: Target,
    lead: "Every trade begins with a dated catalyst — an earnings report, product cycle, or macro shift.",
    description: "Instead of staring at a blank screen, Capital Aperture screens companies against real events so you always know why you are entering and when the premise expires.",
    example: "Example: NVDA Q3 Earnings expected in 14 days with strong data-center demand.",
  },
  {
    step: 2,
    title: "2. Set Your Downside Floor First",
    badge: "Risk Governance",
    icon: Shield,
    lead: "Define the most you are willing to lose before risking a single dollar.",
    description: "Institutional desks never buy without a predetermined exit price. Capital Aperture calculates your exact stop-loss boundary and enforces a maximum loss limit (e.g., $150 max risk).",
    example: "Guardrail: If the stock drops 15%, the system marks the premise invalid. You never take catastrophic losses.",
  },
  {
    step: 3,
    title: "3. Practice Execution With Zero Real Money",
    badge: "Paper Simulation",
    icon: Compass,
    lead: "Send simulated orders to an isolated paper broker.",
    description: "Every ticket goes through pre-flight checks: single-order ceilings, concentration limits, and margin safety. You experience the exact workflow of an institutional fund with zero financial risk.",
    example: "Practice account: $100,000 in paper buying power with real-time quote feeds.",
  },
  {
    step: 4,
    title: "4. Scheduled Checkups (Prevent Bagholding)",
    badge: "Gate Reviews",
    icon: Eye,
    lead: "Automated checkpoints review whether your thesis still holds.",
    description: "Most retail traders lose money because they hold falling stocks hoping they recover. Scheduled 30-day reviews ask: 'Did the catalyst happen?' If no, exit with discipline.",
    example: "Decision Desk: Actionable queues flag when a review is due or when an order is ready to send.",
  },
];

export function GuidedOnboardingTour({ isOpen, open, onClose, onStartPractice, onComplete }: GuidedOnboardingTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const visible = isOpen ?? open ?? false;

  if (!visible) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const IconComponent = currentStep.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guided Onboarding Tour"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-rule bg-surface p-6 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tour"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-ink transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step Indicator Pills */}
        <div className="flex items-center gap-1.5 mb-5">
          {TOUR_STEPS.map((step, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentStepIndex(idx)}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                idx === currentStepIndex
                  ? "bg-amber"
                  : idx < currentStepIndex
                  ? "bg-amber/40"
                  : "bg-surface-2"
              }`}
            />
          ))}
        </div>

        {/* Header with Icon and Badge */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <IconComponent className="h-5 w-5" />
          </div>
          <div>
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
              {currentStep.badge} · {currentStepIndex + 1} of {TOUR_STEPS.length}
            </Badge>
            <h3 className="text-base font-bold text-ink tracking-tight mt-0.5">
              {currentStep.title}
            </h3>
          </div>
        </div>

        {/* Body Content */}
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-ink leading-relaxed">
            {currentStep.lead}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {currentStep.description}
          </p>

          <div className="rounded-lg border border-rule bg-surface-2 p-3 text-xs font-mono text-ink/80">
            {currentStep.example}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-rule">
          {currentStepIndex > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStepIndex((prev) => prev - 1)}
              className="text-xs"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Previous
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {currentStepIndex < TOUR_STEPS.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentStepIndex((prev) => prev + 1)}
                className="text-xs font-semibold bg-amber text-black hover:bg-amber-400"
              >
                Next Step
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  if (onStartPractice) onStartPractice();
                }}
                className="text-xs font-semibold bg-ink text-bone hover:bg-ink/90"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber" />
                Start Paper Practice
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
