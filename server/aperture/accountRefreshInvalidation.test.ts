import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCQueryUtils, createTRPCReact, getQueryKey } from "@trpc/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRouter } from "../routers";

// Only the transport/hook boundary is substituted. Invalidation, query keys,
// active read observers, the page callbacks and the rail rendering are real.
const boundary = vi.hoisted(() => ({
  utils: null as any,
  read: null as any,
  sync: null as any,
  mutate: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/accounts", boundary.navigate] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/lib/trpc", () => {
  const query = (path: string) => ({ useQuery: (input?: unknown) => boundary.read(path, input) });
  const mutation = { useMutation: () => ({ mutate: boundary.mutate, isPending: false }) };
  return { trpc: {
    useUtils: () => boundary.utils,
    aperture: {
      brokers: { useQuery: () => ({ data: [] }) },
      account: {
        list: query("account.list"), getPositions: query("account.getPositions"),
        listActivePlays: { useQuery: () => ({ data: [] }) },
        create: mutation, configureSyncSchedule: mutation, importCsv: mutation,
        upsertActivePlay: mutation, removeActivePlay: mutation,
        sync: { useMutation: (options: unknown) => { boundary.sync = options; return { mutate: boundary.mutate, isPending: false }; } },
      },
      cockpit: query("cockpit"),
      cockpitPreference: { get: { useQuery: () => ({ data: null }) }, set: mutation },
    },
  } };
});
import ApertureAccounts from "../../client/src/pages/aperture/ApertureAccounts";
import { CapitalCockpitRail } from "../../client/src/components/aperture/CapitalCockpitRail";

const api = createTRPCReact<AppRouter>();
const now = Date.UTC(2026, 8, 13, 14);
const staleAt = now - 42 * 3_600_000;
const account = (id: number, lastSyncedAt = staleAt) => ({
  id, label: `Illustrative paper account ${id}`, brokerId: "alpaca_paper", isPaper: true,
  cashCents: 120000, equityValueCents: 240000, lastSyncedAt,
});
const cockpit = (id: number, lastSyncedAt = staleAt) => ({
  account: { ...account(id, lastSyncedAt), stalenessMs: now - lastSyncedAt },
  activeThesis: null, session: { session: "closed", msToNextBoundary: null },
  mandate: { version: "illustrative", maxOrderNotionalCents: 100000 },
  headroom: { lines: [] },
});

describe("Refresh balances cache recovery", () => {
  let client: QueryClient;
  let refreshed: boolean;
  let stops: Array<() => void>;
  const reads = new Map<string, QueryObserver<any>>();
  const keyFor = (path: string, input?: any) => {
    const procedure = path.split(".").reduce((node: any, part) => node[part], api.aperture);
    return getQueryKey(procedure, input, "query");
  };
  function observe(path: string, input: unknown, data: (fresh: boolean) => unknown) {
    const queryKey = keyFor(path, input);
    client.setQueryData(queryKey, data(false));
    const observer = new QueryObserver(client, { queryKey, queryFn: async () => data(refreshed), staleTime: Infinity });
    stops.push(observer.subscribe(() => {}));
    reads.set(JSON.stringify(queryKey), observer);
    return observer;
  }
  const rail = (runId?: number) => renderToStaticMarkup(React.createElement(CapitalCockpitRail, { runId }));
  beforeEach(() => {
    vi.stubGlobal("React", React);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    refreshed = false; stops = []; reads.clear(); boundary.mutate.mockClear(); boundary.navigate.mockClear();
    // A fail-fast transport guarantees the test cannot contact any backend.
    boundary.utils = createTRPCQueryUtils({ queryClient: client, client: createTRPCClient<AppRouter>({
      links: [() => () => { throw new Error("Unexpected transport call"); }],
    }) });
    boundary.read = (path: string, input?: unknown) => {
      const observer = reads.get(JSON.stringify(keyFor(path, input)));
      if (!observer) throw new Error(`Unexpected read: ${path} ${JSON.stringify(input)}`);
      return observer.getCurrentResult();
    };
    observe("account.list", undefined, (fresh) => [account(77, fresh ? now : staleAt), account(88)]);
    observe("account.getPositions", { accountId: 77 }, (fresh) => fresh ? [{ symbol: "TEST", qty: 2, marketValueCents: 10000 }] : []);
    observe("account.getPositions", { accountId: 88 }, () => []);
    observe("cockpit", { accountId: 77 }, (fresh) => cockpit(77, fresh ? now : staleAt));
    renderToStaticMarkup(React.createElement(ApertureAccounts));
  });
  afterEach(() => {
    stops.forEach((stop) => stop()); client.clear(); vi.unstubAllGlobals();
  });

  it("updates the active rail read from synced 42h ago to synced just now after a successful refresh", async () => {
    expect(rail()).toContain("synced 42h ago");
    refreshed = true; // successful broker response has persisted a fresh snapshot
    await boundary.sync.onSuccess({ synced: 1, cashCents: 120000 }, { id: 77 });
    await vi.waitFor(() => expect(rail()).toContain("synced just now"));
    expect(rail()).not.toContain("synced 42h ago");
    expect(boundary.navigate).not.toHaveBeenCalled();
    expect(boundary.mutate).not.toHaveBeenCalled();
  });

  it("refreshes the synced account's holdings and the desk's balance/mark summary", async () => {
    const desk = observe("desk.summary", undefined, (fresh) => ({
      account: account(77, fresh ? now : staleAt),
      latestMark: { marketValueCents: fresh ? 10000 : 5000 },
    }));
    refreshed = true;
    await boundary.sync.onSuccess({ synced: 1, cashCents: 120000 }, { id: 77 });
    expect(boundary.read("account.getPositions", { accountId: 77 }).data).toEqual([
      { symbol: "TEST", qty: 2, marketValueCents: 10000 },
    ]);
    expect(desk.getCurrentResult().data).toEqual({
      account: account(77, now), latestMark: { marketValueCents: 10000 },
    });
  });

  it.each([undefined, {}, { runId: 501 }, { accountId: 77, runId: 501 }])(
    "refreshes cockpit reads using input %j, not just the account-only key",
    async (input) => {
      const read = observe("cockpit", input, (fresh) => cockpit(77, fresh ? now : staleAt));
      refreshed = true;
      await boundary.sync.onSuccess({ synced: 1 }, { id: 77 });
      expect(read.getCurrentResult().data.account.lastSyncedAt).toBe(now);
      if (input?.runId && !input.accountId) expect(rail(input.runId)).toContain("synced just now");
    },
  );

  it("marks inactive cockpit/desk reads stale for the next visit without fetching them", async () => {
    const cockpitKey = keyFor("cockpit", { runId: 909 });
    const deskKey = keyFor("desk.summary");
    client.setQueryData(cockpitKey, cockpit(77));
    client.setQueryData(deskKey, { account: account(77) });
    refreshed = true;
    await boundary.sync.onSuccess({ synced: 1 }, { id: 77 });
    expect(client.getQueryState(cockpitKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(deskKey)?.isInvalidated).toBe(true);
    expect(client.getQueryData(cockpitKey)).toEqual(cockpit(77));
  });

  it("keeps an existing run's account context and leaves unrelated reads alone", async () => {
    observe("cockpit", { runId: 808 }, () => cockpit(88));
    const untouched = [
      ["account.getPositions", { accountId: 88 }],
      ["account.listActivePlays", { accountId: 77 }],
      ["cockpitPreference.get", undefined],
      ["runway.pending", undefined],
      ["play.list", undefined],
    ] as const;
    for (const [path, input] of untouched) {
      // Active fixture reads change if fetched: catches overly broad invalidation.
      observe(path, input, (fresh) => ({ preserved: !fresh }));
    }
    const before = rail(808);
    refreshed = true;
    await boundary.sync.onSuccess({ synced: 1 }, { id: 77 });
    expect(rail(808)).toBe(before);
    expect(rail(808)).toContain("Illustrative paper account 88");
    for (const [path, input] of untouched) {
      expect(boundary.read(path, input).data).toEqual({ preserved: true });
    }
    expect(boundary.navigate).not.toHaveBeenCalled();
    expect(boundary.mutate).not.toHaveBeenCalled();
  });

  it("leaves dependent caches unchanged while pending and after a failed refresh", async () => {
    const desk = observe("desk.summary", undefined, (fresh) => ({ lastSyncedAt: fresh ? now : staleAt }));
    // A changed backend fixture exposes even an unnecessary refetch on failure.
    // The old dependent reads must stay intact until THIS sync succeeds.
    refreshed = true;
    let rejectRefresh!: (error: Error) => void;
    const response = new Promise<never>((_, reject) => { rejectRefresh = reject; });
    const observer = new MutationObserver(client, { ...boundary.sync, mutationFn: () => response });
    const result = observer.mutate({ id: 77 });
    const failure = expect(result).rejects.toThrow("Broker unavailable");
    await vi.waitFor(() => expect(observer.getCurrentResult().isPending).toBe(true));
    expect(rail()).toContain("synced 42h ago");
    expect(boundary.read("account.getPositions", { accountId: 77 }).data).toEqual([]);
    expect(desk.getCurrentResult().data).toEqual({ lastSyncedAt: staleAt });
    rejectRefresh(new Error("Broker unavailable"));
    await failure;
    expect(rail()).toContain("synced 42h ago");
    expect(rail()).not.toContain("synced just now");
    expect(boundary.read("account.getPositions", { accountId: 77 }).data).toEqual([]);
    expect(desk.getCurrentResult().data).toEqual({ lastSyncedAt: staleAt });
    expect(boundary.navigate).not.toHaveBeenCalled();
    expect(boundary.mutate).not.toHaveBeenCalled();
  });
});
