import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CapitalCockpitRail } from "../../client/src/components/aperture/CapitalCockpitRail";

const mocks = vi.hoisted(() => ({
  account: { data: undefined as any, isLoading: true, error: null as any, refetch: vi.fn() },
  cockpit: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: {
  account: { list: { useQuery: () => mocks.account } },
  cockpit: { useQuery: mocks.cockpit },
  cockpitPreference: { get: { useQuery: () => ({ data: null }) }, set: { useMutation: () => ({ mutate: vi.fn() }) } },
} } }));

describe("cold-device account constraint hydration", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());
  it("does not query an unscoped account while named accounts are loading", () => {
    mocks.account.data = undefined; mocks.account.isLoading = true; mocks.account.error = null;
    mocks.cockpit.mockReturnValue({ data: undefined, isLoading: false, error: null });
    const html = renderToStaticMarkup(React.createElement(CapitalCockpitRail));
    expect(mocks.cockpit.mock.lastCall?.[1].enabled).toBe(false);
    expect(html).toContain("Loading paper-research context");
    expect(html).not.toContain("Account not selected");
    expect(html).not.toContain("No paper account");
  });
  it("binds the cockpit read to the resolved paper account", () => {
    mocks.account.data = [{ id: 77, isPaper: true, brokerId: "alpaca_paper" }]; mocks.account.isLoading = false;
    mocks.cockpit.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderToStaticMarkup(React.createElement(CapitalCockpitRail));
    expect(mocks.cockpit.mock.lastCall?.[0]).toEqual({ accountId: 77 });
    expect(mocks.cockpit.mock.lastCall?.[1].enabled).toBe(true);
  });
  it("reports failed hydration without raw SQL or a false no-account state", () => {
    mocks.account.data = undefined; mocks.account.error = { message: "PRIVATE_SQL_SENTINEL" }; mocks.account.isLoading = false;
    const html = renderToStaticMarkup(React.createElement(CapitalCockpitRail));
    expect(html).toContain("constraints could not be verified");
    expect(html).toContain("Retry account context");
    expect(html).not.toContain("PRIVATE_SQL_SENTINEL");
    expect(mocks.cockpit.mock.lastCall?.[1].enabled).toBe(false);
  });
});
