/**
 * POC v3 parity PR-02: the ticket shows every guardrail the server checked,
 * pass and fail, with a readiness meter. Built only from order.preflight's
 * evaluation; missing or empty results are "not checked", never a pass.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildGuardrailChecklist } from "../../shared/guardrailChecklist";
import { GuardrailChecklist } from "../../client/src/components/aperture/GuardrailChecklist";

// Mirrors shared/disclosure.ts PROHIBITED_LANGUAGE (not exported).
const PROHIBITED_LANGUAGE = /\b(copy\s*congress|follow\s+smart\s+money|insider|conflict|congressional\s+alpha)\b/i;

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const evaluation = (results: Array<{ key: string; passed: boolean; detail: string }>, passed = results.every((r) => r.passed)) => ({ passed, results });
const results = [
  { key: "paper_account", passed: true, detail: "Destination is a paper account" },
  { key: "order_notional_ceiling", passed: true, detail: "$480 ≤ $1,000 single-order ceiling" },
  { key: "execution_account_freshness", passed: false, detail: "Account snapshot is 6h old; refresh within 15 minutes" },
  { key: "planned_risk_per_play", passed: true, detail: "$24 ≤ $60 per-play planned loss" },
  { key: "position_concentration", passed: false, detail: "NVDA would be 10.6% of equity, over the 10% single-name cap" },
  { key: "some_new_gate", passed: true, detail: "ok" },
];

describe("buildGuardrailChecklist", () => {
  it("lists every server result, failures first, with counts", () => {
    const list = buildGuardrailChecklist(evaluation(results));
    expect(list.state).toBe("blocked");
    expect(list.total).toBe(6);
    expect(list.passed).toBe(4);
    expect(list.rows.map((row) => row.key).slice(0, 2)).toEqual(["execution_account_freshness", "position_concentration"]);
    expect(list.rows[0]).toMatchObject({ problem: "Broker snapshot is stale", detail: results[2].detail });
    expect(list.rows.find((row) => row.key === "some_new_gate")!.name).toBe("Some new gate");
  });
  it("is ready only when the server passed and every result passed", () => {
    expect(buildGuardrailChecklist(evaluation(results.map((r) => ({ ...r, passed: true })))).state).toBe("ready");
    expect(buildGuardrailChecklist(evaluation(results.map((r) => ({ ...r, passed: true })), false)).state).toBe("blocked");
  });
  it("treats a missing or empty evaluation as not checked, never as a pass", () => {
    expect(buildGuardrailChecklist(undefined).state).toBe("not_checked");
    expect(buildGuardrailChecklist(evaluation([], true)).state).toBe("not_checked");
  });
  it("uses plain names that pass the prohibited-language check", () => {
    const names = buildGuardrailChecklist(evaluation(results)).rows.map((row) => `${row.name} ${row.problem ?? ""} ${row.remedy ?? ""}`).join(" ");
    expect(names).not.toMatch(PROHIBITED_LANGUAGE);
    const source = readFileSync("shared/guardrailChecklist.ts", "utf8");
    expect(source).not.toMatch(PROHIBITED_LANGUAGE);
  });
});

describe("GuardrailChecklist", () => {
  it("renders the meter, the failed checks with what to do, and every passing check", () => {
    const $ = load(renderToStaticMarkup(<GuardrailChecklist evaluation={evaluation(results)} checkedAt={Date.UTC(2026, 9, 8, 18, 41)} />));
    expect($("[role=meter]").attr("aria-valuenow")).toBe("4");
    expect($("[role=meter]").attr("aria-valuemax")).toBe("6");
    expect($("[role=meter] span")).toHaveLength(6);
    expect($.text()).toContain("4 of 6 checks pass · 2 to fix");
    expect($("[aria-label='Checks to fix'] li")).toHaveLength(2);
    expect($("[aria-label='Checks to fix']").text()).toContain("Sync broker snapshot first");
    expect($("[aria-label='Checks that pass'] li")).toHaveLength(4);
    expect($("[aria-label='Checks that pass']").text()).toContain("Within the single-order limit");
    expect($.text()).toContain("Send stays off while any check fails.");
  });
  it("says not checked when there is no evaluation", () => {
    const html = renderToStaticMarkup(<GuardrailChecklist evaluation={undefined} />);
    expect(html).toContain("Not checked is not a pass.");
    expect(html).not.toContain("role=\"meter\"");
  });
  it("is wired into the practice ticket and the emoji fast-fill label is gone", () => {
    const source = readFileSync("client/src/components/aperture/PaperProposalForm.tsx", "utf8");
    expect(source).toContain("<GuardrailChecklist evaluation={currentPreflightData?.evaluation}");
    expect(source).not.toContain("⚡");
  });
});
