/**
 * POC v3 parity PR-01 (Guided honesty and copy pass). Guided mode must not
 * promise what the product can't do: no guaranteed loss limits, no live-price
 * claims, nothing automatic, no reload button described as a price sync, and
 * no "All clear" while the account is stale or a limit is near.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { TOUR_STEPS } from "../../client/src/components/aperture/GuidedOnboardingTour";
import { GuidedDecisionQueue } from "../../client/src/components/aperture/GuidedDecisionQueue";
import { guidedAccountCheck } from "../../shared/guidedAllClear";
import { STALE_ACCOUNT_MS, type CockpitHeadroomLine } from "../../shared/cockpitRailSummary";
import { deriveApertureAttention } from "../../shared/apertureAttention";
import { withinCatalystWindow, SCREENING_CRITERIA } from "../../client/src/components/aperture/DailyPlayList";

// Mirrors shared/disclosure.ts PROHIBITED_LANGUAGE (not exported).
const PROHIBITED_LANGUAGE = /\b(copy\s*congress|follow\s+smart\s+money|insider|conflict|congressional\s+alpha)\b/i;
const UNTRUE = /catastrophic|real-time|realtime|zero delay|automated checkpoint|guarantee|never lose|institutional fund|\$100,000/i;

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const line = (over: Partial<CockpitHeadroomLine>): CockpitHeadroomLine => ({
  key: "daily_planned_risk", label: "Daily planned loss", subject: null, usedCents: 1000, ceilingCents: 10000,
  remainingCents: 9000, usedPct: 0.1, ceilingPct: 1, basis: "recorded", reason: null, ...over,
});
const now = 1_800_000_000_000;
const empty = () => deriveApertureAttention({
  now, mission: null, underwriting: null, evidenceTasks: [], orders: [], activePlays: [], pendingReviews: [], monitoringFindings: [],
  checks: { state: "complete", asOf: now, monitoring: "on_demand" },
}, null);
const queue = (accountCheck: ReturnType<typeof guidedAccountCheck> | null) =>
  renderToStaticMarkup(React.createElement(GuidedDecisionQueue, { attention: empty(), onOpen: () => {}, accountCheck }));

describe("Guided tour copy", () => {
  it("makes no untrue promise and passes the prohibited-language check", () => {
    const text = TOUR_STEPS.flatMap(step => [step.title, step.badge, step.lead, step.description, step.example]).join(" \n ");
    expect(text).not.toMatch(UNTRUE);
    expect(text).not.toMatch(PROHIBITED_LANGUAGE);
    expect(text).toContain("Nothing checks, orders or exits automatically.");
    expect(text).toContain("No real money moves.");
  });
});

describe("Guided all-clear", () => {
  it("is verified only for a recently synced account with every measured limit quiet", () => {
    expect(guidedAccountCheck({ linked: true, stalenessMs: 5 * 60_000 }, [line({})]).verified).toBe(true);
  });
  it.each([
    ["no account", null, [line({})], /No practice account/],
    ["never synced", { linked: true, stalenessMs: null }, [line({})], /never synced/],
    ["stale snapshot", { linked: true, stalenessMs: STALE_ACCOUNT_MS + 1 }, [line({})], /Sync your account/],
    ["near a limit", { linked: true, stalenessMs: 60_000 }, [line({ usedCents: 9000, remainingCents: 1000, usedPct: 0.9 })], /close to a limit/],
    ["unmeasurable", { linked: true, stalenessMs: 60_000 }, [], /couldn't be measured/],
  ] as const)("fails closed: %s", (_name, account, lines, reason) => {
    const check = guidedAccountCheck(account as any, lines as any);
    expect(check.verified).toBe(false);
    expect(check.reason).toMatch(reason);
    const html = queue(check);
    expect(html).not.toMatch(/all clear/i);
    expect(html).toContain("Nothing needs a decision right now");
  });
  it("renders the all-clear only when verified, with no safety claim beyond what was measured", () => {
    const html = queue(guidedAccountCheck({ linked: true, stalenessMs: 60_000 }, [line({})]));
    expect(html).toContain("All clear");
    expect(html).not.toMatch(/safety boundaries|Safe Zone|Guardrails Active/);
  });
});

describe("Reload-only button copy", () => {
  it("never describes the saved-status reload as a price sync", () => {
    const source = readFileSync("client/src/components/aperture/GuidedDecisionQueue.tsx", "utf8");
    expect(source).not.toMatch(/zero delay|Update Market Quotes|syncs the latest paper prices/);
    expect(source).toContain("It doesn't fetch new market prices.");
  });
});

describe("Today queue filter", () => {
  it("uses the recorded catalyst date only", () => {
    expect(Object.keys(SCREENING_CRITERIA)).toEqual(["catalyst_14d"]);
    const day = 86_400_000;
    expect(withinCatalystWindow(now + 3 * day, now)).toBe(true);
    expect(withinCatalystWindow(now + 20 * day, now)).toBe(false);
    expect(withinCatalystWindow(now - day, now)).toBe(false);
    expect(withinCatalystWindow(null, now)).toBe(false);
  });
});

describe("onboarding tour is readable", () => {
  it("uses defined surface tokens, not the undefined bg-surface utilities that left the panel transparent", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("client/src/components/aperture/GuidedOnboardingTour.tsx", "utf8");
    expect(source).not.toMatch(/\b(?:hover:)?bg-surface(?:-2)?\b(?!-)/);
    expect(source).toContain("bg-[var(--sh-surface-1)]");
  });
});
