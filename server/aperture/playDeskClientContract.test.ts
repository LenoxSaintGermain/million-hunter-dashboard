import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Capital Aperture Play Desk contract", () => {
  it("exposes one cross-run operator route in both Capital nav modes", () => {
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "client/src/components/aperture/ApertureShell.tsx"), "utf8");

    expect(app).toContain('<Route path="/aperture/plays"');
    expect(shell.match(/href: "\/aperture\/plays", label: "Play Desk"/g)).toHaveLength(2);
  });

  it("keeps the desk read-only and owner scoped", () => {
    const router = readFileSync(resolve(process.cwd(), "server/apertureRouter.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"), "utf8");

    expect(router).toContain("desk: router({");
    expect(router).toContain("summary: capitalOperatorProcedure.query");
    expect(router).toContain("eq(portfolioAccounts.userId, ctx.user.id)");
    expect(router).toContain("eq(apertureDecisionRuns.userId, ctx.user.id)");
    expect(router).toContain("state.netQty > 0 && state.latestOpenId === order.id");
    expect(page).toContain("Review, approval, and submission remain separate human actions.");
    expect(page).toContain("Dispatch unresolved");
    expect(page).toContain('order.status === "filled" && order.intent !== "close"');
    expect(page).not.toContain(".useMutation(");
  });

  it("removes recorded cash decisions from the choice lane", () => {
    const router = readFileSync(resolve(process.cwd(), "server/apertureRouter.ts"), "utf8");

    expect(router).toContain("const skippedCandidateIds = new Set");
    expect(router).toContain("candidateReadiness.paperStageDeclined || skippedCandidateIds.has(candidate.id)");
  });

  it("gives a skipped memo a safe continuation instead of a dead end", () => {
    const memo = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/MemoDrawer.tsx"), "utf8");

    expect(memo).toContain("Return to evidence");
    expect(memo).toContain("Open Play Desk");
    expect(memo).toContain("Nothing is ready to approve from this memo.");
  });

  it("shows a deferred play as queued until its next regular-session resume time", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"), "utf8");

    expect(page).toContain("deferredByRun");
    expect(page).toContain("Queued for next regular session");
    expect(page).toContain("Returns ");
    expect(page).toContain("Review queue");
  });

  it("opens decision-ready work at the play instead of forcing another evidence loop", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"), "utf8");
    const decisionReadySection = page.slice(page.indexOf("!isLoading && decisionReady.length"), page.indexOf("!isLoading && (inMotionOrders.length"));

    expect(page).toContain('"Choose play"');
    expect(decisionReadySection).toContain("navigate(deferred ?");
    expect(decisionReadySection).toContain("actionableCandidateId");
    expect(decisionReadySection).not.toContain("view=evidence");
  });

  it("routes play-outcome reviews to the exact order lifecycle", () => {
    const router = readFileSync(resolve(process.cwd(), "server/apertureRouter.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"), "utf8");

    expect(router).toContain("orderRunId: brokerOrders.runId");
    expect(router).toContain("orderCandidateId: brokerOrders.candidateId");
    expect(page).toContain('item.kind === "play_outcome"');
    expect(page).toContain("lifecycle=monitoring");
  });

  it("opens filled plays on monitoring instead of returning to the ticket form", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"), "utf8");

    expect(page).toContain('order.status === "filled" ? "&lifecycle=monitoring" : ""');
  });

  it("uses per-candidate state rather than completed-run status for the choose lane", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"), "utf8");

    expect(page).toContain("playDeskJourneyLane");
    expect(page).toContain("candidateStates?.label");
    expect(page).toContain("actionableCandidateId");
  });

  it("keeps the desk compact and makes play types visible", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "client/src/components/aperture/ApertureShell.tsx"), "utf8");

    expect(page).toContain("Make the next decision");
    expect(page).toContain("Shares");
    expect(page).toContain("Calls");
    expect(page).toContain("Puts");
    expect(page).toContain("Show research backlog");
    expect(page).not.toContain("Nothing in this lane.");
    expect(shell).toContain('compactOnly={location === "/aperture/plays" || location.startsWith("/aperture/run/")}');
  });
});
