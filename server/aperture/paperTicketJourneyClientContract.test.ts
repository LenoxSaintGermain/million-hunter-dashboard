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
    expect(form).toContain("ticketMissing: optionTicketMissing");
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

  it("returns to evidence with the selected candidate preserved", () => {
    const execute = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/ApertureExecute.tsx"), "utf8");

    expect(execute).toContain("?candidate=${proposalCandidate.id}&view=evidence");
    expect(execute).toContain("const decisionUrl = proposalCandidate");
    expect(execute).toContain('navigate(decisionUrl)');
  });
});
