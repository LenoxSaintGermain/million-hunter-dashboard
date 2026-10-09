/**
 * POC v3 parity PR-03 (front-end half of #6): one active-thesis selector that
 * reads only thesis.activeCapital, never a stale isPrimary projection, and
 * hides test/UAT theses unless asked. The active thesis is never hidden.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isTestThesisName, resolveActiveThesis, thesisOptions } from "../../shared/activeThesis";

const fixture = vi.hoisted(() => ({ active: undefined as any, list: [] as any[], mutate: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({}),
  thesis: { activeCapital: { useQuery: () => ({ data: fixture.active, isLoading: fixture.active === undefined }) } },
  aperture: { thesis: {
    list: { useQuery: () => ({ data: fixture.list }) },
    activate: { useMutation: () => ({ mutate: fixture.mutate, isPending: false }) },
  } },
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ActiveThesisSelect } from "../../client/src/components/aperture/ActiveThesisSelect";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const TLT = { id: 11, name: "UAT — TLT Payroll Confirmation (Concise)", sourceCompilationId: 101, isPrimary: true, status: "active" };
const NEW = { id: 12, name: "Rate cuts lift small banks", sourceCompilationId: 1290001, isPrimary: false, status: "active" };
const OTHER = { id: 13, name: "GLP-1 supply catch-up", sourceCompilationId: 103, isPrimary: false, status: "active" };
beforeEach(() => { fixture.active = undefined; fixture.list = [TLT, NEW, OTHER]; fixture.mutate.mockReset(); });

describe("test thesis names", () => {
  it.each([
    "UAT — TLT Payroll Confirmation (Concise)", "UAT - draft", "[UAT] momentum", "TEST: anything", "qa · scratch", "(Test) thesis", "UAT",
  ])("hides %s", (name) => expect(isTestThesisName(name)).toBe(true));
  it.each([
    "Rate cuts lift small banks", "Testing season for retailers", "Quantum chips", "UATX restructuring", "Latest QA-backed review", null,
  ])("keeps %s", (name) => expect(isTestThesisName(name as any)).toBe(false));
});

describe("resolveActiveThesis", () => {
  it("never falls back to an isPrimary projection once activeCapital has answered (#6)", () => {
    expect(resolveActiveThesis({ activeLoaded: true, active: { id: 1290001 }, projections: [TLT, NEW] })).toEqual({ state: "matched", selectedId: "12" });
    expect(resolveActiveThesis({ activeLoaded: true, active: { id: 999, name: "Brand new" }, projections: [TLT, NEW] }))
      .toEqual({ state: "not_prepared", selectedId: "", activeName: "Brand new" });
    expect(resolveActiveThesis({ activeLoaded: true, active: null, projections: [TLT, NEW] })).toEqual({ state: "none", selectedId: "" });
    expect(resolveActiveThesis({ activeLoaded: false, active: null, projections: [TLT, NEW] }).state).toBe("loading");
  });
  it("hides test theses but always keeps the selected one", () => {
    expect(thesisOptions([TLT, NEW, OTHER], { showTest: false }).visible.map((t) => t.id)).toEqual([12, 13]);
    expect(thesisOptions([TLT, NEW, OTHER], { showTest: false }).hiddenCount).toBe(1);
    expect(thesisOptions([TLT, NEW, OTHER], { showTest: false, keepId: "11" }).visible.map((t) => t.id)).toEqual([11, 12, 13]);
    expect(thesisOptions([TLT, NEW, OTHER], { showTest: true }).visible).toHaveLength(3);
  });
});

describe("ActiveThesisSelect", () => {
  it("selects the activeCapital thesis, not the stale UAT isPrimary projection, and hides UAT", () => {
    fixture.active = { thesis: { id: 1290001, name: NEW.name } };
    const $ = load(renderToStaticMarkup(<ActiveThesisSelect />));
    expect($("select option[selected]").text()).toBe(NEW.name);
    expect($("select").text()).not.toContain("UAT");
    expect($.text()).toContain("Show 1 test thesis");
    expect($.text()).toContain("Every step uses this thesis.");
  });
  it("says the active thesis isn't prepared instead of selecting another one", () => {
    fixture.active = { thesis: { id: 999, name: "Brand new thesis" } };
    const $ = load(renderToStaticMarkup(<ActiveThesisSelect />));
    expect($("select option[selected]").text()).toBe("Brand new thesis · not yet prepared for Capital");
    expect($("[data-active-thesis]").attr("data-active-thesis")).toBe("not_prepared");
  });
  it("keeps an active test thesis visible and labelled", () => {
    fixture.active = { thesis: { id: 101, name: TLT.name } };
    const $ = load(renderToStaticMarkup(<ActiveThesisSelect />));
    expect($("select option[selected]").text()).toBe(`${TLT.name} (test)`);
  });
  it("is the only thesis control in the cockpit rail and the library drops the isPrimary fallback", () => {
    const rail = readFileSync("client/src/components/aperture/CapitalCockpitRail.tsx", "utf8");
    expect(rail.match(/<ActiveThesisSelect/g)).toHaveLength(2);
    expect(rail).not.toContain("currentActiveThesisId");
    expect(rail).not.toContain("Active Research Lens");
    // The selector replaces the read-only "Active thesis" cell in the account bar.
    expect(rail).not.toContain('label="Active thesis"');
    expect(rail).not.toContain("Explain active thesis");
    const library = readFileSync("client/src/pages/aperture/ApertureTheses.tsx", "utf8");
    expect(library).not.toMatch(/\|\| thesis\.isPrimary/);
    expect(library).not.toMatch(/\|\| t\.isPrimary/);
    const portrait = readFileSync("client/src/components/aperture/MandateRiskPortrait.tsx", "utf8");
    expect(portrait).not.toMatch(/\|\| thesis\.isPrimary/);
  });
});
