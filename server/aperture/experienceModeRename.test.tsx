/**
 * Owner decision (parity plan, mode names): the modes are shown as Quick Play
 * (was Guided) and Strategist (was Pro). Stored values and identifiers stay
 * "guided" / "pro" so saved preferences keep working.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  EXPERIENCE_MODE_LABELS,
  ExperienceModeProvider,
  ExperienceModeToggle,
} from "../../client/src/contexts/ExperienceModeContext";

beforeAll(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

function renderWithSaved(saved: string | null) {
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", { localStorage: { getItem: () => saved, setItem: () => undefined } });
  return load(renderToStaticMarkup(<ExperienceModeProvider><ExperienceModeToggle /></ExperienceModeProvider>));
}

describe("experience mode names", () => {
  it("labels the stored modes with the POC names", () => {
    expect(EXPERIENCE_MODE_LABELS).toEqual({ guided: "Quick Play", pro: "Strategist" });
  });

  it("keeps a saved 'pro' preference and shows it as Strategist", () => {
    const $ = renderWithSaved("pro");
    expect($("[role=radio][aria-checked=true]").text()).toBe("Strategist");
    expect($("[role=radio][aria-checked=false]").text()).toBe("Quick Play");
  });

  it("keeps a saved 'guided' preference (and the default) as Quick Play", () => {
    expect(renderWithSaved("guided")("[role=radio][aria-checked=true]").text()).toBe("Quick Play");
    expect(renderWithSaved(null)("[role=radio][aria-checked=true]").text()).toBe("Quick Play");
  });

  it("no longer shows the old names in the toggle or the Today queue", () => {
    const $ = renderWithSaved("guided");
    expect($.text()).not.toMatch(/Guided|On-Rails|Pro Cockpit/);
    const context = readFileSync("client/src/contexts/ExperienceModeContext.tsx", "utf8");
    expect(context).toContain('const STORAGE_KEY = "sh_aperture_experience_mode";');
    const queue = readFileSync("client/src/components/aperture/GuidedDecisionQueue.tsx", "utf8");
    expect(queue).toContain("Today's Action Queue (Quick Play)");
    expect(queue).not.toContain("(Guided)");
    // bg-surface is not a theme colour; the toggle and queue were transparent.
    expect(context).not.toMatch(/ bg-surface /);
    expect(queue).not.toMatch(/ bg-surface /);
  });
});
