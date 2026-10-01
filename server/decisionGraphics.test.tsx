import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cashBridge, DealCashBridge } from "../client/src/components/DealCashBridge";
import { holdingSlices, HoldingsComposition } from "../client/src/components/aperture/HoldingsComposition";
describe("decision graphics preserve uncertainty and arithmetic", () => {
  it("does not turn blank costs into zero", () => {
    expect(cashBridge(1000000,400000,"")?.remaining).toBeNull();
    expect(cashBridge(1000000,400000,"0")?.remaining).toBe(cashBridge(1000000,400000,"")?.subtotal);
    expect(cashBridge(1000000,400000,"-1")?.remaining).toBeNull();
    expect(cashBridge(null,400000,"0")).toBeNull();
  });
  it("preserves negative cash results and rejects nonfinite inputs",()=>{
    const m = cashBridge(1000000,100,"50000")!;
    expect(m.remaining).toBe(m.cash-m.debt-50000);
    expect(m.remaining).toBeLessThan(0);
    expect(cashBridge(1000000,NaN,"0")).toBeNull();
  });
  it("excludes unmeasured holdings and uses absolute short values",()=>{
    const m=holdingSlices([{symbol:"A",marketValueCents:300,priceAsOf:null},{symbol:"B",marketValueCents:-100,priceAsOf:null},{symbol:"C",marketValueCents:null,priceAsOf:null}]);
    expect(m.gross).toBe(400);expect(m.missing).toBe(1);expect(m.slices.map(s=>s.share)).toEqual([75,25]);
  });
  it("renders real graphic, keyboard controls and modeled labels",()=>{
    const html=renderToStaticMarkup(<DealCashBridge asking={1000000} cash={400000}/>);
    expect(html).toContain('<svg');expect(html).toContain('aria-pressed');expect(html).toContain('modeled financing');expect(html).not.toContain('After your costs');
    const gap=renderToStaticMarkup(<HoldingsComposition holdings={[{symbol:"A",marketValueCents:null,priceAsOf:null}]}/>);
    expect(gap).toContain('No measured share');expect(gap).not.toContain('NaN');
  });
});
