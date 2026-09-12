import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DecisionCandidate } from "@shared/decisionFocus";
import { getEvidenceReviewReadiness, type EvidenceReviewRecord } from "@shared/evidenceReview";
import { describeEvidenceQuestion } from "@shared/evidenceQuestion";

type Candidate = DecisionCandidate & { id: number };
const roles: Record<string, string> = {
  core: "Thesis match", complementary: "Portfolio balance",
  remainder: "Other idea", alternative_expression: "Alternative strategy",
};

export function candidateInspectionHref(runId: number, search: string, candidateId: number | null) {
  const params = new URLSearchParams(search);
  if (candidateId != null) params.set("candidate", String(candidateId));
  params.set("inspect", candidateId == null ? "0" : "1");
  return `/aperture/run/${runId}?${params}`;
}

/** Saved evidence only. Inspecting a row does not clear checks or create a ticket. */
export function CandidateComparison({ candidates, reviews, leadId, inspectedId, onInspect }: {
  candidates: Candidate[];
  reviews: EvidenceReviewRecord[];
  leadId?: number;
  inspectedId: number | null;
  onInspect: (id: number, trigger: HTMLButtonElement) => void;
}) {
  return <section aria-label="Compare candidates" className="min-w-0 rounded-xl border" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <header className="px-4 py-3">
      <h2 className="font-serif text-xl">Compare candidates · {candidates.length}</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--sh-fg-muted)" }}>Ordered by research fit. Open a candidate to check its plan, risk, and evidence.</p>
    </header>
    <div className="hidden grid-cols-[1fr_1fr_1.4fr_auto] gap-4 border-t px-4 py-2 text-xs sm:grid" aria-hidden="true" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
      <span>Candidate</span><span>Evidence status</span><span>Next check</span><span className="w-20" />
    </div>
    <ul>{candidates.map((candidate) => {
      const readiness = getEvidenceReviewReadiness(
        Array.isArray(candidate.verifyFields) ? candidate.verifyFields : [],
        reviews.filter((review) => review.candidateId === candidate.id),
      );
      const next = readiness.negativeChecks[0] ?? readiness.unreviewedChecks[0];
      const status = readiness.paperStageDeclined ? "Evidence declined"
        : readiness.unreviewedChecks.length ? `${readiness.unreviewedChecks.length} ${readiness.unreviewedChecks.length === 1 ? "check remains" : "checks remain"}` : "Ticket checks next";
      return <li key={candidate.id} data-candidate-row={candidate.id} className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t px-4 py-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:gap-4" style={{ borderColor: "var(--sh-border-1)" }}>
        <div className="min-w-0">
          <p className="break-words font-semibold">{candidate.symbol}{candidate.id === leadId && <span className="ml-2 text-xs font-normal" style={{ color: "var(--sh-signal)" }}>Lead</span>}</p>
          <p className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>{roles[candidate.role] ?? "Research candidate"}</p>
        </div>
        <p className="col-start-1 text-sm sm:col-start-auto" style={{ color: readiness.paperStageDeclined ? "var(--sh-red)" : "var(--sh-text-primary)" }}>{status}</p>
        <p className="col-start-1 break-words text-sm sm:col-start-auto" style={{ color: "var(--sh-fg-muted)" }}>{next ? describeEvidenceQuestion(candidate.symbol, next).requirement : "Confirm current price, contract, and risk"}</p>
        <Button type="button" variant="outline" className="col-start-2 row-start-1 min-h-11 sm:col-start-auto sm:row-start-auto" aria-label={`Inspect ${candidate.symbol}`} aria-haspopup="dialog" aria-expanded={inspectedId === candidate.id} onClick={(event) => onInspect(candidate.id, event.currentTarget)}>Inspect</Button>
      </li>;
    })}</ul>
  </section>;
}

export function CandidateInspection({ open, symbol, onClose, onRestoreFocus, children }: {
  open: boolean; symbol: string; onClose: () => void; onRestoreFocus: () => void; children: ReactNode;
}) {
  return <Sheet open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
    <SheetContent aria-describedby={undefined} className="w-full overflow-y-auto sm:max-w-2xl motion-reduce:animate-none motion-reduce:transition-none [&>button]:min-h-11 [&>button]:min-w-11" style={{ background: "var(--sh-surface)" }} onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}>
      <SheetHeader className="pr-16"><SheetTitle className="font-serif text-xl">{symbol} · candidate details</SheetTitle></SheetHeader>
      <div className="min-w-0 space-y-4 px-4 pb-6">{children}</div>
    </SheetContent>
  </Sheet>;
}
