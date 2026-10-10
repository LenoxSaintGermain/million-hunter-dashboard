import { describe, expect, it } from "vitest";
import { closedHeading, closedSentence, dollars, lockedInLine, planCaveat, planOutcomeSentence, quickHeadline, sampleNote, signedDollars, signedR } from "./performanceCopy";

describe("performance copy", () => {
  it("reads like the approved Quick Play mockup", () => {
    expect(quickHeadline({ equityCents: 10_061_200, thisWeekCents: 41_200, sinceStartCents: 61_200, startingCents: 10_000_000 }))
      .toBe("You're up $412 this week and $612 since you started with $100,000. Your account is worth $100,612.");
    expect(lockedInLine(37_900, 23_300, 5)).toBe("$379 of that is locked in from plays you closed. $233 is on paper in plays still open, and can still change.");
    expect(planOutcomeSentence(-47_300, 36_700)).toBe("If every open play hits its stop, you'd be down $473 from here. If every one reaches its target, you'd be up $367 from here.");
    expect(closedHeading({ closed: 5, wins: 3, avgWinCents: 18_700, avgLossCents: 9_100, avgR: 1.44 })).toBe("3 of 5 made money");
    expect(closedSentence({ closed: 5, wins: 3, avgWinCents: 18_700, avgLossCents: 9_100, avgR: 1.44 }))
      .toBe("Your wins averaged $187 and your losses averaged $91. On average a play made 1.4× what you planned to risk on it.");
    expect(sampleNote(5, "process_only")).toContain("too few to tell skill from luck");
    expect(planCaveat(["SAMPLE-J"])).toContain("One holding (SAMPLE-J) has no stop or target saved, so it isn't counted.");
  });

  it("never turns an unmeasured value into zero", () => {
    expect(dollars(null)).toBe("Not measured");
    expect(signedDollars(undefined)).toBe("Not measured");
    expect(signedR(null)).toBe("Not measured");
    expect(quickHeadline({ equityCents: null, thisWeekCents: null, sinceStartCents: null, startingCents: null })).toContain("hasn't been measured");
    expect(quickHeadline({ equityCents: 10_000_000, thisWeekCents: null, sinceStartCents: null, startingCents: null })).toBe("Your account is worth $100,000. Changes show after your next saved sync.");
    expect(planOutcomeSentence(null, null)).toContain("need a stop");
    expect(lockedInLine(null, null, 0)).toBeNull();
  });

  it("handles a down week without saying up", () => {
    const text = quickHeadline({ equityCents: 9_900_000, thisWeekCents: -20_000, sinceStartCents: -100_000, startingCents: 10_000_000 });
    expect(text).toBe("You're down $200 this week and $1,000 since you started with $100,000. Your account is worth $99,000.");
    expect(quickHeadline({ equityCents: 10_050_000, thisWeekCents: -20_000, sinceStartCents: 50_000, startingCents: 10_000_000 })).toContain("down $200 this week and up $500 since");
  });

  it("formats signed money and R with a true minus", () => {
    expect(signedDollars(-9_100)).toBe("−$91");
    expect(signedDollars(21_000)).toBe("+$210");
    expect(signedR(-1.09)).toBe("−1.09R");
  });
});
