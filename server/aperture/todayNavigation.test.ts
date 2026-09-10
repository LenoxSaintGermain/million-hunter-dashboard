import React from "react";
import { beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ navigate: vi.fn(), reload: vi.fn(), mutate: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof React>(),
  useState: (value: unknown) => [value, vi.fn()],
  useMemo: (read: () => unknown) => read(), useEffect: vi.fn(),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture", f.navigate] }));
vi.mock("@/lib/trpc", () => {
  const query = { useQuery: () => ({ data: undefined, isLoading: false, isFetching: false, error: null }) };
  const mutation = { useMutation: () => ({ mutate: f.mutate }) };
  return { trpc: { aperture: {
    play: { list: query, decide: mutation }, desk: { summary: query },
    account: { list: query }, cockpit: query, runway: { latest: query },
    ledger: { captureCurrentWindow: mutation },
  }, thesis: { activeCapital: query }, useUtils: () => ({}) } };
});
import { DailyPlayList } from "../../client/src/components/aperture/DailyPlayList";
import { TodayAttentionBriefing } from "../../client/src/components/aperture/TodayAttentionBriefing";

beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React);
  vi.stubGlobal("window", { location: { assign: f.reload } });
});

it("opens the exact finding through the same application router as Play Desk without reloading or mutating", () => {
  const tree = DailyPlayList({ onNewMission: vi.fn(), onNewResearch: vi.fn(), onOpenRun: vi.fn() });
  const briefing = React.Children.toArray(tree.props.children).find((node: any) => node.type === TodayAttentionBriefing) as React.ReactElement<any>;
  const href = "/aperture/run/360001/execute?candidate=240003&lifecycle=monitoring&order=2&finding=120001&findingVersion=v1-951cb173";
  expect(f.navigate).not.toHaveBeenCalled();
  briefing.props.onOpen(href);
  expect(f.navigate).toHaveBeenCalledTimes(1);
  expect(f.navigate).toHaveBeenCalledWith(href);
  expect(f.reload).not.toHaveBeenCalled();
  expect(f.mutate).not.toHaveBeenCalled();
});
