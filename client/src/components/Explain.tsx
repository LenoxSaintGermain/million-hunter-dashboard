/**
 * Explainers, driven by the shared glossary.
 *
 * <Explain k="rankScore" />        — a small ⓘ next to any label, on every asset.
 * <ExplainBlock k="rankScore" />   — the same definition expanded inline, used on
 *                                    the tutorial asset so a first-run user reads
 *                                    it without having to hunt for tooltips.
 *
 * Both read GLOSSARY, so a definition can never say two different things.
 */
import { GLOSSARY } from "@shared/tutorial";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

export function Explain({ k, className }: { k: keyof typeof GLOSSARY | string; className?: string }) {
  const entry = GLOSSARY[k as string];
  if (!entry) return null;
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`What is ${entry.term}?`}
            className={cn(
              "inline-flex items-center justify-center align-middle text-muted-foreground/60 hover:text-amber transition-colors",
              className,
            )}
          >
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px] space-y-1.5">
          <p className="font-eyebrow text-eyebrow uppercase tracking-widest">{entry.term}</p>
          <p className="font-body-base text-[12px] leading-relaxed">{entry.what}</p>
          {entry.how && <p className="font-body-base text-[11px] leading-relaxed opacity-80">{entry.how}</p>}
          {entry.soWhat && (
            <p className="font-body-base text-[11px] leading-relaxed opacity-80 border-t border-current/15 pt-1.5">
              {entry.soWhat}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Expanded explanation — the tutorial asset shows these instead of hiding
 *  everything behind hover, which doesn't exist on touch devices anyway. */
export function ExplainBlock({ k, className }: { k: keyof typeof GLOSSARY | string; className?: string }) {
  const entry = GLOSSARY[k as string];
  if (!entry) return null;
  return (
    <div className={cn("border-l-2 border-amber/50 pl-4 py-1 my-3 max-w-[620px]", className)}>
      <p className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest mb-1.5">{entry.term}</p>
      <p className="font-body-base text-[13px] text-ink/80 leading-relaxed">{entry.what}</p>
      {entry.how && (
        <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed mt-1.5">{entry.how}</p>
      )}
      {entry.soWhat && (
        <p className="font-body-base text-[12px] text-ink/70 leading-relaxed mt-1.5">
          <span className="font-eyebrow text-eyebrow uppercase tracking-widest text-muted-foreground mr-1.5">Use it</span>
          {entry.soWhat}
        </p>
      )}
    </div>
  );
}
