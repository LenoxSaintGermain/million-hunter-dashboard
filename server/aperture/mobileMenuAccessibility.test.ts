import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import EditorialTopNav from "../../client/src/components/EditorialTopNav";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Fixture", role: "admin" }, isAuthenticated: true, logout: vi.fn() }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { publicDeals: { search: { useQuery: () => ({ data: undefined, isLoading: false }) } } } }));
vi.mock("wouter", () => ({
  useLocation: () => ["/aperture/mission", vi.fn()],
  Link: ({ href, children, ...props }: any) => React.createElement("a", { href, ...props }, children),
}));
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("UAT mobile navigation", () => {
  it("renders a named 44px dialog trigger with closed state and content association", () => {
    const $ = load(renderToStaticMarkup(React.createElement(EditorialTopNav, { children: "Fixture page" })));
    const trigger = $('button[aria-label="Open navigation menu"]');
    expect(trigger).toHaveLength(1);
    expect(trigger.attr("aria-haspopup")).toBe("dialog");
    expect(trigger.attr("aria-expanded")).toBe("false");
    expect(trigger.attr("aria-controls")).toBeTruthy();
    expect(trigger.attr("class")).toContain("h-11");
    expect(trigger.attr("class")).toContain("w-11");
  });

  it("provides an accessible dialog title and locally enlarges the close control", () => {
    const source = readFileSync("client/src/components/EditorialTopNav.tsx", "utf8");
    expect(source).toContain("<SheetTitle");
    expect(source).toContain('aria-describedby={undefined}');
    expect(source).toContain("[&>button]:min-h-11");
    expect(source).toContain("[&>button]:min-w-11");
  });
});
