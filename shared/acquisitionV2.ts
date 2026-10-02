import { z } from "zod";
import { lookupCategoryBenchmark, type CategoryBenchmark } from "./acquisitionBenchmarks";

export const ACQUISITION_V2_ENGINE_VERSION = "acquisition-v2.3" as const;
/** Acquisition V2: deterministic source claims, never audited financial facts. */
export const acquisitionMandateSchema = z.object({
  version: z.string().min(1).max(80),
  priceMin: z.number().finite().nonnegative(),
  priceMax: z.number().finite().positive(),
  sdeMin: z.number().finite().positive(),
  watchlistMin: z.number().finite().nonnegative(),
  marginMin: z.number().min(0).max(1),
  equityPct: z.number().min(0).max(1),
  closingCosts: z.number().finite().nonnegative(),
  rate: z.number().min(0).max(1),
  termYears: z.number().int().min(1).max(40),
  dscrMin: z.number().finite().positive(),
  managementRequired: z.boolean(),
  singleCustomerMax: z.number().min(0).max(1),
  top3Max: z.number().min(0).max(1),
  geographies: z.array(z.string().trim().min(1).max(128)).max(50).default([]),
  category: z.string().trim().min(1).max(64).optional(),
}).refine(v => v.priceMin <= v.priceMax && v.watchlistMin <= v.sdeMin, "Mandate bounds are reversed");
export type AcquisitionMandate = z.infer<typeof acquisitionMandateSchema>;

/** Example only. Callers must obtain explicit operator confirmation before activation. */
export const exampleMandate: AcquisitionMandate = {
  version: "2026-09-29/reconciled-1",
  priceMin: 1200000,
  priceMax: 3000000,
  sdeMin: 600000,
  watchlistMin: 400000,
  marginMin: .15,
  equityPct: .1,
  closingCosts: 100000,
  rate: .1,
  termYears: 10,
  dscrMin: 1.25,
  managementRequired: true,
  singleCustomerMax: .15,
  top3Max: .5,
  geographies: [],
};

export type Gate = { id: string; result: "pass" | "fail" | "unknown" | "cap"; detail: string };
export type Ratio = { value: number; formula: string };
export type RedFlag = { id: string; severity: "medium" | "high" | "critical"; span: string; brokerQuestion: string };

export function annualDebtService(principal: number, annualRate: number, years: number) {
  if (![principal, annualRate, years].every(Number.isFinite) || principal < 0 || annualRate < 0 || years <= 0) throw new Error("Invalid financing assumptions");
  const months = years * 12, monthlyRate = annualRate / 12;
  return annualRate === 0 ? principal / years : principal * monthlyRate / (1 - (1 + monthlyRate) ** -months) * 12;
}

/** Solves implied annual interest rate from loan principal, monthly payment amount, and total payments. */
export function solveImpliedRate(principal: number, monthlyPayment: number, totalPayments: number): number | null {
  if (principal <= 0 || monthlyPayment <= 0 || totalPayments <= 0 || monthlyPayment * totalPayments <= principal) return null;
  let low = 0.0001, high = 1.0;
  for (let iter = 0; iter < 40; iter++) {
    const mid = (low + high) / 2;
    const r = mid / 12;
    const calc = (principal * r) / (1 - Math.pow(1 + r, -totalPayments));
    if (Math.abs(calc - monthlyPayment) < 0.01) return mid;
    if (calc > monthlyPayment) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

export type FieldState = "value" | "not_disclosed" | "on_request" | "extraction_failed" | "approximate" | "conflicting";
export type Source = { url: string; fetchedAt: string; type: "primary" | "mirror" };
export type MoneyField = { value: number | null; state: FieldState; span: string; source: Source };

const labels = {
  ask: "Asking Price|Asking|Selling Price",
  revenue: "Gross Revenue|Annual Revenue|Revenue|Gross Sales",
  sde: "Cash Flow(?:\\s*\\(SDE\\))?|Seller(?:’|'|s)* Discretionary Earnings|SDE",
  ebitda: "EBITDA",
  inventory: "Inventory",
  ffe: "FF&E|Furniture,? Fixtures (?:and|&) Equipment|Equipment",
} as const;
export type MoneyKey = keyof typeof labels;

export type RealEstateInfo = {
  status: "owned" | "leased" | "home_based" | "on_request" | "unknown";
  value: number | null;
  included: boolean | null;
  span: string;
};

export type EmployeeInfo = {
  fullTime: number | null;
  partTime: number | null;
  total: number | null;
  span: string;
};

export type LeaseInfo = {
  expiration: string | null;
  monthlyRent: number | null;
  span: string;
};

export type FinancingInfo = {
  sbaEligible: boolean | null;
  sellerFinancing: boolean | null;
  termsText: string | null;
  impliedRate: number | null;
  span: string;
};

export type NonFinancialFields = {
  realEstate: RealEstateInfo;
  employees: EmployeeInfo;
  lease: LeaseInfo;
  financing: FinancingInfo;
  inventoryIncluded: boolean | null;
  ffeIncluded: boolean | null;
  establishedYear: number | null;
  reasonForSelling: string | null;
  licensingText: string | null;
  managementText: string | null;
  category: string | null;
};

export type ListingEvidence = {
  source: Source;
  text: string;
  fields: Record<MoneyKey, MoneyField>;
  typedFields?: NonFinancialFields;
};

function moneyField(text: string, key: MoneyKey, source: Source): MoneyField {
  // Label-anchored and bounded; never borrow a value from the next field.
  const pattern = new RegExp(`(?:^|[\\s;])((?:${labels[key]})\\s*:?\\s*(?:(?:about|roughly|approximately|approx\\.?|≈|~)\\s*)?(?:\\$\\s*[\\d,.]+(?:\\s*[MK]\\b)?(?:\\s*(?:million|thousand)\\b)?\\+?|on request|upon request|sign in to view|not disclosed|N/A))`, "gi");
  const matches = Array.from(text.matchAll(pattern)).filter(match => {
    // Aliases are field labels, not replacement costs or prose about equipment.
    if (!/^(?:Selling Price|Gross Sales|Equipment)\b/i.test(match[1])) return true;
    const start = (match.index ?? 0) + match[0].indexOf(match[1]);
    return !(text.slice(0, start).split(/[\n;]/).at(-1) ?? "").trim();
  });
  const captures = matches.map(match => {
    const tail = text.slice((match.index ?? 0) + match[0].length);
    const range = tail.match(/^\s*(?:[-–—]|to)\s*\$?\s*[\d,.]+(?:\s*[MK]\b)?/i)?.[0];
    return match[1] + (range ?? "");
  });
  const base = { source, value: null, span: captures.join("\n") };
  if (!captures.length) return { ...base, state: new RegExp(`\\b(?:${labels[key]})\\b`, "i").test(text) ? "extraction_failed" : "not_disclosed" };
  const parsed = captures.map(span => {
    if (/\d\s*(?:million|thousand|[MK])?\s*(?:[-–—]|to)\s*\$?\s*\d/i.test(span)) return { value: null, state: "approximate" as FieldState };
    if (/on request|upon request|sign in to view/i.test(span)) return { value: null, state: "on_request" as FieldState };
    if (/not disclosed|N\/A/i.test(span)) return { value: null, state: "not_disclosed" as FieldState };
    const raw = span.match(/\$\s*([\d,.]+)\s*(million|thousand|M\b|K\b)?/i);
    if (!raw || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw[1])) return { value: null, state: "extraction_failed" as FieldState };
    const scale = /^(m|million)$/i.test(raw[2] ?? "") ? 1e6 : /^(k|thousand)$/i.test(raw[2] ?? "") ? 1e3 : 1;
    const value = Number(raw[1].replaceAll(",", "")) * scale;
    if (!Number.isSafeInteger(value) || value < 0) return { value: null, state: "extraction_failed" as FieldState };
    return { value, state: /about|roughly|approximately|approx\.?|≈|~|\+/i.test(span) ? "approximate" as FieldState : "value" as FieldState };
  });
  if (new Set(parsed.map(row => JSON.stringify(row))).size > 1) return { ...base, state: "conflicting" };
  return { ...base, ...parsed[0] };
}

function extractNonFinancialFields(text: string): NonFinancialFields {
  // Real Estate
  let reStatus: RealEstateInfo["status"] = "unknown";
  let reValue: number | null = null;
  let reIncluded: boolean | null = null;
  let reSpan = "";

  const reMatch = text.match(/(?:real estate|property|building|facility)\s*:?\s*([^\n;]+)/i);
  if (reMatch) {
    reSpan = reMatch[0];
    const reText = reMatch[1].toLowerCase();
    if (reText.includes("home based") || reText.includes("home-based")) reStatus = "home_based";
    else if (reText.includes("leased") || reText.includes("rent")) reStatus = "leased";
    else if (reText.includes("owned") || reText.includes("seller owns")) reStatus = "owned";
    else if (reText.includes("on request")) reStatus = "on_request";

    if (reText.includes("included")) reIncluded = true;
    else if (reText.includes("excluded") || reText.includes("not included") || reText.includes("available separately")) reIncluded = false;

    const valMatch = reText.match(/\$\s*([\d,.]+)\s*(m|million|k|thousand)?/i);
    if (valMatch) {
      const scale = /^(m|million)$/i.test(valMatch[2] ?? "") ? 1e6 : /^(k|thousand)$/i.test(valMatch[2] ?? "") ? 1e3 : 1;
      reValue = Number(valMatch[1].replaceAll(",", "")) * scale;
    }
  } else if (/home[- ]based/i.test(text)) {
    reStatus = "home_based";
    reSpan = "Home-based";
  }

  // Employees
  let ft: number | null = null, pt: number | null = null, totalEmp: number | null = null;
  let empSpan = "";
  const empMatch = text.match(/employees\s*:?\s*(\d+)\s*(?:FT|full[- ]time)?(?:[,\s]+(\d+)\s*(?:PT|part[- ]time)?)?(?:[,\s]+(\d+)\s*(?:mgrs?|managers?))?/i);
  if (empMatch) {
    empSpan = empMatch[0];
    ft = empMatch[1] ? Number(empMatch[1]) : null;
    pt = empMatch[2] ? Number(empMatch[2]) : null;
    const mgrs = empMatch[3] ? Number(empMatch[3]) : 0;
    totalEmp = (ft ?? 0) + (pt ?? 0) + mgrs;
  } else {
    const simpleEmp = text.match(/(\d+)\s+employees/i);
    if (simpleEmp) {
      empSpan = simpleEmp[0];
      totalEmp = Number(simpleEmp[1]);
      ft = totalEmp;
    }
  }

  // Lease
  let leaseExp: string | null = null, monthlyRent: number | null = null;
  let leaseSpan = "";
  const leaseMatch = text.match(/lease (?:expiration|expires|ends)\s*:?\s*([^\n;]+)/i);
  if (leaseMatch) {
    leaseSpan = leaseMatch[0];
    leaseExp = leaseMatch[1].trim();
  }
  const rentMatch = text.match(/(?:rent|monthly rent|lease rate)\s*:?\s*\$?\s*([\d,.]+)/i);
  if (rentMatch) {
    monthlyRent = Number(rentMatch[1].replaceAll(",", ""));
  }

  // Financing & Implied Rate
  let sbaEligible: boolean | null = null, sellerFinancing: boolean | null = null, termsText: string | null = null, impliedRate: number | null = null;
  let finSpan = "";
  if (/SBA eligib(?:le|ility)\s*:?\s*Yes/i.test(text)) sbaEligible = true;
  else if (/SBA eligib(?:le|ility)\s*:?\s*No|no SBA|will not qualify for SBA/i.test(text)) sbaEligible = false;

  if (/seller financing\s*:?\s*Yes|seller financing (?:is )?available/i.test(text)) sellerFinancing = true;
  else if (/no seller financing|seller financing (?:is )?not available/i.test(text)) sellerFinancing = false;

  const termsMatch = text.match(/(\d+)\s+payments of\s+\$([\d,.]+)\s+on\s+\$([\d,.]+)/i);
  if (termsMatch) {
    termsText = termsMatch[0];
    finSpan = termsMatch[0];
    const n = Number(termsMatch[1]), pmt = Number(termsMatch[2].replaceAll(",", "")), princ = Number(termsMatch[3].replaceAll(",", ""));
    impliedRate = solveImpliedRate(princ, pmt, n);
  }

  // Inventory & FF&E inclusion
  let inventoryIncluded: boolean | null = null;
  if (/inventory (?:is )?included/i.test(text)) inventoryIncluded = true;
  else if (/inventory (?:is )?not included|inventory excluded/i.test(text)) inventoryIncluded = false;

  let ffeIncluded: boolean | null = null;
  if (/FF&E (?:is )?included|equipment (?:is )?included/i.test(text)) ffeIncluded = true;

  // Established Year
  let establishedYear: number | null = null;
  const estMatch = text.match(/(?:established|founded|year established)\s*(?:in|:)?\s*(\d{4})/i);
  if (estMatch) {
    establishedYear = Number(estMatch[1]);
  } else {
    const yrsMatch = text.match(/(\d+)\s+years in business/i);
    if (yrsMatch) {
      establishedYear = new Date().getFullYear() - Number(yrsMatch[1]);
    }
  }

  // Reason for selling
  const reasonMatch = text.match(/reason for selling\s*:?\s*([^\n;.]+)/i);
  const reasonForSelling = reasonMatch ? reasonMatch[1].trim() : (/owner retiring/i.test(text) ? "Retirement" : (/other business interests/i.test(text) ? "Other business interests" : null));

  // Category
  const catMatch = text.match(/(?:category|industry|business type)\s*:?\s*([^\n;.]+)/i);
  const category = catMatch ? catMatch[1].trim() : null;

  // Management & Licensing text
  const mgtMatch = text.match(/(?:management|run by|managed by)[^\n;.]+/i);
  const managementText = mgtMatch ? mgtMatch[0].trim() : null;

  const licMatch = text.match(/license[^.\n;]{0,100}/i);
  const licensingText = licMatch ? licMatch[0].trim() : null;

  return {
    realEstate: { status: reStatus, value: reValue, included: reIncluded, span: reSpan },
    employees: { fullTime: ft, partTime: pt, total: totalEmp, span: empSpan },
    lease: { expiration: leaseExp, monthlyRent, span: leaseSpan },
    financing: { sbaEligible, sellerFinancing, termsText, impliedRate, span: finSpan },
    inventoryIncluded,
    ffeIncluded,
    establishedYear,
    reasonForSelling,
    licensingText,
    managementText,
    category,
  };
}

export function extractListingEvidence(input: Source & { text: string }): ListingEvidence {
  if (!Number.isFinite(Date.parse(input.fetchedAt))) throw new Error("Capture timestamp required");
  const source: Source = { url: input.url, fetchedAt: input.fetchedAt, type: input.type };
  const text = input.text.split(/Similar Listings|Featured Listing|You May Also Like/i)[0];
  const fields = Object.fromEntries(Object.keys(labels).map(key => [key, moneyField(text, key as MoneyKey, source)])) as Record<MoneyKey, MoneyField>;
  const typedFields = extractNonFinancialFields(text);
  return { source, text, fields, typedFields };
}

/** Sentence/field boundaries retain contiguous source spans, including decimal values. */
const statements = (text: string) => text.split(/[;\n]|[.!](?=\s|$)/).map(s => s.trim()).filter(Boolean);
const uncertainClaim = /\b(?:no|not|without|lacks?|unknown|undisclosed|unconfirmed|unverified|unavailable|absent|none|may|might|could|would|will|tomorrow|future|if|unless|subject to|planned|proposed|potential|expected|estimated|approximately|about|roughly|previously|formerly|expired|terminated|cancelled|canceled)\b|\?/i;

/** Do not accept the first matching prefix when another statement qualifies or contradicts it. */
function explicitBoolean(text: string, topic: RegExp, yes: RegExp, no: RegExp) {
  const rows = statements(text).filter(s => topic.test(s));
  const parsed = rows.map(span => ({ span, value: yes.test(span) ? true : no.test(span) ? false : null }));
  const value = parsed.length && parsed.every(p => p.value !== null && p.value === parsed[0].value) ? parsed[0].value : null;
  return { value, span: value === null ? "" : parsed[0].span };
}

function exactDate(text: string, label: string) {
  const rows = statements(text).filter(s => new RegExp(label, "i").test(s));
  const dates = rows.map(span => {
    const match = span.match(new RegExp("^(?:" + label + ")\\s*:?\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{2}/\\d{2}/\\d{4})$", "i"));
    if (!match) return null;
    const raw = match[1], parts = raw.includes("-") ? raw.split("-").map(Number) : raw.split("/").map(Number);
    // Both slash components <=12 are locale-ambiguous; partial dates also stay unresolved.
    if (raw.includes("/") && parts[1] <= 12) return null;
    const [year, month, day] = raw.includes("-") ? parts : [parts[2], parts[0], parts[1]];
    const time = Date.UTC(year, month - 1, day), date = new Date(time);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { time, span } : null;
  });
  return dates.length && dates.every(d => d && d.time === dates[0]?.time) ? dates[0] : null;
}

/** Shared by discovery and screening: only explicit unavailable claims exclude a listing. */
export function acquisitionUnavailableSpan(text: string): string {
  return statements(text).find(s => /^(?:this listing (?:is )?(?:no longer available|has expired)|listing status\s*:\s*(?:sold|pending|sale pending|under contract|delisted|expired|withdrawn)|(?:this (?:listing|business) is )?(?:sale pending|under contract))$/i.test(s)) ?? "";
}

/** Cross-listing conflict detector (V7 from spec line 185). */
export type CrossListingConflict = {
  listingAUrl: string;
  listingBUrl: string;
  fingerprint: string;
  conflictType: "financial_year_conflict";
  detail: string;
  brokerQuestion: string;
};

export function detectCrossListingConflicts(listings: ListingEvidence[]): CrossListingConflict[] {
  const conflicts: CrossListingConflict[] = [];
  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      const a = listings[i], b = listings[j];
      const askA = a.fields.ask.value, askB = b.fields.ask.value;
      const ffeA = a.fields.ffe.value, ffeB = b.fields.ffe.value;
      const estA = a.typedFields?.establishedYear ?? null, estB = b.typedFields?.establishedYear ?? null;

      // Fingerprint match on ask and (ffe or established)
      if (askA != null && askA === askB && ((ffeA != null && ffeA === ffeB) || (estA != null && estA === estB))) {
        const sdeA = a.fields.sde.value, sdeB = b.fields.sde.value;
        const revA = a.fields.revenue.value, revB = b.fields.revenue.value;

        const sdeDiff = sdeA != null && sdeB != null && sdeA > 0 ? Math.abs(sdeA - sdeB) / Math.max(sdeA, sdeB) : 0;
        const revDiff = revA != null && revB != null && revA > 0 ? Math.abs(revA - revB) / Math.max(revA, revB) : 0;

        if (sdeDiff > 0.10 || revDiff > 0.10) {
          conflicts.push({
            listingAUrl: a.source.url,
            listingBUrl: b.source.url,
            fingerprint: `ask:$${askA}|ffe:$${ffeA}|est:${estA}`,
            conflictType: "financial_year_conflict",
            detail: `Matching listing terms with diverging figures: SDE diff ${Math.round(sdeDiff * 100)}%, Revenue diff ${Math.round(revDiff * 100)}%`,
            brokerQuestion: "Which fiscal year does each figure reflect?",
          });
        }
      }
    }
  }
  return conflicts;
}

export function evaluateAcquisitionV2(
  evidence: ListingEvidence,
  input: AcquisitionMandate,
  options?: { categoryBenchmark?: CategoryBenchmark | null }
) {
  const mandate = acquisitionMandateSchema.parse(input);
  const exact = (key: MoneyKey) => evidence.fields[key].state === "value" ? evidence.fields[key].value : null;
  const ask = exact("ask"), sde = exact("sde"), revenue = exact("revenue");
  const inventory = exact("inventory"), ffe = exact("ffe");

  const ratio = (a: number | null, b: number | null): Ratio | null =>
    a != null && b != null && b > 0 ? { value: a / b, formula: `${a} / ${b}` } : null;

  // Extended V3 ratios
  const multiple = ratio(ask, sde);
  const sdeMargin = ratio(sde, revenue);
  const inventoryPct = ratio(inventory, revenue);
  const hardAssets = (inventory ?? 0) + (ffe ?? 0) + (evidence.typedFields?.realEstate?.included ? (evidence.typedFields.realEstate.value ?? 0) : 0);
  const hardAssetShare = ask != null && hardAssets > 0 ? ratio(hardAssets, ask) : null;
  const goodwill = ask != null && hardAssets > 0 ? { value: Math.max(0, ask - hardAssets), formula: `${ask} - ${hardAssets}` } : null;

  const text = evidence.text;
  const capture = (pattern: RegExp) => text.match(pattern)?.[0] ?? "";
  const positiveCapture = (pattern: RegExp, topic: RegExp = pattern) => {
    const rows = statements(text).filter(s => topic.test(s));
    return rows.length && rows.every(s => pattern.test(s) && !uncertainClaim.test(s)) ? rows[0] : "";
  };

  const sbaClaim = explicitBoolean(text, /\bSBA\b|\bcash only\b/i,
    /^(?:SBA eligib(?:le|ility)\s*:?\s*Yes|SBA[- ]eligible)$/i,
    /^(?:SBA eligib(?:le|ility)\s*:?\s*No|no SBA|will not qualify for SBA|not SBA[- ]eligible|cash only)$/i);
  const sellerClaim = explicitBoolean(text, /\bseller financing\b/i,
    /^(?:seller financing\s*:?\s*Yes|seller financing (?:is )?available)$/i,
    /^(?:seller financing\s*:?\s*No|no seller financing|seller financing (?:is )?not available)$/i);
  const sba = sbaClaim.value, seller = sellerClaim.value;
  const refusal = sba === false ? sbaClaim.span : "";
  const unavailable = acquisitionUnavailableSpan(text);
  const activeClaim = explicitBoolean(text, /\blisting status\b/i, /^listing status\s*:\s*active$/i, /^(?!)$/);
  const active = activeClaim.value === true ? activeClaim.span : "";
  const management = positiveCapture(/management team in place|manager[- ]run|management layer in place/i, /management team|manager[- ]run|management layer/i);
  const ownerRequired = statements(text).find(s => /^(?:(?:(?:this )?(?:business|listing|seller) )?(?:requires? (?:an? )?owner[- ]operator|rejects? passive buyers)|owner[- ]operator required|passive buyers (?:not accepted|will not be considered))$/i.test(s)) ?? "";
  const moat = positiveCapture(/(?:recurring|maintenance) contracts|mandated inspections|required inspections|route density|AS9100 certification/i);

  const concentration = (label: string) => {
    const rows = statements(text).filter(s => new RegExp(label, "i").test(s));
    const values = rows.map(span => {
      const match = span.match(new RegExp("^(?:" + label + ")\\s*(?::|accounts? for|represents?)?\\s*(\\d+(?:\\.\\d+)?)\\s*%(?: of (?:annual )?revenue)?$", "i"));
      return match && Number(match[1]) <= 100 ? { value: Number(match[1]) / 100, span } : null;
    });
    return values.length && values.every(v => v && v.value === values[0]?.value) ? values[0] : null;
  };
  const single = concentration("Largest customer|Single customer"), top3 = concentration("Top (?:3|three) customers");
  const principal = ask == null ? null : (ask + mandate.closingCosts) * (1 - mandate.equityPct);
  const debtService = principal == null ? null : annualDebtService(principal, mandate.rate, mandate.termYears);
  const dscr = ratio(sde, debtService);
  const location = capture(/(?:Business )?Location\s*:\s*[^\n;]+/i);
  const geoMatches = mandate.geographies.some(g => new RegExp(`(?:^|[^a-z])${g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z])`, "i").test(location));
  const financingFailed = ((sba === false || !!refusal) && seller === false) || (dscr != null && dscr.value < mandate.dscrMin);

  const gates: Gate[] = [
    { id: "GEO", result: !mandate.geographies.length ? "pass" : !location ? "unknown" : geoMatches ? "pass" : "fail", detail: !mandate.geographies.length ? "Operator selected unrestricted geography." : `${location || "Location not captured"}; required: ${mandate.geographies.join(", ")}. No remote-category exception assumed.` },
    { id: "G1", result: ask == null ? "unknown" : ask < mandate.priceMin || ask > mandate.priceMax ? "fail" : "pass", detail: `Asking price must be ${mandate.priceMin}–${mandate.priceMax}; exact captured amount required.` },
    { id: "G2", result: sde == null ? "unknown" : sde < mandate.watchlistMin ? "fail" : sde < mandate.sdeMin ? "cap" : "pass", detail: `SDE: pursue floor ${mandate.sdeMin}; watchlist floor ${mandate.watchlistMin}.` },
    { id: "G3", result: !sdeMargin ? "unknown" : sdeMargin.value < mandate.marginMin ? "fail" : "pass", detail: `SDE / revenue must be at least ${mandate.marginMin}.` },
    { id: "G4", result: financingFailed ? "fail" : (sba === true || seller === true) && dscr ? "pass" : "unknown", detail: `Financing path must be disclosed; modeled SDE / annual debt service must be at least ${mandate.dscrMin}. This is not lender approval.` },
    { id: "G5", result: !mandate.managementRequired ? "pass" : ownerRequired ? "fail" : management ? "pass" : "cap", detail: ownerRequired || management || "Management evidence absent; maximum WATCHLIST when all other required evidence is available." },
    { id: "G6", result: unavailable ? "fail" : active ? "pass" : "unknown", detail: unavailable || active || "Current listing status not explicitly established in capture." },
    { id: "G7", result: sde == null ? "unknown" : sde < mandate.sdeMin && (!moat || sde < mandate.watchlistMin) ? "fail" : "pass", detail: "Below-pursue earnings require the watchlist floor and a named moat; higher-earnings risk caps remain valid." },
    { id: "G10", result: top3 && top3.value > mandate.top3Max ? "fail" : !single || !top3 ? "unknown" : single.value > mandate.singleCustomerMax ? "cap" : "pass", detail: `Disclosed largest customer ≤ ${mandate.singleCustomerMax}; top three ≤ ${mandate.top3Max}.` },
    { id: "G11", result: moat ? "pass" : "cap", detail: moat || "No captured recurring or mandated revenue evidence." },
    { id: "G12", result: (["ask", "sde", "revenue"] as MoneyKey[]).every(k => evidence.fields[k].state === "value") ? "pass" : "unknown", detail: "Core figures must be exact, non-conflicting captured claims." },
  ];

  const redFlags: RedFlag[] = [];
  if (sba === false) redFlags.push({ id: "R11", severity: seller === false ? "critical" : "high", span: refusal, brokerQuestion: "Why is SBA unavailable, and are any seller financing terms offered in writing?" });
  if ((single && single.value > mandate.singleCustomerMax) || (top3 && top3.value > mandate.top3Max)) redFlags.push({ id: "R12", severity: top3 && top3.value > mandate.top3Max ? "critical" : "high", span: [single?.span, top3?.span].filter(Boolean).join("; "), brokerQuestion: "Top-five customers by revenue share?" });
  const flag = (id: string, severity: RedFlag["severity"], span: string, brokerQuestion: string) => { if (span) redFlags.push({ id, severity, span, brokerQuestion }); };
  flag("R1", "high", capture(/license holder\s*:\s*(?:owner|undisclosed)|qualifier[^.\n]{0,120}will consider|licensing required[^.\n]{0,80}(?:owner|undisclosed)/i), "Who holds each license, are they staying, and on what written terms? Verify jurisdiction-specific requirements.");
  flag("R2", "high", capture(/(?:management|run by|managed by)[^\n.]{0,140}\b(?:brother|father|spouse|son|daughter|wife|husband)\b[^\n.]*|(?:brother|father|spouse|son|daughter)[^\n.]{0,80}(?:run|manage)[^\n.]*/i), "Are family members on payroll at market rates, and will they sign retention agreements?");
  flag("R3", "high", capture(/collective bargaining[^\n.]*|(?:unionized|union workforce|union pension)[^\n.]*/i), "Is the pension a multiemployer plan, and what is the estimated withdrawal liability?");

  const lease = exactDate(text, "lease (?:expiration|expires|expired|ends)");
  const loanEnd = new Date(evidence.source.fetchedAt); loanEnd.setUTCFullYear(loanEnd.getUTCFullYear() + mandate.termYears);
  if (lease && lease.time < loanEnd.getTime()) flag("R4", "high", lease.span, "What are the current lease status, renewal options, and assignability?");
  flag("R5", "medium", capture(/seller owns (?:the )?real estate[^\n.]{0,100}excluded|real estate[^\n.]{0,80}seller[- ]owned[^\n.]{0,80}excluded/i), "Is market rent already deducted in SDE?");

  if (inventory != null && revenue != null && revenue > 0 && inventory / revenue > .15) flag("R6", "medium", evidence.fields.inventory.span, "Will inventory be counted at close with a price adjustment?");
  if (sde != null && exact("ebitda") === sde) flag("R7", "medium", evidence.fields.ebitda.span, "Does the owner draw a salary on the books?");

  // Category Benchmark detectors (R8, R14, lemons_benchmark, auction_benchmark)
  const benchmark = options?.categoryBenchmark ?? lookupCategoryBenchmark(mandate.category ?? evidence.typedFields?.category);
  const disabledDetectors: { id: string; reason: string }[] = [];

  if (benchmark) {
    if (sdeMargin && sdeMargin.value > benchmark.sdeMarginP90) {
      flag("R8", "medium", evidence.fields.sde.span, `Please itemize every add-back. (SDE margin ${(sdeMargin.value * 100).toFixed(1)}% exceeds category 90th percentile ${(benchmark.sdeMarginP90 * 100).toFixed(1)}%)`);
    }
    const empTotal = evidence.typedFields?.employees?.total;
    if (revenue != null && empTotal && empTotal > 0 && (revenue / empTotal) > benchmark.revenuePerEmployeeP90) {
      flag("R14", "medium", evidence.typedFields?.employees?.span || `${revenue} / ${empTotal}`, `What share of revenue is pass-through equipment or subcontracting? (Revenue/emp $${Math.round(revenue / empTotal).toLocaleString()} exceeds category 90th percentile $${benchmark.revenuePerEmployeeP90.toLocaleString()})`);
    }
  } else {
    disabledDetectors.push(
      { id: "R8", reason: "No approved category margin-percentile table supplied." },
      { id: "R14", reason: "No approved category revenue-per-employee table supplied." },
      { id: "lemons_benchmark", reason: "No approved category multiple 25th percentile supplied; text triggers remain available." },
      { id: "auction_benchmark", reason: "No approved category multiple median supplied; listing-age trigger remains available." }
    );
  }

  const listed = exactDate(text, "listing date|listed on");
  const age = listed ? (Date.parse(evidence.source.fetchedAt) - listed.time) / 86400000 : null;
  const stale = new Date(evidence.source.fetchedAt); stale.setUTCMonth(stale.getUTCMonth() - 9);
  flag("R9", "medium", positiveCapture(/price reduced/i) || (listed && listed.time < stale.getTime() ? listed.span : ""), "Why hasn't it sold, and what offers were declined?");
  flag("R10", "medium", capture(/other business interests|motivated seller/i), "Is the new venture competitive? Have counsel assess any proposed restrictive covenants.");
  const platform = capture(/(?:platform|counterparty|franchisor|network) controls (?:price|pricing|dispatch|access)/i);
  const platformShare = concentration("Platform revenue share|Counterparty revenue share");
  flag("R13", platformShare && platformShare.value > .5 ? "critical" : "high", platform ? `${platform}${platformShare ? `; ${platformShare.span}` : ""}` : "", "Can the counterparty change terms unilaterally? Verify contract control and revenue share.");

  const training = text.match(/training\s*:?\s*(\d+) days/i);
  if (training && Number(training[1]) < 30 && /owner works in the business|owner[- ]operated/i.test(text)) flag("R15", "medium", training[0], "Will the seller commit to 90 days of paid transition?");
  redFlags.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

  const has = (id: string) => redFlags.some(f => f.id === id);
  const lemonsTriggered = has("R9") || has("R10") || (benchmark != null && multiple != null && multiple.value < benchmark.multipleP25);
  const auctionTriggered = (age != null && age >= 0 && age < 60) || (benchmark != null && multiple != null && multiple.value < benchmark.multipleMedian);

  const games = [
    ...(has("R1") || has("R4") ? [{ id: "hold_up", question: "Verify transition, renewal, pricing and retention conditions before closing; obtain qualified legal review." }] : []),
    ...(has("R2") || has("R1") ? [{ id: "defection", question: "Verify key-person retention and customer continuity. Counsel must review jurisdiction-specific remedies." }] : []),
    ...(lemonsTriggered ? [{ id: "lemons", question: "Compare seller-note and lower-price alternatives; a seller's choice is not proof of hidden defects." }] : []),
    ...(auctionTriggered ? [{ id: "auction", question: "Investigate competitive interest; a recent listing does not establish another bidder." }] : []),
    ...(has("R13") ? [{ id: "platform", question: "Do not rely on platform access or economics without written terms and concentration evidence." }] : []),
  ];

  const hours = text.match(/owner hours per week\s*:\s*(\d+(?:\.\d+)?)/i);
  const sellerHourlyHeuristic = hours && Number(hours[1]) > 0 && sde != null ? {
    value: sde / (Number(hours[1]) * 52), formula: `${sde} / (${hours[1]} * 52)`, span: hours[0],
    label: "SDE per reported owner hour: heuristic, not salary or evidence of willingness to sell",
  } : null;
  if (sellerHourlyHeuristic) games.push({
    id: "bargaining",
    question: sellerHourlyHeuristic.value > 1000
      ? "The SDE/hour heuristic suggests testing terms as well as price. Verify actual owner effort and alternatives; motivation is unknown."
      : "Investigate the seller's actual alternatives. SDE/hour alone does not establish negotiating leverage.",
  });

  const players = ["seller", "broker", "lender", "potential competing buyers"].map(role => ({
    role, sourceSpan: null as string | null, basis: "Workflow role, not a verified party",
    preCloseLeverage: null as number | null, postCloseLeverage: null as number | null,
  }));
  for (const f of redFlags.filter(f => ["R1", "R2", "R4", "R13"].includes(f.id))) {
    players.push({
      role: ({ R1: "license holder", R2: "family management", R4: "landlord", R13: "platform counterparty" } as Record<string, string>)[f.id],
      sourceSpan: f.span,
      basis: "Role inferred from captured claim; leverage levels are unverified scenario assumptions",
      preCloseLeverage: 1,
      postCloseLeverage: 3,
    });
  }

  const value = gates.some(g => g.result === "fail") || redFlags.some(f => f.severity === "critical") ? "FAIL"
    : gates.some(g => g.result === "unknown") ? "HOLD"
    : gates.some(g => g.result === "cap") || redFlags.filter(f => f.severity === "high").length >= 3 ? "WATCHLIST" : "PURSUE";

  return {
    engineVersion: ACQUISITION_V2_ENGINE_VERSION,
    mandateVersion: mandate.version,
    mandate,
    source: evidence.source,
    fields: evidence.fields,
    typedFields: evidence.typedFields,
    ratios: { multiple, sdeMargin, dscr, inventoryPct, hardAssetShare, goodwill },
    gates,
    redFlags,
    excluded: !!unavailable,
    disabledDetectors,
    games,
    players,
    sellerHourlyHeuristic,
    benchmarkUsed: benchmark ? { category: benchmark.category, version: benchmark.source } : null,
    financing: {
      principal,
      annualDebtService: debtService,
      impliedRate: evidence.typedFields?.financing?.impliedRate ?? null,
      label: "Modeled assumption, not financing approval",
    },
    verdict: {
      value,
      computedBy: "code" as const,
      reason: gates.filter(g => g.result !== "pass").map(g => `${g.id}: ${g.detail}`).join(" ") || "All applicable gates passed.",
    },
  };
}
