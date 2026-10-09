import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROHIBITED_LANGUAGE } from "./disclosure";
import { describeSubmitBlocker, plainPreflightBlocking, PRESENTED_GATE_KEYS } from "./orderSubmitReadiness";

const RAW = /[a-z]+[A-Z][a-zA-Z]*(Cents|At)\b|notionalCents|catalystDeadlineAt|priced fact/;

describe("plain gate copy (#110)", () => {
  it("every gate key evaluateOrderGates can emit has a plain title and remedy", () => {
    const src = readFileSync(path.resolve(import.meta.dirname, "../server/aperture/gates.ts"), "utf8");
    const keys = new Set([...src.matchAll(/\.add\(\s*"([a-z_]+)"/g)].map((m) => m[1]));
    expect(keys.size).toBeGreaterThan(30);
    const missing = [...keys].filter((key) => !PRESENTED_GATE_KEYS.has(key));
    expect(missing).toEqual([]);
    for (const key of keys) {
      const b = describeSubmitBlocker(key, "raw detail");
      expect(b.remedy).not.toBe("raw detail");
      expect(`${b.title} ${b.remedy}`).not.toMatch(PROHIBITED_LANGUAGE);
      expect(`${b.title} ${b.remedy}`).not.toMatch(RAW);
    }
  });

  it("maps the UAT strings to plain language and keeps human lines", () => {
    const deadline = "catalystDeadlineAt is in the past";
    const notional = "order notional could not be established — no notionalCents given and no priced fact to derive it from";
    const lines = plainPreflightBlocking({
      blocking: [deadline, notional, "catalystDeadlineAt: Expected number, received null", "Illustrative fixtures cannot be sent."],
      evaluation: { results: [{ key: "catalyst_deadline", passed: false, detail: deadline }, { key: "notional_resolvable", passed: false, detail: notional }, { key: "reason", passed: true, detail: "ok" }] },
      schemaErrors: ["catalystDeadlineAt: Expected number, received null"],
    });
    expect(lines).toEqual([
      "The event date is missing or has passed. Pick a catalyst date that is still ahead.",
      "Order size is missing. Enter an order size (dollars or shares) so the limits can be checked.",
      "Catalyst deadline needs a valid value.",
      "Illustrative fixtures cannot be sent.",
    ]);
    for (const line of lines) expect(line).not.toMatch(RAW);
  });

  it("an unknown gate never echoes its raw detail as the remedy", () => {
    expect(describeSubmitBlocker("brand_new_gate", "fooCents is null").remedy).not.toContain("fooCents");
  });
});
