import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DecisionCandidate } from "@shared/decisionFocus";
import { getEvidenceReviewReadiness, type EvidenceReviewRecord } from "@shared/evidenceReview";
import { describeEvidenceQuestion } from "@shared/evidenceQuestion";
import type { CandidateAffordability } from "@shared/candidateAffordability";

type Candidate = DecisionCandidate & { id: number; affordability?: CandidateAffordability };
const dollars = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export function CandidateBudgetHint({ value }: { value?: CandidateAffordability }) {
  if (!value) return null;
  const blocked = value.state === "above_limit";
  const measured = blocked || value.state === "within_reference";
  return <div className="mt-1 text-sm" data-candidate-budget={value.state}>
    <p style={{ color: blocked ? "var(--sh-red)" : "var(--sh-fg-muted)" }}>
      {blocked ? "Above share budget · Research only" : value.state === "options_required" ? "Options need a fresh contract quote" : measured ? "Share price within reference budget · not qualified" : "Share affordability not measured"}
    </p>
    {measured && value.referencePriceCents != null && value.ceilingCents != null && <p className="tabular-nums">{dollars(value.referencePriceCents)} / share · {dollars(value.ceilingCents)} ceiling</p>}
    {blocked && value.requiredEquityCents != null && <p data-required-capital className="tabular-nums" style={{ color: "var(--sh-text-primary)" }}>One share needs about {dollars(value.requiredEquityCents)} of declared capital at this policy, or a lower-priced name.</p>}
    {blocked && value.requiredCapitalCents != null && <p data-required-capital className="tabular-nums" style={{ color: "var(--sh-text-primary)" }}>One share needs at least {dollars(value.requiredCapitalCents)} of research budget on this mission, or a lower-priced name.</p>}
    <details className="text-sm" style={{ color: "var(--sh-fg-muted)" }}>
      <summary className="min-h-11 cursor-pointer py-3">{blocked ? "Why this limit · next step" : "Price and budget basis"}</summary>
      {measured && value.asOf != null && <p>{value.sourceName} · price recorded {new Date(value.asOf).toLocaleString("en-US")}. Not an executable quote.</p>}
      <p>{value.accountAsOf ? `Account snapshot ${new Date(value.accountAsOf).toLocaleString("en-US")}. ` : "Account snapshot not measured. "}The lower of the single-order policy limit and this research budget is shown. Other risk limits may be tighter.</p>
      <p>{blocked ? "Nothing is raised for you. Revise the mission to declare more capital, research a lower-priced name, or continue this research without a practice order. Refresh account and price evidence before reassessment." : "Confirm fresh price, account capacity and all evidence at paper review. This comparison does not authorize a ticket."}</p>
    </details>
  </div>;
}
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
        <div className="col-start-1 min-w-0 break-words text-sm sm:col-start-auto" style={{ color: "var(--sh-fg-muted)" }}><p>{next ? describeEvidenceQuestion(candidate.symbol, next).requirement : "Confirm current price, contract, and risk"}</p><CandidateBudgetHint value={candidate.affordability} /></div>
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
