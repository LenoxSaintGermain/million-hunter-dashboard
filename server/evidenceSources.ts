import { ENV } from "./_core/env";

/** Approved endpoint family only. No client supplied URLs or fallback provider. */
export const SEC_EVIDENCE_SOURCE = {
  id: "sec-submissions" as const,
  schemaVersion: 1 as const,
  origin: "https://data.sec.gov",
  documentation: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
  accessPolicy: "https://www.sec.gov/about/developer-resources",
  attribution: "U.S. Securities and Exchange Commission — EDGAR submissions",
  auth: "No API key; identified User-Agent required",
  coverage: "Current submissions recent-file index only; not a complete archive or filing-content analysis",
  freshnessMs: 24 * 60 * 60 * 1000,
  budget: { globalPerSecond: 1, globalPerMinute: 30, ownerPerMinute: 6 },
  enabled: () => ENV.secEvidenceEnabled,
};
