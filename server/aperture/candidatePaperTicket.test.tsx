import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const trpcCalls = vi.hoisted(() => ({ mutate: vi.fn(), useMutation: vi.fn(), positions: [] as Array<{ symbol: string; marketValueCents: number }> }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ aperture: { invalidate: vi.fn() } }),
  aperture: {
    account: { getPositions: { useQuery: () => ({ data: trpcCalls.positions }) }, list: { useQuery: () => ({ data: [{ id: 5, isPaper: true, brokerId: "alpaca_paper", label: "Illustrative paper", equityValueCents: 10_000_000, buyingPowerCents: 10_000_000 }] }) } },
    // Server headroom for account 5: saved equity $99,577 → single order $4,978.85 (#109).
    cockpit: { useQuery: () => ({ data: { mandate: { maxOrderNotionalCents: 1_000_000 }, headroom: { equityCents: 9_957_700, lines: [{ key: "single_order", label: "Single order", subject: null, usedCents: null, ceilingCents: 497_885, remainingCents: 497_885, usedPct: null, ceilingPct: 5, basis: "", reason: null }, { key: "position", label: "Largest single name", subject: null, usedCents: null, ceilingCents: 995_770, remainingCents: null, usedPct: null, ceilingPct: 10, basis: "", reason: null }] } } }) },
    desk: { summary: { useQuery: () => ({ data: { attention: { mission: { accountId: 5, researchRunId: 77, title: "Illustrative mission" } } }, isLoading: false }) } },
    order: { create: { useMutation: (opts: unknown) => { trpcCalls.useMutation(opts); return { mutate: trpcCalls.mutate, isPending: false }; } } },
  },
} }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/decision/1/revision/2", vi.fn()] }));
vi.mock("@/components/ui/dialog", () => {
  const pass = (tag: string) => ({ children, open: _open, onOpenChange: _change, ...rest }: any) => React.createElement(tag, rest, children);
  return { Dialog: pass("div"), DialogContent: pass("div"), DialogHeader: pass("div"), DialogTitle: pass("h2"), DialogDescription: pass("p"), DialogFooter: pass("div") };
});

import { paperTicketReadiness } from "../../shared/paperTicketPrefill";
import type { TacticalMarketThesis, TradePlayBlueprint } from "../../shared/playUnderwriting";
import { TradePlayCard } from "../../client/src/components/aperture/TradePlayCard";
import { ManualOrderTicketModal } from "../../client/src/components/aperture/ManualOrderTicketModal";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const now = Date.UTC(2026, 9, 7, 15);
function play(overrides: Partial<TradePlayBlueprint> = {}): TradePlayBlueprint {
  return {
    id: "play-test-1", title: "TEST · Illustrative thesis belief", playClass: "pullback", tacticalThesisId: "thesis-1",
    symbol: "TEST", underlyingSymbol: "TEST", instrument: { kind: "shares" }, horizon: "swing",
    trigger: { description: "Validate a hold near the modeled 50.00 reference.", status: "unknown" },
    entry: { low: 50, high: 50, basis: "modeled" },
    invalidation: { description: "Modeled 2% adverse move from the provider-backed reference.", price: 49 },
    targets: [], sizing: { deployableCapitalCents: 800_000, proposedNotionalCents: 250_000, plannedRiskCents: 5_000, maxLossCents: 5_000, percentCapitalAtRisk: 0.6 },
    outcome: { downsideCents: -5_000, expectedLowCents: 5_000, expectedBaseCents: 10_000, expectedHighCents: 15_000, basis: "scenario_modeled" },
    scoring: { conviction: 60, asymmetry: 60, catalyst: 45, timing: 70, liquidity: 50, portfolioFit: 50, evidenceQuality: 60, correlationPenalty: 0, overall: 60 },
    status: "research_required", killAt: null, warnings: [], sourceUrls: [], ...overrides,
  } as TradePlayBlueprint;
}
const thesis = { id: "thesis-1", direction: "bullish" } as TacticalMarketThesis;

describe("mission-result candidate → paper ticket prefill (#22)", () => {
  it("requires the play to be checked (selected with a research run) before a ticket can be prepared", () => {
    expect(paperTicketReadiness({ play: play(), thesis, selectedPlayId: null, researchRunId: null, now }))
      .toEqual({ state: "unavailable", reason: expect.stringContaining("Check this idea first") });
    expect(paperTicketReadiness({ play: play(), thesis, selectedPlayId: "play-test-1", researchRunId: null, now }).state).toBe("unavailable");
    expect(paperTicketReadiness({ play: play(), thesis, selectedPlayId: "play-other", researchRunId: 77, now }))
      .toEqual({ state: "unavailable", reason: expect.stringContaining("Only the play selected for research") });
  });

  it("prefills symbol, side, size, limit, run and the modeled stop for a share play", () => {
    const ticket = paperTicketReadiness({ play: play(), thesis, selectedPlayId: "play-test-1", researchRunId: 77, now });
    expect(ticket.state).toBe("ready");
    if (ticket.state !== "ready") return;
    expect(ticket.prefill).toMatchObject({ symbol: "TEST", direction: "long", expression: "shares", runId: 77,
      holdingPeriod: "swing", limitPrice: "50.00", quantity: 50 });
    expect(ticket.prefill.invalidationCondition).toContain("Modeled stop $49.00");
    expect(ticket.prefill.reason).toContain("confirm them before staging");
  });

  it("leaves unmeasured option premium and strike blank instead of inventing prices", () => {
    const ticket = paperTicketReadiness({ play: play({ instrument: { kind: "long_put", expiration: null, strike: null } }), thesis: { ...thesis, direction: "bearish" }, selectedPlayId: "play-test-1", researchRunId: 77, now });
    expect(ticket.state).toBe("ready");
    if (ticket.state !== "ready") return;
    expect(ticket.prefill).toMatchObject({ direction: "short", expression: "long_put", limitPrice: "", strikePrice: "" });
    expect(ticket.prefill.quantity).toBeUndefined();
  });

  it("refuses spreads and expired or invalidated plays", () => {
    const base = { thesis, selectedPlayId: "play-test-1", researchRunId: 77, now };
    expect(paperTicketReadiness({ ...base, play: play({ instrument: { kind: "debit_spread", direction: "bull" } }) }).state).toBe("unavailable");
    expect(paperTicketReadiness({ ...base, play: play({ status: "expired" }) }).state).toBe("unavailable");
    expect(paperTicketReadiness({ ...base, play: play({ killAt: now - 1 }) }).state).toBe("unavailable");
  });
});

describe("TradePlayCard ticket action (#22)", () => {
  const render = (props: Record<string, unknown>) => load(renderToStaticMarkup(React.createElement(TradePlayCard, {
    rank: 1, play: play(), thesis, portfolioRiskBeforeCents: 0, maxOpenRiskCents: 100_000, busy: false, onValidate: vi.fn(), ...props,
  } as any)));

  it("shows an enabled Prepare paper ticket action for the checked play, with the human-confirmation copy", () => {
    const onPrepareTicket = vi.fn();
    const $ = render({ selected: true, ticket: paperTicketReadiness({ play: play(), thesis, selectedPlayId: "play-test-1", researchRunId: 77, now }), onPrepareTicket });
    const action = $("button").filter((_, el) => $(el).text() === "Prepare paper ticket");
    expect(action).toHaveLength(1);
    expect(action.attr("disabled")).toBeUndefined();
    expect($.text()).toContain("Nothing is staged until you type PAPER; approval and sending stay separate.");
    expect($.text()).toContain("1 Check idea · 2 Review research · 3 Prepare paper ticket");
    expect(onPrepareTicket).not.toHaveBeenCalled();
  });

  it("explains why the ticket action is disabled before the idea is checked", () => {
    const $ = render({ selected: false, ticket: paperTicketReadiness({ play: play(), thesis, selectedPlayId: null, researchRunId: null, now }), onPrepareTicket: vi.fn() });
    const action = $("button").filter((_, el) => $(el).text() === "Prepare paper ticket");
    expect(action.attr("disabled")).toBeDefined();
    expect($.text()).toContain("Check this idea first.");
    expect($("button span").first().text()).toBe("Check this idea");
  });

  it("keeps the card unchanged where no ticket flow is offered", () => {
    const $ = render({ selected: false });
    expect($("button")).toHaveLength(1);
    expect($.text()).toContain("Review the remaining evidence checks. No order is created.");
  });
});

describe("ticket builder opened from a candidate (#22)", () => {
  it("opens prefilled and creates nothing until the operator confirms", () => {
    const ticket = paperTicketReadiness({ play: play(), thesis, selectedPlayId: "play-test-1", researchRunId: 77, now });
    if (ticket.state !== "ready") throw new Error("expected ready");
    const $ = load(renderToStaticMarkup(React.createElement(ManualOrderTicketModal, { open: true, onOpenChange: vi.fn(), initialValues: ticket.prefill })));
    expect($("input[placeholder='e.g. NVDA, VRT']").attr("value")).toBe("TEST");
    expect($("input[placeholder='PAPER']").attr("value")).toBe("");
    expect($.text()).toContain("Type PAPER to acknowledge this practice ticket.");
    const stage = $("button").filter((_, el) => $(el).text().includes("Stage Paper Order on Desk"));
    expect(stage.attr("disabled")).toBeDefined();
    expect($.text()).toContain("Stage Paper Order on Desk ($2,500)");
    expect(trpcCalls.mutate).not.toHaveBeenCalled();
  });

  it("shows the server's single-order limit, not a client recomputation, and explains it (#109)", () => {
    const ticket = paperTicketReadiness({ play: play(), thesis, selectedPlayId: "play-test-1", researchRunId: 77, now });
    if (ticket.state !== "ready") throw new Error("ticket not ready");
    const $ = load(renderToStaticMarkup(React.createElement(ManualOrderTicketModal, { open: true, onOpenChange: vi.fn(), initialValues: ticket.prefill })));
    const text = $.text();
    expect(text).toContain("Single-Order Limit: $4,978.85");
    // Live list equity is $100,000; the client must not turn that into $5,000.
    expect(text).not.toContain("$5,000");
    expect(text).toContain("5% of your account value, never more than $10,000");
    expect(text).toContain("of the $4,978.85 limit");
  });

  it("warns before staging when the order would put too much in one company, from the server's numbers (#109)", () => {
    const ticket = paperTicketReadiness({ play: play(), thesis, selectedPlayId: "play-test-1", researchRunId: 77, now });
    if (ticket.state !== "ready") throw new Error("ticket not ready");
    const render = () => load(renderToStaticMarkup(React.createElement(ManualOrderTicketModal, { open: true, onOpenChange: vi.fn(), initialValues: ticket.prefill })));
    trpcCalls.positions = [];
    let $ = render();
    expect($("[data-single-name-warning]")).toHaveLength(0);
    expect($.text()).toContain("One-company limit: 10% of your account value in any one company ($9,957.70).");
    trpcCalls.positions = [{ symbol: "TEST", marketValueCents: 900_000 }, { symbol: "OTHER", marketValueCents: 900_000 }];
    $ = render();
    const warning = $("[data-single-name-warning]").text();
    expect(warning).toContain("you would hold $11,500 of TEST (you already hold $9,000)");
    expect(warning).toContain("over the limit of 10% of your account value in any one company ($9,957.70)");
    expect(warning).not.toMatch(/conflict|insider/i);
    trpcCalls.positions = [];
  });
});

