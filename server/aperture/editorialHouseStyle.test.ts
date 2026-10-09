import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Parity plan PR-05a (signal-hunter-ux/parity/pr-plan.md): POC v3 house style
// for the Capital workspace — square corners and IBM Plex Serif headlines.
const root = resolve(__dirname, "../../client/src");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function topLevelRule(css: string, selectorFragment: string): string {
  const start = css.indexOf(selectorFragment);
  expect(start, `missing ${selectorFragment}`).toBeGreaterThan(-1);
  // The rule must sit outside any @layer so it outranks Tailwind utilities.
  let depth = 0;
  for (let i = 0; i < start; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") depth -= 1;
  }
  expect(depth).toBe(0);
  return css.slice(start, css.indexOf("}", start) + 1);
}

describe("Capital editorial house style", () => {
  const indexCss = read("index.css");

  it("squares raw rounded utilities inside the Capital workspace, outside any layer", () => {
    const rule = topLevelRule(indexCss, '.aperture-editorial [class*="rounded"]:not(.rounded-full)');
    expect(rule).toContain(".aperture-editorial .rounded-full:not(:empty)");
    expect(rule).toContain(".aperture-editorial :is(input, select, textarea)");
    expect(rule).toMatch(/border-radius:\s*0;/);
  });

  it("keeps empty status dots round", () => {
    const rule = topLevelRule(indexCss, '.aperture-editorial [class*="rounded"]:not(.rounded-full)');
    expect(rule).not.toMatch(/\.rounded-full\s*,/);
  });

  it("uses the house serif for shared editorial graphics inside Capital", () => {
    const rule = topLevelRule(indexCss, ".aperture-editorial .decision-graphic header h3");
    expect(rule).toContain("font-family: var(--font-display)");
  });

  it.each([
    "styles/capital-workspace-edition.css",
    "styles/capital-decision-atlas.css",
    "styles/holdings-composition.css",
  ])("%s does not hard-code Georgia", (path) => {
    const css = read(path);
    expect(css).not.toMatch(/Georgia/);
    expect(css).toContain("var(--font-display)");
  });
});
