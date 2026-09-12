import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ accounts: {} as any, brokers: {} as any, positions: {} as any, plays: {} as any, mutate: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/accounts", vi.fn()] }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutate: state.mutate, isPending: false }) };
  const query = (key: "accounts" | "brokers" | "positions" | "plays") => ({ useQuery: () => ({ refetch: vi.fn(), ...state[key] }) });
  return { trpc: { useUtils: () => ({}), aperture: {
    brokers: query("brokers"), account: { list: query("accounts"), getPositions: query("positions"), listActivePlays: query("plays"), create: mutation, sync: mutation, configureSyncSchedule: mutation, importCsv: mutation, upsertActivePlay: mutation, removeActivePlay: mutation },
  } } };
});
import ApertureAccounts from "../../client/src/pages/aperture/ApertureAccounts";
import { AccountContextPanel } from "../../client/src/components/aperture/AccountContextPanel";
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { state.accounts = {}; state.brokers = {}; state.positions = {}; state.plays = {}; state.mutate.mockClear(); });
const account = { id: 1, label: "Illustrative UAT account", brokerId: "alpaca_paper", isPaper: true, cashCents: 120000, equityValueCents: 240000, syncScheduleEnabled: false };
const render = () => load(renderToStaticMarkup(<ApertureAccounts />));

describe("Portfolio status and disclosure", () => {
  it("does not turn loading accounts into an empty portfolio", () => {
    state.accounts = { isLoading: true };
    const $ = render();
    expect($("[role=status]").text()).toContain("Loading accounts");
    expect($.text()).not.toContain("No accounts yet");
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("does not turn a failed empty response into no accounts", () => {
    state.accounts = { data: [], isError: true };
    const $ = render();
    expect($("[role=alert]").text()).toContain("Account refresh failed");
    expect($.text()).toContain("Retry accounts");
    expect($.text()).not.toContain("No accounts yet");
  });
  it("keeps cached balances visible alongside a refresh warning", () => {
    state.accounts = { data: [account], isError: true };
    const $ = render();
    expect($.text()).toContain("$1,200");
    expect($("[role=alert]").text()).toContain("may be out of date");
  });
  it("keeps broker uncertainty visible outside optional details", () => {
    state.accounts = { data: [account] }; state.brokers = { isError: true };
    const $ = render();
    expect($("[role=alert]").text()).toContain("connection status is unavailable");
    expect($("[role=alert]").parents("details")).toHaveLength(0);
    expect($.text()).toContain("Connect the broker before changing automatic updates");
  });
  it("leads with accounts and folds background instruction without mutating", () => {
    state.accounts = { data: [account] };
    state.brokers = { data: [{ id: "alpaca_paper", label: "Alpaca Paper", available: true, capabilities: { constraints: ["Illustrative execution restriction"] } }] };
    const $ = render();
    expect($("h1").text()).toBe("Portfolio");
    expect($("details summary").text()).toContain("Connections and order safeguards");
    expect($("details[open]")).toHaveLength(0);
    expect($.text()).toContain("Illustrative execution restriction");
    expect($.text()).toContain("Automatic balance updates · Off");
    expect($.text()).toContain("not play monitoring or orders");
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("distinguishes unknown, failed and measured-empty holdings", () => {
    const panel = () => load(renderToStaticMarkup(<AccountContextPanel accountId={1} />));
    expect(panel().text()).toContain("Loading holdings");
    expect(panel().text()).not.toContain("0 held tickers");
    state.positions = { isError: true }; state.plays = { data: [] };
    expect(panel().text()).toContain("Holdings unavailable");
    expect(panel().text()).toContain("Retry portfolio data");
    state.positions = { data: [] };
    expect(panel().text()).toContain("0 held tickers");
    expect(state.mutate).not.toHaveBeenCalled();
  });
});
