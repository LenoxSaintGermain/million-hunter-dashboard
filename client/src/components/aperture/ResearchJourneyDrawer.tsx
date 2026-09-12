import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ResearchJourney } from "@shared/runWorkspace";

/**
 * Everything the Research table deliberately leaves off its rows.
 *
 * The page previously rendered three explanatory cards per journey — coverage,
 * decision state, what to do now — each carrying a full sentence, on every card,
 * for every journey. Measured 2026-09-12: eight and a third screens and 1,830
 * words, 32.7 of them per interactive control, the densest surface in the
 * product. The sentences are worth keeping; repeating them down a list is not.
 *
 * Exported separately from the Sheet so it can be rendered and asserted on
 * directly: a Radix portal does not survive static rendering.
 */

export interface JourneyAction { label: string; detail: string; route: string }

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-0 border-t py-2 first:border-t-0" style={{ borderColor: "var(--sh-border-1)" }}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--sh-fg-muted)" }}>{label}</p>
    <p className="mt-0.5 break-words text-sm leading-5" style={{ color: "var(--sh-text-primary)" }}>{value}</p>
    <p className="mt-0.5 break-words text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>{detail}</p>
  </div>;
}

export function ResearchJourneyBody({ journey, stateLabel, action, onOpenChapter }: {
  journey: ResearchJourney;
  stateLabel: string;
  action: JourneyAction;
  onOpenChapter: (runId: number) => void;
}) {
  return <div data-journey-body className="min-w-0 space-y-5">
    <p className="text-sm font-semibold" style={{ color: "var(--sh-signal)" }}>{stateLabel}</p>

    <section className="min-w-0">
      <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Where this stands</h3>
      <div className="mt-1">
        <Fact
          label="Research coverage"
          value={`${journey.symbolsReviewed} symbol${journey.symbolsReviewed === 1 ? "" : "s"} reviewed`}
          detail={journey.remainingDeferred
            ? `${journey.remainingDeferred} still available to research. Deferred symbols were set aside deliberately; they are not failures.`
            : "The full discovered universe was reviewed."}
        />
        <Fact
          label="Evidence"
          value={`${journey.evidenceCandidates} candidate${journey.evidenceCandidates === 1 ? "" : "s"}`}
          detail="Candidates carry recorded checks. A candidate is not a recommendation and none of this creates an order."
        />
        <Fact
          label="Decision state"
          value={stateLabel}
          detail={journey.state === "paper_stage_declined"
            ? "This revision is closed to paper-proposal preparation. The receipt stays readable."
            : journey.remainingDeferred
              ? "You can research more without clearing every check first."
              : "Ready to move into the priority evidence review."}
        />
        <Fact label="Next step" value={action.label} detail={action.detail} />
      </div>
    </section>

    <section className="min-w-0">
      <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sh-signal)" }}>Chapters · {journey.runs.length}</h3>
      <p className="mt-1 text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>A follow-up batch belongs to the same question, not a new one.</p>
      <ul className="mt-2 space-y-1">{journey.runs.map((run, index) => <li key={run.id}>
        <button
          type="button"
          data-journey-chapter={run.id}
          onClick={() => onOpenChapter(run.id)}
          className="min-h-11 w-full rounded-md border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ borderColor: run.id === journey.latest.id ? "var(--sh-signal)" : "var(--sh-border-1)" }}
        >
          Chapter {index + 1}{run.id === journey.latest.id ? " · latest" : ""}
          <span className="block text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>
            Run #{run.id} · {run.candidateCount ?? 0} candidate{(run.candidateCount ?? 0) === 1 ? "" : "s"}
          </span>
        </button>
      </li>)}</ul>
    </section>

    <p className="text-[11px] leading-4" style={{ color: "var(--sh-fg-muted)" }}>
      Opening a journey changes nothing: it records no review, starts no research, and creates no order.
    </p>
  </div>;
}

export function ResearchJourneyDrawer({ journey, stateLabel, action, onClose, onOpenChapter, onTakeAction }: {
  journey: ResearchJourney | null;
  stateLabel: string;
  action: JourneyAction;
  onClose: () => void;
  onOpenChapter: (runId: number) => void;
  onTakeAction: () => void;
}) {
  return <Sheet open={journey != null} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent
      side="right"
      data-journey-inspection
      aria-describedby={undefined}
      className="w-full overflow-y-auto sm:max-w-lg [&>button]:min-h-11 [&>button]:min-w-11"
      style={{ background: "var(--sh-surface)" }}
    >
      {journey && <>
        <SheetHeader className="gap-1">
          <SheetTitle className="break-words font-serif text-xl">{journey.thesisName}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ResearchJourneyBody journey={journey} stateLabel={stateLabel} action={action} onOpenChapter={onOpenChapter} />
          <Button className="mt-5 min-h-12 w-full" onClick={onTakeAction}>
            {action.label}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" />
          </Button>
        </div>
      </>}
    </SheetContent>
  </Sheet>;
}
