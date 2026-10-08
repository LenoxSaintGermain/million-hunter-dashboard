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

/**
 * Guided tour copy. Plain language, and no promise the product can't keep:
 * no guaranteed loss limits, no live-price claims, nothing automatic.
 */
export const TOUR_STEPS = [
  {
    step: 1,
    title: "1. Start with a reason, not a hunch",
    badge: "The idea",
    icon: Target,
    lead: "Every practice trade starts with a dated reason: an earnings report, a product launch or an economic report.",
    description: "You write down why you think a stock will move and by when. If the date passes and nothing happened, the idea has expired. You don't hold on hoping.",
    example: "Example only: a company reports earnings in 14 days and you expect strong demand.",
  },
  {
    step: 2,
    title: "2. Decide the most you'll lose, first",
    badge: "Your limit",
    icon: Shield,
    lead: "Before any order, you set the most you're willing to lose on the trade.",
    description: "The app works out a planned exit price and a share count that keep the planned loss inside your limit and the desk's limits. It checks your plan; it doesn't watch the market for you.",
    example: "A planned exit price is a plan, not a promise. Prices can jump past it, so a real loss can be bigger than planned.",
  },
  {
    step: 3,
    title: "3. Practice with pretend money",
    badge: "Practice account",
    icon: Compass,
    lead: "Orders go to a practice (paper) account. No real money moves.",
    description: "Before you can send, each order is checked against limits: how big one order can be, how much rides on one company and how much you can lose in a day. If a check fails, Send stays off.",
    example: "Prices and balances are as of your last account sync. Sync before you decide.",
  },
  {
    step: 4,
    title: "4. Check in on a schedule",
    badge: "Reviews",
    icon: Eye,
    lead: "Each trade gets a review date, and you decide whether your reason still holds.",
    description: "Losses often grow when people hold a falling stock hoping it comes back. On the review date, ask yourself: did the event happen the way I expected? If not, you decide whether to get out.",
    example: "Nothing checks, orders or exits automatically. Today shows you when a review is due or an order is ready.",
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
      aria-label="How practice trading works"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-rule bg-[var(--sh-surface-1)] p-6 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tour"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-[var(--sh-surface-2)] hover:text-ink transition-colors"
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
                  : "bg-[var(--sh-surface-2)]"
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

          <div className="rounded-lg border border-rule bg-[var(--sh-surface-2)] p-3 text-xs font-mono text-ink/80">
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
                Next
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
                Start practicing
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
