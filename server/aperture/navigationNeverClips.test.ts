import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Navigation is not the element that yields.
 *
 * Two surfaces shipped clipping their own controls, from the same cause: a
 * control group left free to shrink sat beside prose that refused to. Flexbox
 * resolved it the only way it could — by shrinking the controls — and the
 * `overflow-x-auto` meant to be a small-screen fallback silently became the
 * desktop experience.
 *
 *   Workspace bar, measured at a 1498px viewport on 2026-09-12: the operating
 *   invariant took 472px of a 1280px-capped row, the row overflowed by 130px,
 *   and "Theses" and "New thesis" went behind a scrollbar.
 *
 *   Run workspace, same day: the view tabs were `min-w-0 max-w-full
 *   overflow-x-auto` beside an un-shrinkable headline, so "Your play" scrolled
 *   out of sight and the operator saw three tabs where there are four.
 *
 * CandidateBoard is asserted from source rather than rendered: it is the
 * repo's existing convention for that page, whose render needs the whole tRPC
 * surface mocked. The class contract is the thing that actually decides the
 * layout, so it is the thing pinned here.
 */
const read = (path: string) => readFileSync(path, "utf8");

describe("run workspace view tabs keep every tab reachable", () => {
  const source = read("client/src/pages/aperture/CandidateBoard.tsx");
  const tabs = source.split("\n").find((line) => line.includes("data-run-view-tabs")) ?? "";

  it("stops shrinking once there is room for the full group", () => {
    expect(tabs).toContain("sm:shrink-0");
    expect(tabs).toContain("sm:min-w-max");
  });

  it("keeps horizontal scrolling as a small-screen fallback only", () => {
    // Narrow viewports genuinely cannot fit four tabs; wide ones always can.
    expect(tabs).toContain("overflow-x-auto");
    expect(tabs).toContain("sm:overflow-visible");
  });

  it("lets the headline beside it wrap instead", () => {
    // The heading block is what should give up width, and it can only do that
    // with min-w-0 — without it a long h1 establishes the row's minimum.
    expect(source).toContain('<div className="min-w-0">\n              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]"');
  });

  it("still offers all four recorded views", () => {
    for (const label of ["Your play", "Decision detail", "Evidence", "Research"]) {
      expect(source).toContain(`>${label}</button>`);
    }
  });
});

describe("the workspace bar's standing disclosure stays out of the menu row", () => {
  const source = read("client/src/components/aperture/ApertureShell.tsx");

  it("puts the invariant after the row rather than inside it", () => {
    const rowStart = source.indexOf("data-workspace-row");
    const menu = source.indexOf("data-workspace-menu");
    const invariant = source.indexOf("data-operating-invariant");
    expect(rowStart).toBeGreaterThan(-1);
    expect(menu).toBeGreaterThan(rowStart);
    expect(invariant).toBeGreaterThan(menu);
  });

  it("records why, so the sentence is not moved back into the row", () => {
    expect(source).toContain("Navigation is not the thing");
  });
});

describe("the cockpit rail fits its own cells", () => {
  const source = read("client/src/components/aperture/CapitalCockpitRail.tsx");

  it("gives the portfolio-constraint cell more than an even share", () => {
    // Measured 2026-09-12 on every Aperture route: four even 299px columns,
    // but that cell carries a state mark, a subject, a meter, a ratio, a help
    // control and a Detail button — 330px of content. The 31px it could not fit
    // overflowed the whole rail section, on Today, Mission and Research alike.
    expect(source).toContain("xl:grid-cols-[1fr_1fr_1fr_1.4fr]");
    expect(source).not.toContain("xl:grid-cols-4");
  });

  it("keeps the account cell's fact on the surface and its explanation behind the help", () => {
    // The long form needed ~490px in a 299px cell and was clipped by 168px, with
    // the same explanation already one control away.
    expect(source).not.toContain("ceilings are measured against ${syncedLabel");
    expect(source).toContain("const staleText = syncedLabel(data.account.stalenessMs);");
    expect(source).toContain("measured against the equity value recorded at this sync");
  });
});

describe("the sentence entry says what it does", () => {
  const source = read("client/src/pages/aperture/ApertureMission.tsx");

  it("names the action rather than the concept", () => {
    // The old label named the concept, not the action, and was the one the
    // operator could not find. It survives only in the comment recording why.
    expect(source).toContain(">Start from a sentence<");
    expect(source).not.toContain(">Explore a capital objective<");
  });

  it("is a primary control, not one outline button among four", () => {
    const line = source.split("\n").find((l) => l.includes("data-start-from-sentence")) ?? "";
    expect(line).not.toContain('variant="outline"');
    expect(line).toContain("objective=1");
  });
});
