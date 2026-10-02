import { expect, it } from "vitest";
import { extractListingEvidence, evaluateAcquisitionV2, exampleMandate } from "../shared/acquisitionV2";
import { simulateAcquisitionV2, exampleGamePriors } from "../shared/acquisitionGameTheory";

const source = { url: "https://www.bizbuysell.com/business-opportunity/fixture/1234567/", fetchedAt: "2026-09-30T12:00:00.000Z", type: "primary" as const };
// Synthetic parser cases, not captured golden listings or verified business facts.
const screen = (text: string) => evaluateAcquisitionV2(extractListingEvidence({ ...source, text }), exampleMandate);
const gate = (text: string, id: string) => screen(text).gates.find(g => g.id === id)?.result;
const financialBase = "Asking Price: $1,850,000\nRevenue: $3,590,234\nSDE: $702,537\n";
it("parses operator-supplied AB Brokers label excerpts without promoting them to frozen fixtures", () => {
  const fields = extractListingEvidence({ ...source, text: "Selling Price:\n$1,150,000\nGross Sales $1,179,803\nCash Flow $311,424\nEquipment $293,500\nEmployees 6 FT,2 PT,1 Mgrs" }).fields;
  expect(fields.ask).toMatchObject({ value: 1150000, state: "value", span: "Selling Price:\n$1,150,000" });
  expect(fields.revenue.value).toBe(1179803);
  expect(fields.sde.value).toBe(311424);
  expect(fields.ffe.value).toBe(293500);
});
it("keeps sign-in-gated Cash Flow on request without borrowing Gross Revenue", () => {
  const fields = extractListingEvidence({ ...source, text: "Asking Price$2,500,000\nCash Flow\nSign In to View\nGross Revenue$3,938,866" }).fields;
  expect(fields.ask.value).toBe(2500000);
  expect(fields.sde).toMatchObject({ value: null, state: "on_request", span: "Cash Flow\nSign In to View" });
  expect(fields.revenue.value).toBe(3938866);
});
it("does not treat an unscoped equipment mention as the listing FF&E field", () => {
  expect(extractListingEvidence({ ...source, text: "Replacement equipment $293,500" }).fields.ffe.value).toBeNull();
});

it.each(["SBA eligible: Yes, subject to approval", "SBA eligible: Yes or No", "SBA eligible: Yes\nSBA eligible: unknown"])("keeps qualified/conflicting financing unknown: %s", text => {
  expect(gate(financialBase + text, "G4")).toBe("unknown");
});
it.each(["No SBA; no seller financing", "Will not qualify for SBA. Seller financing is not available", "SBA eligibility: No\nSeller financing: No"])("captures explicit financing refusal: %s", text => {
  const result = screen(financialBase + text);
  expect(result.gates.find(g => g.id === "G4")?.result).toBe("fail");
  expect(result.redFlags.find(f => f.id === "R11")).toMatchObject({ severity: "critical" });
  expect(result.redFlags.find(f => f.id === "R11")?.span.length).toBeGreaterThan(0);
});
it("does not treat a contradicted SBA claim or negated refusal as an available path", () => {
  expect(gate(financialBase + "SBA eligible: Yes\nNot SBA-eligible", "G4")).toBe("unknown");
  expect(screen("Not cash only. Seller financing: No").redFlags.some(f => f.id === "R11")).toBe(false);
});
it("retains a high financing-refusal flag even when seller financing is available", () => {
  expect(screen("No SBA; Seller financing: Yes").redFlags.find(f => f.id === "R11")?.severity).toBe("high");
});
it.each(["Management team in place tomorrow", "Management team in place\nManagement team is not in place"])("does not promote future or contradicted management: %s", text => {
  expect(gate(text, "G5")).toBe("cap");
});
it("does not promote expired recurring contracts", () => {
  expect(gate("Recurring contracts expired", "G11")).toBe("cap");
});
it.each(["Does not require an owner-operator", "Seller may reject passive buyers"])("does not invent an owner-operator requirement: %s", text => {
  expect(gate(text, "G5")).toBe("cap");
});
it.each(["Seller rejects passive buyers", "Owner-operator required", "Passive buyers will not be considered"])("captures explicit buyer restrictions: %s", text => {
  expect(gate(text, "G5")).toBe("fail");
});
it.each(["Management team in place: No", "Management team in place if buyer hires a manager", "Management team in place\nNo management team in place"])("does not promote qualified management: %s", text => {
  expect(gate(text, "G5")).toBe("cap");
});
it.each(["Recurring contracts: No", "Required inspections may apply", "Route density is unknown"])("does not promote qualified moat evidence: %s", text => {
  expect(gate(text, "G11")).toBe("cap");
});
it.each(["Largest customer: 10%-25%", "Largest customer: 10% or more", "Largest customer: 10% (estimated)", "Largest customer: 10%\nLargest customer: on request"])("does not truncate concentration evidence: %s", text => {
  expect(gate(text + "\nTop 3 customers: 25%", "G10")).toBe("unknown");
});
it("captures explicit revenue concentration phrasing and compares numeric duplicates", () => {
  expect(gate("Top three customers account for 94% of revenue", "G10")).toBe("fail");
  expect(gate("Largest customer: 10%\nLargest customer: 10.0%\nTop 3 customers: 25%", "G10")).toBe("pass");
});
it.each(["Listing status: Active pending confirmation", "Listing status: Active\nListing status: unknown", "Not under contract", "Sale pending?", "Listing status: Active or sold"])("does not invent availability from ambiguous status: %s", text => {
  expect(gate(text, "G6")).toBe("unknown");
  expect(screen(text).excluded).toBe(false);
});
it("keeps explicit inactive status dominant over an active claim", () => {
  expect(screen("Listing status: Active\nListing status: Under contract").excluded).toBe(true);
});
it.each(["Lease expired: 09/30/2025", "Lease ends: 2027-12-31"])("captures unambiguous lease dates: %s", text => {
  expect(screen(text).redFlags.find(f => f.id === "R4")?.span).toBe(text);
});
it.each(["Lease expiration: 2025-02-30", "Lease expiration: 2025-09-30 or 2038-09-30", "Lease expiration: 2025-09-30\nLease expiration: 2038-09-30", "Lease expiration: 09/10/2025"])("leaves invalid or ambiguous lease dates unresolved: %s", text => {
  expect(screen(text).redFlags.some(f => f.id === "R4")).toBe(false);
});
it("does not derive listing-age games from malformed or conflicting dates", () => {
  expect(screen("Listing date: 2026-09-01 or 2024-01-01").games.some(g => g.id === "auction")).toBe(false);
  expect(screen("Listing date: 2025-02-30").redFlags.some(f => f.id === "R9")).toBe(false);
});
it.each(["$1.8M–$2M", "$1 million to $2 million"])("does not promote scaled ranges: %s", amount => {
  expect(extractListingEvidence({ ...source, text: `Asking Price: ${amount}` }).fields.ask.state).toBe("approximate");
});
it.each(["Sold", "Expired", "Withdrawn"])("excludes explicit inactive status: %s", status => {
  const report = evaluateAcquisitionV2(extractListingEvidence({ ...source, text: `Listing status: ${status}` }), exampleMandate);
  expect(report.excluded).toBe(true);
  expect(report.verdict.value).toBe("FAIL");
});
it("captures exact financial spans and distinguishes malformed, approximate and gated values", () => {
  const report = extractListingEvidence({ ...source, text: "Asking Price: $1,850,000\nRevenue: $3,590,234\nCash Flow (SDE): $702,537\nEBITDA: on request\nInventory: $180,00\nFF&E: about $450,000" });
  expect(report.fields.ask).toMatchObject({ value: 1850000, state: "value", span: "Asking Price: $1,850,000" });
  expect(report.fields.revenue.value).toBe(3590234);
  expect(report.fields.sde.value).toBe(702537);
  expect(report.fields.ebitda.state).toBe("on_request");
  expect(report.fields.inventory.state).toBe("extraction_failed");
  expect(report.fields.ffe.state).toBe("approximate");
});
it("checks confirmed geographic scope and reports seller leverage as a heuristic, not wages", () => {
  const evidence = extractListingEvidence({ ...source, text: "Asking Price: $1,850,000\nCash Flow: $702,537\nRevenue: $3,590,234\nLocation: Tampa, FL\nOwner hours per week: 5" });
  const florida = evaluateAcquisitionV2(evidence, { ...exampleMandate, geographies: ["FL"] });
  expect(florida.gates.find(g => g.id === "GEO")?.result).toBe("pass");
  const texas = evaluateAcquisitionV2(evidence, { ...exampleMandate, geographies: ["TX"] });
  expect(texas.gates.find(g => g.id === "GEO")?.result).toBe("fail");
  expect(florida.sellerHourlyHeuristic?.value).toBeCloseTo(2702.07,2);
  expect(florida.sellerHourlyHeuristic?.label).toContain("not salary");
});
it("does not promote price ranges or negated management and moat claims", () => {
  const range = extractListingEvidence({ ...source, text: "Asking Price: $1,850,000 - $2,000,000\nRevenue: $3,590,234\nCash Flow: $702,537" });
  expect(range.fields.ask.state).not.toBe("value");
  const text = "Asking Price: $1,850,000\nCash Flow: $702,537\nRevenue: $3,590,234\nListing status: Active\nSBA eligible: Yes\nLargest customer: 10%\nTop 3 customers: 25%\nNo management team in place. No recurring contracts.";
  const report = evaluateAcquisitionV2(extractListingEvidence({ ...source, text }), exampleMandate);
  expect(report.gates.find(g => g.id === "G5")?.result).toBe("cap");
  expect(report.gates.find(g => g.id === "G11")?.result).toBe("cap");
});
it("reconciles the septic scenario without inventing missing waterfall costs", () => {
  const input = { ask: 1850000, sde: 702537, mandate: exampleMandate, priors: exampleGamePriors,
    // Synthetic cost assumptions; the original listing's actual cost budget is unavailable.
    flags: ["R1", "R2"], costs: { ownerReplacement: 0, marketRent: 0, capexReserve: 94000, qualifierFee: 0, investorReturn: 0 } };
  const report = simulateAcquisitionV2(input);
  expect(Math.abs(report.waterfall.distributable - 330000)).toBeLessThan(5000);
  expect(Math.abs(report.evUnprotected - 234000)).toBeLessThan(5000);
  expect(Math.abs(report.evProtected - 276000)).toBeLessThan(5000);
  expect(report.label).toContain("judgment-based priors");
  expect(() => simulateAcquisitionV2({ ...input, costs: { ...input.costs, capexReserve: null } })).toThrow("cost");
  expect(() => simulateAcquisitionV2({ ...input, priors: { ...exampleGamePriors, clean: .9 } })).toThrow();
});
it("emits source-bound research questions and explicitly disables unsourced benchmarks", () => {
  const evidence = extractListingEvidence({ ...source, text: "Asking Price: $1,850,000\nRevenue: $3,590,234\nCash Flow: $702,537\nEBITDA: $702,537\nInventory: $600,000\nManagement: brother and father run the business\nLicense holder: owner\nCollective bargaining agreement\nLease expiration: 2025-09-30\nSeller owns real estate; excluded from sale\nPrice reduced; motivated seller\nOwner works in the business. Training: 14 days\nPlatform controls dispatch. Platform revenue share: 80%" });
  const result = evaluateAcquisitionV2(evidence, exampleMandate);
  expect(result.redFlags.map(f => f.id)).toEqual(expect.arrayContaining(["R1","R2","R3","R4","R5","R6","R7","R9","R10","R13","R15"]));
  expect(result.verdict.value).toBe("FAIL");
  expect(result.disabledDetectors.map(d => d.id)).toEqual(expect.arrayContaining(["R8","R14"]));
  expect(result.redFlags.every(f => f.span && f.brokerQuestion)).toBe(true);
});
it("excludes inactive listings, fails explicit financing refusal and caps unsupported management", () => {
  const text = "Asking Price: $1,850,000\nCash Flow: $702,537\nRevenue: $3,590,234\nListing status: Active\nSBA eligible: Yes\nSeller financing: Yes\nLargest customer: 10%\nTop 3 customers: 25%\nRecurring maintenance contracts";
  const evaluate = (extra: string) => evaluateAcquisitionV2(extractListingEvidence({ ...source, text: text + extra }), exampleMandate);
  expect(evaluate("").verdict.value).toBe("WATCHLIST");
  expect(evaluate("\nManagement team in place").verdict.value).toBe("PURSUE");
  expect(evaluate("\nThis listing is no longer available").excluded).toBe(true);
  expect(evaluate("\nRequires an owner-operator").verdict.value).toBe("FAIL");
  const refusal = evaluateAcquisitionV2(extractListingEvidence({ ...source, text: text.replace("SBA eligible: Yes", "SBA eligible: No").replace("Seller financing: Yes", "Seller financing: No") }), exampleMandate);
  expect(refusal.verdict.value).toBe("FAIL");
  expect(refusal.redFlags.some(f => f.id === "R11" && f.severity === "critical")).toBe(true);
});
it("applies the confirmed mandate before ranking and leaves missing evidence on HOLD", () => {
  const evidence = extractListingEvidence({ ...source, text: "Asking Price: $1,150,000\nCash Flow: $311,424\nRevenue: $1,179,803" });
  expect(evaluateAcquisitionV2(evidence, exampleMandate).verdict.value).toBe("FAIL");
  const within = extractListingEvidence({ ...source, text: "Asking Price: $1,850,000\nCash Flow: $702,537\nRevenue: $3,590,234" });
  const report = evaluateAcquisitionV2(within, exampleMandate);
  expect(report.verdict.value).toBe("HOLD");
  expect(report.ratios.sdeMargin?.value).toBeCloseTo(.19568, 4);
  expect(report.ratios.multiple?.value).toBeCloseTo(2.63333, 4);
  expect(report.mandateVersion).toBe(exampleMandate.version);
  expect(evaluateAcquisitionV2(within, { ...exampleMandate, priceMax: 1500000 }).verdict.value).toBe("FAIL");
  expect(evaluateAcquisitionV2(within, exampleMandate)).toEqual(report);
});
