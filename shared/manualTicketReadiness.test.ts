import { describe, expect, it } from "vitest";
import { manualTicketBlocker } from "./manualTicketReadiness";
import { readFileSync } from "node:fs";
const valid = { expression: "shares", missionAccountId: 12, accountId: 12, runId: 5,
  brokerId: "alpaca_paper", equityCents: 1_000_000, notionalCents: 1_000,
  buyingPowerCents: 10_000, exceedsLimit: false, acknowledgement: "PAPER" };
describe("manual ticket fail-closed guidance", () => {
  it("allows a fully specified single-leg practice ticket", () => expect(manualTicketBlocker(valid)).toBeNull());
  it.each(["bull_call_spread", "bear_put_spread", "bull_put_credit_spread", "collar_hedge"])("never flattens %s into one leg", expression => {
    expect(manualTicketBlocker({ ...valid, expression })).toContain("No single leg");
  });
  it.each([
    { missionAccountId: null }, { runId: undefined }, { accountId: 13 },
    { brokerId: "manual" }, { equityCents: 0 }, { equityCents: NaN },
    { notionalCents: 0 }, { notionalCents: NaN }, { buyingPowerCents: 0 },
    { exceedsLimit: true }, { acknowledgement: "" },
  ])("blocks missing or incompatible context %j", patch => expect(manualTicketBlocker({ ...valid, ...patch })).not.toBeNull());
  it("applies the same blocker to keyboard and button paths, without acknowledgement autofill", () => {
    const source = readFileSync("client/src/components/aperture/ManualOrderTicketModal.tsx", "utf8");
    expect(source).toContain("createOrder.isPending || stagingBlocker");
    expect(source).toContain("disabled={createOrder.isPending || Boolean(stagingBlocker) || preflightNotReady}");
    // #118: the server preflight drives the same checklist as the execute page, and blocks staging until it passes.
    expect(source).toContain("aperture.order.preflight.useQuery");
    expect(source).toContain("<GuardrailChecklist evaluation={preflightData?.evaluation}");
    expect(source).toContain("if (preflightNotReady) {");
    expect(source).not.toContain('setPaperAck("PAPER")');
    expect(source).not.toContain("runsQuery.data?.[0]?.id");
    expect(readFileSync("shared/manualTicketPayload.ts", "utf8")).toContain('side: (isOption ? "buy"');
    expect(source).not.toContain(": 200_000");
  });
});
