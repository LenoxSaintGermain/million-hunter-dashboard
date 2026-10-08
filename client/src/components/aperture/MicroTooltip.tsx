import { type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const GLOSSARY_TERMS: Record<string, { term: string; definition: string }> = {
  buying_power: {
    term: "Buying Power",
    definition: "The total money you can trade with, including margin/leverage. Not actual cash.",
  },
  single_order_ceiling: {
    term: "Single Order Ceiling",
    definition: "The maximum dollar amount you allow yourself to put into a single trade.",
  },
  planned_loss: {
    term: "Planned-Loss Limit",
    definition: "The maximum dollar amount you are willing to lose if the trade goes against you, strictly enforced before entry.",
  },
  gate_review: {
    term: "Gate Review (Checkup)",
    definition: "A scheduled 30-day health check to confirm your investment premise is still valid before holding further.",
  },
  unrealized_pnl: {
    term: "Unrealized P&L",
    definition: "Paper profit or loss on active positions you currently hold that haven't been sold yet.",
  },
  measured_gross: {
    term: "Measured Gross",
    definition: "The total combined dollar value of all your active investments.",
  },
  concentration_limit: {
    term: "Concentration Limit",
    definition: "A safety guardrail capping how much of your account can be in a single company (e.g., max 10%).",
  },
  catalyst: {
    term: "Catalyst",
    definition: "An upcoming dated event (such as an earnings report or product cycle) that could rapidly move the asset's price.",
  },
  invalidation_price: {
    term: "Invalidation Price",
    definition: "The exact price level that proves your thesis wrong, triggering a controlled, disciplined exit.",
  },
  cash: {
    term: "Cash",
    definition: "Actual settled cash balance sitting in your account, unaffected by market fluctuations.",
  },
  notional_exposure: {
    term: "Notional Exposure",
    definition: "The full underlying market value of the shares or options contracts you control.",
  },
};

interface MicroTooltipProps {
  termKey?: keyof typeof GLOSSARY_TERMS;
  term?: string;
  definition?: string;
  children?: ReactNode;
  className?: string;
  showIcon?: boolean;
}

export function MicroTooltip({
  termKey,
  term,
  definition,
  children,
  className,
  showIcon = false,
}: MicroTooltipProps) {
  const meta = termKey ? GLOSSARY_TERMS[termKey] : null;
  const displayTerm = children ?? term ?? meta?.term ?? "Term";
  const displayDefinition = definition ?? meta?.definition ?? "";

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 border-b border-dotted border-current/60 cursor-help transition-colors hover:border-current hover:text-signal",
              className
            )}
            tabIndex={0}
            role="button"
            aria-label={`${typeof displayTerm === "string" ? displayTerm : "Term"} definition`}
          >
            {displayTerm}
            {showIcon && <Info className="inline h-3 w-3 opacity-60 ml-0.5" />}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-[280px] rounded-lg border border-rule bg-[var(--sh-surface-1)] p-2.5 text-xs text-ink shadow-md"
        >
          <p className="font-semibold text-ink tracking-tight">
            {meta?.term ?? (typeof displayTerm === "string" ? displayTerm : "Why this matters")}
          </p>
          <p className="mt-1 text-muted-foreground leading-relaxed">{displayDefinition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
