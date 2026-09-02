import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Capital Aperture paper-ticket journey contract", () => {
  it("does not open the ticket before candidate evidence review is complete", () => {
    const board = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/CandidateBoard.tsx"), "utf8");

    expect(board).toContain("Review the required evidence before opening the paper ticket");
    expect(board).toContain("unreviewedChecks.length");
  });

  it("keeps incomplete option terms in place and never renders share impact for an option", () => {
    const form = readFileSync(resolve(process.cwd(), "client/src/components/aperture/PaperProposalForm.tsx"), "utf8");

    expect(form).toContain('readiness.action === "complete_ticket"');
    expect(form).toContain("const portfolioImpactReady = !isOption && recipeCanPrepare");
    expect(form).toContain("{isOption ? optionTermsReady ?");
    expect(form).toContain("Option impact is not measured yet.");
    expect(form).toContain("ticketMissing: optionTicketMissing");
    expect(form).toContain("Price &amp; risk");
    expect(form).toContain("PriceRiskVisual");
    expect(form).toContain("Live option quote required");
  });

  it("does not make the paper acknowledgement a circular preflight dependency", () => {
    const form = readFileSync(resolve(process.cwd(), "client/src/components/aperture/PaperProposalForm.tsx"), "utf8");

    expect(form).toContain('const preflightTicket = useMemo(() => ({ ...ticket, paperAcknowledgement: "PAPER" }), [ticket]);');
    expect(form).toContain("preflightInput?.ticket ?? preflightTicket");
    expect(form).toContain('paperAcknowledgement !== "PAPER"');
  });

  it("keeps option premium state separate and suppresses stale preflight verdicts", () => {
    const form = readFileSync(resolve(process.cwd(), "client/src/components/aperture/PaperProposalForm.tsx"), "utf8");

    expect(form).toContain("optionPremiumDollars");
    expect(form).toContain("optionSlippageDollars");
    expect(form).toContain("preflightMatchesTicket");
    expect(form).toContain("currentPreflightData");
    expect(form).toContain("const preflightBusy = preflightEnabled &&");
  });

  it("formats ticket deadlines as local wall-clock values for datetime-local inputs", () => {
    const form = readFileSync(resolve(process.cwd(), "client/src/components/aperture/PaperProposalForm.tsx"), "utf8");

    expect(form).toContain("toLocalDateTimeInputValue");
    expect(form).not.toContain("new Date(constructedPlay.timeStopAt).toISOString().slice(0, 16)");
  });

  it("returns to evidence with the selected candidate preserved", () => {
    const execute = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/ApertureExecute.tsx"), "utf8");

    expect(execute).toContain("?candidate=${proposalCandidate.id}&view=evidence");
    expect(execute).toContain("const decisionUrl = proposalCandidate");
    expect(execute).toContain('navigate(decisionUrl)');
  });

  it("collapses completed evidence into one direct paper-ticket action", () => {
    const board = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/CandidateBoard.tsx"), "utf8");
    const focus = readFileSync(resolve(process.cwd(), "client/src/components/aperture/DecisionFocusCard.tsx"), "utf8");
    const recipe = readFileSync(resolve(process.cwd(), "client/src/components/aperture/PlayRecipeCard.tsx"), "utf8");

    expect(board).toContain("reviewedChecks={reviewedChecks}");
    expect(board).toContain("onPrepareProposal={() => navigate(`/aperture/run/${runId}/execute?candidate=${focusCandidate.id}`)}");
    expect(focus).toContain("allChecksReviewed");
    expect(focus).toContain("Evidence review complete");
    expect(focus).toContain("Review paper ticket");
    expect(recipe).toContain("allChecksReviewed");
    expect(recipe).toContain("Ready for ticket preflight");
    expect(recipe).toContain('exactOptionTicketCanResolve ? "Open paper ticket" : "Resolve blocker"');
  });

  it("keeps a hard-blocked ticket in place and reveals alternatives inline", () => {
    const execute = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/ApertureExecute.tsx"), "utf8");

    expect(execute).toContain("showAlternatives");
    expect(execute).toContain("Choose another play in this run");
    expect(execute).toContain("setShowAlternatives(true)");
    expect(execute).toContain("A proposal appears here only after preflight passes.");
    expect(execute).toContain("focusCandidateId={proposalCandidate?.id}");
    expect(execute).toContain("other paper order");
    expect(execute).toContain("Monitor in Play Desk");
    expect(execute).toContain("ticketBuilderActive={Boolean(proposalCandidate && !paperStageDeclined && !evidenceReviewRequired && !candidateActiveOrder)}");
  });

  it("presents any eligible closed-session DAY submission as a broker queue instead of an evidence loop", () => {
    const execute = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/ApertureExecute.tsx"), "utf8");
    const desk = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"), "utf8");

    expect(execute).toContain("Submit / queue paper order");
    expect(execute).toContain("held for the next eligible regular session");
    expect(execute).not.toContain("If the options session is closed");
    expect(execute).toContain("Accepted / queued at paper broker");
    expect(desk).toContain("Accepted / queued at paper broker");
  });

  it("replaces a duplicate ticket builder with the existing paper-order receipt", () => {
    const execute = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/ApertureExecute.tsx"), "utf8");

    expect(execute).toContain("candidateActiveOrder");
    expect(execute).toContain("Paper order already exists · do not duplicate");
    expect(execute).toContain("accepted and queued for the next eligible session");
    expect(execute).toContain("!candidateActiveOrder");
  });

  it("reacts when an inline alternative changes only the candidate query parameter", () => {
    const board = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/CandidateBoard.tsx"), "utf8");

    expect(board).toContain('import { useRoute, useLocation, useSearch } from "wouter"');
    expect(board).toContain("const search = useSearch();");
    expect(board).toContain('new URLSearchParams(search).get("candidate")');
  });
});
