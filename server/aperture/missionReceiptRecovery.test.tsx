import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MissionReceiptRecovery } from "../../client/src/components/aperture/DecisionRunway";

afterEach(() => vi.unstubAllGlobals());

describe("incomplete Mission receipt recovery", () => {
  function render(onCheck = vi.fn()) {
    vi.stubGlobal("React", React);
    return renderToStaticMarkup(<MissionReceiptRecovery onCheck={onCheck} />);
  }

  it("offers one direct editor action, without starting a run or inheriting the broken binding", () => {
    const html = render();
    expect(html).toContain('href="/aperture/mission?objective=1"');
    expect(html).toContain("Start fresh research");
    expect(html).toContain("Opens the editor only. No analysis or order starts.");
    expect(html).not.toContain("revisionId=");
    expect(html).not.toContain("decisionRunId=");
    expect((html.match(/<a /g) ?? [])).toHaveLength(1);
  });

  it("keeps technical context collapsed and never represents navigation as clearance", () => {
    const check = vi.fn();
    const html = render(check);
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]*\bopen/);
    expect(html).toContain("unchanged and unresolved");
    expect(html).toContain("does not repair or close it");
    expect(html).toContain("Current approval and order-risk checks still apply.");
    expect(check).not.toHaveBeenCalled();
    expect(html).not.toContain("Dismiss");
    expect(html).not.toContain("Delete");
  });

  it("preserves isolated UAT navigation without creating an identity on production paths", () => {
    vi.stubGlobal("window", { location: { search: "?uat_identity=jim" }, sessionStorage: { setItem: vi.fn(), getItem: () => null } });
    expect(render()).toContain('href="/aperture/mission?objective=1&amp;uat_identity=jim"');
  });

  it("uses the same recovery for failed latest and exact receipt reads, without mutation APIs", () => {
    const source = readFileSync("client/src/components/aperture/DecisionRunway.tsx", "utf8");
    expect(source.match(/return <MissionReceiptRecovery onCheck=/g)).toHaveLength(2);
    const component = source.split("export function MissionReceiptRecovery")[1].split("export function DecisionRunway")[0];
    expect(component).not.toMatch(/mutate|localStorage|setAside|closeOut|remove/);
    expect(source).toContain('receiptError?.data?.code === "PRECONDITION_FAILED"');
    expect(source).toContain("!immutableReceipt.binding");
  });
});
