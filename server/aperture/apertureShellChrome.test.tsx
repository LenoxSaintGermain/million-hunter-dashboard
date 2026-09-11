import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import ApertureShell from "../../client/src/components/aperture/ApertureShell";

vi.mock("wouter", async original => ({ ...await original<typeof import("wouter")>(), useLocation: () => ["/aperture", vi.fn()], Link: ({ children }: any) => children }));
vi.mock("@/components/EditorialTopNav", () => ({ default: ({ children }: any) => React.createElement("div", { "data-top-nav": true }, children) }));
vi.mock("@/components/aperture/CapitalCockpitRail", () => ({ CapitalCockpitRail: () => null }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { defaultWorkspace: "capital_aperture" } }) }));

/**
 * Operator walkthrough measured 211px of shell chrome before any decision text,
 * on every Aperture route: a workspace identity band stacked above the section
 * nav. TSL-BUILD-2026-009 puts the decision first, so the chrome collapses to a
 * single row without losing the paper-only boundary or the workspace identity.
 */
describe("workspace chrome occupies one row, not two", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());
  const $ = () => load(renderToStaticMarkup(React.createElement(ApertureShell, { children: React.createElement("main", null, "decision") })));

  it("keeps the identity, the paper boundary and the menu in one banded row", () => {
    const bar = $()("[data-workspace-bar]");
    expect(bar).toHaveLength(1);
    expect(bar.text()).toContain("Capital Aperture");
    expect(bar.text()).toMatch(/Paper only/i);
    expect(bar.find("nav[aria-label='Capital Aperture workspace menu']")).toHaveLength(1);
  });

  it("drops the second stacked band that duplicated the workspace label", () => {
    // Before: an identity section, then a separate nav section beneath it.
    expect($()("[data-workspace-identity-band]")).toHaveLength(0);
  });

  it("keeps every destination reachable", () => {
    const text = $()("nav[aria-label='Capital Aperture workspace menu']").text();
    for (const label of ["Today", "Mission", "Play Desk", "Research", "Portfolio", "Theses"]) {
      expect(text).toContain(label);
    }
  });

  it("states the paper-only boundary exactly once in the chrome", () => {
    expect($()("[data-workspace-bar]").text().match(/Paper only/gi)).toHaveLength(1);
  });
});
