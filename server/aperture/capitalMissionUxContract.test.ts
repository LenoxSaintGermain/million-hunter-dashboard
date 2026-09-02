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
  const help = readFileSync(
    resolve(process.cwd(), "client/src/components/aperture/ContextHelp.tsx"),
    "utf8",
  );

  it("keeps the mission-to-submit path visible without implying automatic execution", () => {
    expect(runway).toContain("Mission");
    expect(runway).toContain("Play Slate");
    expect(runway).toContain("Ticket");
    expect(runway).toContain("Submit");
    expect(runway).toContain("Nothing is sent automatically");
  });

  it("explains Capital Mission and ranked suggestions in concise, actionable language", () => {
    expect(runway).toContain("Set the goal, budget, risk limit, and timeframe.");
    expect(runway).toContain("Suggested missions");
    expect(runway).toContain("best-supported research path—not the highest-return forecast");
    expect(runway).not.toContain("Top missions only. Ranking reflects known thesis");
  });

  it("uses account-mode wording instead of repeating paper in the play-list heading", () => {
    expect(plays).toContain("Today’s plays");
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
});
