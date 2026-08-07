import { describe, it, expect } from "vitest";
import { computeNextRun } from "./scheduler";

const at = (iso: string) => new Date(iso).getTime();
const utcHour = (ms: number) => new Date(ms).getUTCHours();

describe("computeNextRun", () => {
  it("schedules later the same day when the hour hasn't passed", () => {
    const next = computeNextRun("daily", 9, at("2026-08-07T03:00:00Z"));
    expect(new Date(next).toISOString()).toBe("2026-08-07T09:00:00.000Z");
  });

  it("rolls to tomorrow when the hour has already passed", () => {
    const next = computeNextRun("daily", 9, at("2026-08-07T14:00:00Z"));
    expect(new Date(next).toISOString()).toBe("2026-08-08T09:00:00.000Z");
  });

  it("never returns a time in the past or the present", () => {
    const now = at("2026-08-07T09:00:00Z");
    // Exactly on the hour must move forward, or the tick would re-fire forever.
    expect(computeNextRun("daily", 9, now)).toBeGreaterThan(now);
  });

  it("steps a week for the weekly cadence", () => {
    const from = at("2026-08-07T14:00:00Z");
    const next = computeNextRun("weekly", 9, from);
    expect(new Date(next).toISOString()).toBe("2026-08-14T09:00:00.000Z");
  });

  it("keeps the requested UTC hour across a month boundary", () => {
    const next = computeNextRun("daily", 23, at("2026-08-31T23:30:00Z"));
    expect(utcHour(next)).toBe(23);
    expect(new Date(next).toISOString()).toBe("2026-09-01T23:00:00.000Z");
  });

  it("handles midnight", () => {
    const next = computeNextRun("daily", 0, at("2026-08-07T00:30:00Z"));
    expect(new Date(next).toISOString()).toBe("2026-08-08T00:00:00.000Z");
  });
});
