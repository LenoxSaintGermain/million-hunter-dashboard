import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import ApertureMission from "../../client/src/pages/aperture/ApertureMission";

const fixture = vi.hoisted(() => ({ search: "", receipt: false, params: {} as any,
  capability: {} as any, navigate: vi.fn(), flow: vi.fn(), runway: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/mission", fixture.navigate],
  useSearch: () => fixture.search, useRoute: () => [fixture.receipt, fixture.params] }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { strategy: {
  capabilities: { useQuery: () => fixture.capability },
} } } }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => <main>{children}</main> }));
vi.mock("@/components/aperture/DecisionRunway", () => ({ DecisionRunway: (props: any) => {
  fixture.runway(props); return <section>Saved Mission routing</section>;
} }));
vi.mock("@/components/aperture/ObjectiveMissionFlow", () => ({ ObjectiveMissionFlow: (props: any) => {
  fixture.flow(props); return <section>Objective controller</section>;
} }));

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("React", React); fixture.search = "";
  fixture.receipt = false; fixture.params = {}; fixture.capability = { data: { enabled: true } }; });
afterEach(() => vi.unstubAllGlobals());

function elements(node: React.ReactNode): React.ReactElement<any>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<{ children?: React.ReactNode }>(child)
    ? [child, ...elements(child.props.children)] : []);
}

describe("Mission objective entry routing (isolated rendering, not browser UAT)", () => {
  it("retains saved Mission routing until the operator explicitly opens an objective", () => {
    const tree = ApertureMission(); const $ = load(renderToStaticMarkup(tree));
    expect(fixture.runway).toHaveBeenCalledWith(expect.objectContaining({ receiptTarget: null }));
    expect(fixture.flow).not.toHaveBeenCalled(); expect(fixture.navigate).not.toHaveBeenCalled();
    expect($.text()).toContain("Explore a capital objective");
    const action = elements(tree).find(node => node.props.children === "Explore a capital objective")!;
    expect(action.props.className).toContain("min-h-11");
    action.props.onClick(); expect(fixture.navigate).toHaveBeenCalledOnce();
    expect(fixture.navigate).toHaveBeenCalledWith("/aperture/mission?objective=1");
  });
  it.each([{ isLoading: true }, { error: new Error("Unavailable") }, { data: { enabled: false } }])(
    "does not advertise objective execution without a confirmed capability", (capability) => {
      fixture.capability = capability; const $ = load(renderToStaticMarkup(ApertureMission()));
      expect($.text()).not.toContain("Explore a capital objective");
      expect(fixture.flow).not.toHaveBeenCalled(); expect(fixture.navigate).not.toHaveBeenCalled();
    });
  it("opens the objective controller only for the deliberate objective route", () => {
    fixture.search = "objective=1"; renderToStaticMarkup(ApertureMission());
    expect(fixture.flow).toHaveBeenCalledOnce(); expect(fixture.flow).toHaveBeenCalledWith({ newObjective: true });
    expect(fixture.runway).not.toHaveBeenCalled(); expect(fixture.navigate).not.toHaveBeenCalled();
  });
  it("keeps an exact receipt ahead of a conflicting new-objective query", () => {
    fixture.search = "objective=1"; fixture.receipt = true; fixture.params = { decisionRunId: "77", revisionId: "88" };
    renderToStaticMarkup(ApertureMission());
    expect(fixture.runway).toHaveBeenCalledWith(expect.objectContaining({ receiptTarget: { decisionRunId: 77, revisionId: 88 } }));
    expect(fixture.flow).not.toHaveBeenCalled(); expect(fixture.navigate).not.toHaveBeenCalled();
  });
  it.each(["0", "-1", "missing", "9007199254740992"])("does not reinterpret malformed receipt %s as a new Mission", (decisionRunId) => {
    fixture.search = "objective=1"; fixture.receipt = true; fixture.params = { decisionRunId, revisionId: "88" };
    const $ = load(renderToStaticMarkup(ApertureMission()));
    expect($("[role=alert]").text()).toContain("Mission link is incomplete");
    expect(fixture.runway).not.toHaveBeenCalled(); expect(fixture.flow).not.toHaveBeenCalled();
    expect(fixture.navigate).not.toHaveBeenCalled();
  });
});
