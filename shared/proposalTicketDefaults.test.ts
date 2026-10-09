import { describe, expect, it } from "vitest";
import { PROHIBITED_LANGUAGE } from "./disclosure";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CLOSE_REVIEW_DEFAULT_MS, sharePlanSummary, ticketTimeDefaults } from "./proposalTicketDefaults";

const NOW = Date.UTC(2026, 9, 9, 15, 10);

describe("execute ticket defaults (#111)", () => {
  it("never pre-fills a past catalyst deadline or close-review time", () => {
    const past = Date.UTC(2026, 9, 8, 22, 23);
    expect(ticketTimeDefaults(past, NOW)).toEqual({ deadlineAt: null, timeStopAt: null, catalystPassed: true });
  });
  it("keeps the close-review default apart from a future catalyst deadline", () => {
    const future = NOW + 3 * 86_400_000;
    const d = ticketTimeDefaults(future, NOW);
    expect(d).toMatchObject({ deadlineAt: future, timeStopAt: NOW + CLOSE_REVIEW_DEFAULT_MS, catalystPassed: false });
    expect(d.timeStopAt).not.toBe(d.deadlineAt);
    expect(ticketTimeDefaults(NOW + 3_600_000, NOW).timeStopAt).toBeNull();
    expect(ticketTimeDefaults(null, NOW).deadlineAt).toBeGreaterThan(NOW);
  });
  it("a not-ready recipe shows no plan; its levels come back only as reference levels", () => {
    const recipe = { readiness: "trigger_pending", entry: { priceCents: 28_266 }, stop: { priceCents: 27_722 }, qty: 17, plannedLossCents: 9_400, notionalCents: 480_522, targets: [{ rMultiple: 2, priceCents: 29_354 }] };
    const s = sharePlanSummary({ recipe, recipeReady: false, formEntryCents: null, formStopCents: null });
    expect(s).toEqual({ entryCents: null, stopCents: null, qty: null, plannedLossCents: null, notionalCents: null, targets: [], reference: { entryCents: 28_266, stopCents: 27_722 } });
    const ready = sharePlanSummary({ recipe, recipeReady: true, formEntryCents: null, formStopCents: null });
    expect(ready).toMatchObject({ entryCents: 28_266, stopCents: 27_722, qty: 17, plannedLossCents: 9_400, reference: null });
    expect(sharePlanSummary({ recipe, recipeReady: false, formEntryCents: 28_000, formStopCents: 27_500 })).toMatchObject({ entryCents: 28_000, stopCents: 27_500, qty: null });
  });
  it("the execute form wires both helpers and its new copy is clean", () => {
    const src = readFileSync(path.resolve(import.meta.dirname, "../client/src/components/aperture/PaperProposalForm.tsx"), "utf8");
    expect(src).toContain("ticketTimeDefaults(run?.catalystDeadlineAt, Date.now())");
    expect(src).toContain("sharePlanSummary({ recipe: constructedPlay, recipeReady: recipeCanPrepare");
    expect(src).not.toMatch(/useState\(\(\) => toLocalDateTimeInputValue\(run\?\.catalystDeadlineAt/);
    expect("This run's catalyst date has passed, so the dates below start blank. Pick a new catalyst date that is still ahead. Reference levels, not ready").not.toMatch(PROHIBITED_LANGUAGE);
  });
});
