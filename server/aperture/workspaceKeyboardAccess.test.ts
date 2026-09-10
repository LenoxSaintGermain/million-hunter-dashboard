import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({
  useLocation: () => ["/aperture/mission", vi.fn()],
  Link: ({ href, children, ...props }: any) => React.createElement("a", { href, ...props }, children),
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "capital_operator", defaultWorkspace: "capital_aperture_trader" }, isAuthenticated: true, logout: vi.fn() }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { publicDeals: { search: { useQuery: () => ({ data: [], isLoading: false }) } } } }));
vi.mock("@/components/aperture/CapitalCockpitRail", () => ({ CapitalCockpitRail: () => React.createElement("section", { "aria-label": "Account and constraints" }, "Illustrative Paper · Constraint unavailable") }));
import ApertureShell from "../../client/src/components/aperture/ApertureShell";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
describe("workspace keyboard entry", () => {
  it("provides a first-focus skip link to one named main landmark, retaining account warnings", () => {
    const $ = load(renderToStaticMarkup(React.createElement(ApertureShell, {}, React.createElement("h1", {}, "Illustrative mission"))));
    const first = $("a,button,input,select,textarea,summary").first();
    expect(first.text()).toBe("Skip to workspace");
    expect(first.attr("href")).toBe("#aperture-workspace");
    expect(first.attr("class")).toContain("focus:not-sr-only");
    expect(first.attr("class")).toContain("focus:min-h-11");
    expect($("main")).toHaveLength(1);
    expect($("main").attr("id")).toBe("aperture-workspace");
    expect($("main").attr("tabindex")).toBe("-1");
    expect($("main").attr("aria-label")).toBe("Capital Aperture workspace");
    expect($("main [aria-label='Account and constraints']").text()).toContain("Constraint unavailable");
    expect($("main h1").text()).toBe("Illustrative mission");
  });
});
