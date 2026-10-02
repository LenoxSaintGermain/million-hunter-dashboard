import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { extractListingEvidence, evaluateAcquisitionV2, exampleMandate } from "../shared/acquisitionV2";

const root = new URL("../tests/fixtures/acquisition-v2/current-source-captures/", import.meta.url);
const receipt = JSON.parse(readFileSync(new URL("brevard-septic-current.json", root), "utf8"));
it("replays a real frozen listing without network access or repairing seller typos", () => {
  const html = readFileSync(new URL("brevard-septic-current.html", root));
  expect(createHash("sha256").update(html).digest("hex")).toBe(receipt.sha256);
  expect(createHash("sha256").update(receipt.text).digest("hex")).toBe(receipt.textSha256);
  const evidence = extractListingEvidence({ url: receipt.url, fetchedAt: receipt.fetchedAt, type: "primary", text: receipt.text });
  expect(evidence.fields.ask.value).toBe(1150000);
  expect(evidence.fields.revenue.value).toBe(1179803);
  expect(evidence.fields.sde.value).toBe(311424);
  expect(evidence.text).toContain("$180,00 down");
  for (const key of ["ask", "revenue", "sde"] as const) {
    expect(evidence.fields[key].state).toBe("value");
    expect(receipt.text).toContain(evidence.fields[key].span);
    expect(evidence.fields[key].source.url).toBe(receipt.url);
  }
  const report = evaluateAcquisitionV2(evidence, exampleMandate);
  expect(report.verdict.value).toBe("FAIL");
  expect(report.gates.find(g => g.id === "G1")?.result).toBe("fail");
  expect(report.gates.find(g => g.id === "G2")?.result).toBe("fail");
  expect(JSON.stringify(evaluateAcquisitionV2(evidence, exampleMandate))).toBe(JSON.stringify(report));
});
