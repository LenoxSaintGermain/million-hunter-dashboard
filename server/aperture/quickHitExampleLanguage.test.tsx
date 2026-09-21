import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";
import { CURATED_QUICK_HITS } from "./quickHitCatalog";
const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("../../client/src/lib/trpc", () => ({ trpc: { aperture: { quickHit: { authorize: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } } } } }));
import { QuickHitCard } from "../../client/src/components/aperture/QuickHitCard";

describe("illustrative catalog language", () => {
  it("does not let unverified examples prepare orders or claim verified backtesting", () => {
    const $ = load(renderToStaticMarkup(<QuickHitCard play={CURATED_QUICK_HITS[0]} />));
    const action = $("button").filter((_, el) => $(el).text().includes("Example only"));
    expect(action.is("[disabled]")).toBe(true);
    expect(action.attr("aria-describedby")).toBe(`example-only-${CURATED_QUICK_HITS[0].id}`);
    expect($.text()).toContain("Unverified sample data");
    expect($.text()).toContain("Illustrative sample results");
    expect($.text()).not.toContain("Authorize Play");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
