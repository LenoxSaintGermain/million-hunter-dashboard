export type SecFailureCode =
  | "INVALID_CIK"
  | "IDENTITY_NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "CAPTURE_INTERRUPTED" // Durable claim recovery only; not adapter-produced.
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "BODY_TOO_LARGE"
  | "NETWORK_ERROR"
  | "INVALID_JSON"
  | "INVALID_RESPONSE"
  | "CIK_MISMATCH"
  | "CONFLICTING_ACCESSION";

export interface SecFiling {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate: string | null;
  primaryDocument: string;
  url: string;
}

/** Current submissions' filings.recent only; not complete historical coverage.
 * No inference links amendments to originals. Failure always has no company or
 * filings; retrievedAt is null unless a complete validated capture succeeded.
 */
export interface SecSubmissionsResult {
  status: "ok" | "empty" | "unavailable";
  sourceUrl: string;
  retrievedAt: string | null;
  company: { cik: string; name: string } | null;
  filings: SecFiling[];
  message: string | null;
  failureCode: SecFailureCode | null;
  /** ISO deadline for durable cross-instance cooldown; present on RATE_LIMITED. */
  retryAt?: string;
}
