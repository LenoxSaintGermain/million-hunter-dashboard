import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * A React hook placed after a component's early return changes hook order
 * between renders and crashes the screen at runtime. This repo has no eslint,
 * and the unit lane renders each component once with renderToStaticMarkup, so
 * neither would catch it — a factDraft query added below `if (!data) return`
 * took CandidateBoard down in production on 2026-09-10.
 *
 * This is a source contract, not a render test. It reads each component top to
 * bottom and fails when a hook call follows a top-level early return.
 */

const HOOK = /\b(use[A-Z]\w*)\s*\(/;
const TOP_LEVEL_RETURN = /^ {2}(if\s*\(.*\)\s*)?return\s/;

function firstHookAfterEarlyReturn(source: string) {
  const lines = source.split("\n");
  let sawReturn: { line: number; text: string } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // A new top-level function resets the scope we are reasoning about.
    if (/^(export )?(default )?function |^(export )?const \w+ = \(/.test(line)) sawReturn = null;
    if (TOP_LEVEL_RETURN.test(line)) { sawReturn = { line: i + 1, text: line.trim().slice(0, 70) }; continue; }
    if (!sawReturn) continue;
    const declaresHook = /^ {2}const .*=\s*(await\s*)?\w[\w.]*\.?use[A-Z]/.test(line) || (/^ {2}const /.test(line) && HOOK.test(line));
    if (declaresHook) return { hookLine: i + 1, hook: line.trim().slice(0, 80), afterReturn: sawReturn };
  }
  return null;
}

const dir = "client/src/pages/aperture";
const files = readdirSync(dir).filter(f => f.endsWith(".tsx"));

describe("no React hook runs after a component's early return", () => {
  it("covers every aperture page component", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file} declares all hooks before any early return`, () => {
      const found = firstHookAfterEarlyReturn(readFileSync(join(dir, file), "utf8"));
      expect(found, found
        ? `${file}:${found.hookLine} declares "${found.hook}" after the early return at line ${found.afterReturn.line} ("${found.afterReturn.text}"). Move the hook above every return.`
        : "").toBeNull();
    });
  }
});
