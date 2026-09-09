import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Capital Mission decision-path UX contract", () => {
  const runway = readFileSync(
    resolve(process.cwd(), "client/src/components/aperture/DecisionRunway.tsx"),
    "utf8",
  );
  const plays = readFileSync(
    resolve(process.cwd(), "client/src/components/aperture/DailyPlayList.tsx"),
    "utf8",
  );
  const home = readFileSync(
    resolve(process.cwd(), "client/src/pages/aperture/ApertureHome.tsx"),
    "utf8",
  );
  const mission = readFileSync(
    resolve(process.cwd(), "client/src/pages/aperture/ApertureMission.tsx"),
    "utf8",
  );
  const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
  const help = readFileSync(
    resolve(process.cwd(), "client/src/components/aperture/ContextHelp.tsx"),
    "utf8",
  );
  const router = readFileSync(
    resolve(process.cwd(), "server/apertureRouter.ts"),
    "utf8",
  );
  const cockpit = readFileSync(
    resolve(process.cwd(), "client/src/components/aperture/CapitalCockpitRail.tsx"),
    "utf8",
  );

  it("keeps the mission-to-paper path visible without implying automatic execution", () => {
    expect(runway).toContain("Mission");
    expect(runway).toContain("Underwrite");
    expect(runway).toContain("Research");
    expect(runway).toContain("Paper");
    expect(runway).toContain("No research run, paper ticket, approval, submission, or broker order has been created");
  });

  it("explains Capital Mission and ranked suggestions in concise, actionable language", () => {
    expect(runway).toContain("Set the objective. The target never increases allowed risk.");
    expect(runway).toContain("Suggested missions");
    expect(runway).toContain("best-supported research path—not the highest-return forecast");
    expect(runway).not.toContain("Top missions only. Ranking reflects known thesis");
  });

  it("uses account-mode wording instead of repeating paper in the play-list heading", () => {
    expect(plays).toContain("Research queue");
    expect(plays).toContain("Account · as of");
    expect(plays).toContain("Paper account · human approval required");
    expect(plays).not.toContain("Today’s paper plays");
  });

  it("provides touch-friendly contextual help for mobile", () => {
    expect(help).toContain("Popover");
    expect(help).toContain("min-h-11");
    expect(help).toContain("min-w-11");
    expect(help).toContain("What does this mean?");
  });

  it("removes active or queued orders from Today instead of presenting stale research as the next step", () => {
    expect(router).toContain("inMotionCandidateIds");
    expect(router).toContain("inMotionPlayCount: inMotionCandidateIds.size");
    expect(router).toContain(".filter(({ candidate }) => !inMotionCandidateIds.has(candidate.id))");
    expect(plays).toContain("Already in motion");
    expect(plays).toContain("Open Play Desk");
  });

  it("separates the daily overview from the Capital Mission workspace", () => {
    expect(home).toContain("<DailyPlayList");
    expect(home).toContain('navigate("/aperture/mission")');
    expect(mission).toContain("<DecisionRunway");
    expect(runway).not.toContain("<DailyPlayList");
    expect(app).toContain('path="/aperture/mission"');
  });

  it("exposes one primary underwriting action and distinct disposition choices", () => {
    expect(runway).toContain("Search for a play");
    expect(runway).toContain("Hold for a condition");
    expect(runway).toContain("Preserve cash");
    expect(runway).toContain('"Underwrite my mission"');
    expect(runway).toContain("Builds a research playbook. Does not create or submit an order.");
    expect(runway).not.toContain("Compile Play Slate");
  });

  it("makes unconfigured money and diagnostic gates actionable", () => {
    expect(runway).toContain("Mission not configured");
    expect(runway).toContain("Preserve cash is a separate recorded decision");
    expect(runway).toContain('id="mission-math"');
    expect(runway).toContain("onDiagnosticSelect");
    expect(runway).toContain('placeholder="Enter amount"');
    expect(runway).toContain('aria-label="Capital Mission sections"');
    expect(runway).toContain("Thesis & horizon");
    expect(runway).toContain("Account & risk");
    expect(runway).toContain("Review & underwrite");
    expect(runway).not.toContain("canOpenSlate");
  });

  it("fails closed on deep links when the current mission revision no longer authorizes research", () => {
    const board = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/CandidateBoard.tsx"), "utf8");
    const execute = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/ApertureExecute.tsx"), "utf8");

    expect(router).toContain("decisionAuthority:");
    expect(board).toContain("<DecisionStepLock authority={data.decisionAuthority}");
    expect(execute).toContain("<DecisionStepLock authority={data.decisionAuthority}");
  });

  it("lets suggested missions explicitly apply their parameters", () => {
    expect(runway).toContain("Apply mission parameters");
    expect(runway).not.toContain('label="Thesis match"');
  });

  it("separates the active thesis from the account portfolio constraint", () => {
    expect(cockpit).toContain("Active thesis");
    expect(cockpit).toContain("Portfolio constraint");
    expect(cockpit).toContain("data.activeThesis.name");
  });

  it("keeps the mobile glance compact without hiding mode, freshness, thesis, or the binding constraint", () => {
    expect(cockpit).toContain('className="sm:hidden"');
    expect(cockpit).toContain('label="Paper mode"');
    expect(cockpit).toContain("staleText");
    expect(cockpit).toContain("Thesis {data.activeThesis?.name");
    expect(cockpit).toContain('label="Constraint"');
    expect(cockpit).toContain("% used");
    expect(cockpit).toContain("existing positions are unchanged");
  });

  it("uses shared attention instead of a competing Play Desk action algorithm", () => {
    const desk = readFileSync(
      resolve(process.cwd(), "client/src/pages/aperture/AperturePlayDesk.tsx"),
      "utf8",
    );
    // playDeskBehavior.test.ts renders critical, uncertain and order-state journeys.
    expect(desk).toContain('from "@shared/apertureAttention"');
    expect(desk).toContain("attentionDisclosure(briefing, primaryKey)");
    expect(desk).toContain("<AttentionTask item={disclosure.primary}");
    expect(desk).toContain("disclosure.otherCritical.map");
    expect(desk).not.toContain("<OperatorDecisionBrief");
    expect(desk).not.toContain("buildOperatorAction");
  });
});
