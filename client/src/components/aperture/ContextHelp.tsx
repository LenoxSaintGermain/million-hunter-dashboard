import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function ContextHelp({
  title,
  what,
  next,
  align = "end",
  className,
}: {
  title: string;
  what: string;
  next?: string;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What does this mean? ${title}`}
          className={cn(
            "-m-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2",
            className,
          )}
          style={{ color: "var(--sh-fg-muted)" }}
        >
          <CircleHelp aria-hidden="true" className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(19rem,calc(100vw-2rem))] space-y-2 p-3">
        <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{title}</p>
        <p className="text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>{what}</p>
        {next ? <p className="border-t pt-2 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}><strong>Next:</strong> {next}</p> : null}
      </PopoverContent>
    </Popover>
  );
}
