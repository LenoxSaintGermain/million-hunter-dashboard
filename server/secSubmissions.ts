import { z } from "zod";
import { ENV } from "./_core/env";
import type {
  SecFailureCode,
  SecFiling,
  SecSubmissionsResult,
} from "../shared/secEvidence";
export type {
  SecFailureCode,
  SecFiling,
  SecSubmissionsResult,
} from "../shared/secEvidence";

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_ROWS = 10_000;
// Deliberately below SEC's 10 requests/sec aggregate limit. Parent must reserve
// durable cross-instance/other-SEC-adapter budget BEFORE invoking this adapter.
let nextRequestAt = 0;
let cooldownUntil = 0;
let inFlight = 0;

class SecError extends Error {
  constructor(
    readonly code: SecFailureCode,
    message: string
  ) {
    super(message);
  }
}
export function normalizeSecCik(cik: string): string {
  if (typeof cik !== "string" || !/^\d{1,10}$/.test(cik) || /^0+$/.test(cik))
    throw new SecError(
      "INVALID_CIK",
      "CIK must contain 1–10 digits and be nonzero."
    );
  return cik.padStart(10, "0");
}
const realDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const date = new Date(value + "T00:00:00Z");
    return (
      value.slice(0, 4) !== "0000" &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");
const safeDocument = z
  .string()
  .min(1)
  .max(512)
  .refine(
    value =>
      value
        .split("/")
        .every(segment => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(segment)),
    "Unsafe primary document path"
  );
const rowSchema = z.object({
  accessionNumber: z.string().regex(/^\d{10}-\d{2}-\d{6}$/),
  form: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 /._-]*$/),
  filingDate: realDate,
  reportDate: z.union([realDate, z.literal(""), z.null()]),
  primaryDocument: safeDocument,
});
const requiredColumns = [
  "accessionNumber",
  "form",
  "filingDate",
  "reportDate",
  "primaryDocument",
] as const;
const stringColumns = new Set([
  "acceptanceDateTime",
  "act",
  "fileNumber",
  "filmNumber",
  "items",
  "primaryDocDescription",
  "core_type",
]);
// isXBRLNumeric observed as 0/1/null in SEC's response on 2026-10-11.
const numericColumns = new Set([
  "size",
  "isXBRL",
  "isInlineXBRL",
  "isXBRLNumeric",
]);

function parseSubmissions(
  raw: unknown,
  cik: string
): { company: { cik: string; name: string }; filings: SecFiling[] } {
  const payload = z
    .object({
      cik: z.union([
        z.string().regex(/^\d{1,10}$/),
        z.number().int().positive().max(9999999999),
      ]),
      name: z
        .string()
        .min(1)
        .max(2000)
        .refine(v => v.trim().length > 0),
      filings: z.object({ recent: z.record(z.string(), z.unknown()) }),
    })
    .parse(raw);
  let responseCik: string;
  try {
    responseCik = normalizeSecCik(String(payload.cik));
  } catch {
    throw new SecError("INVALID_RESPONSE", "SEC returned an invalid CIK.");
  }
  if (responseCik !== cik)
    throw new SecError(
      "CIK_MISMATCH",
      "SEC response CIK does not match the requested company."
    );
  const columns = payload.filings.recent;
  for (const key of requiredColumns)
    if (!Array.isArray(columns[key]))
      throw new SecError(
        "INVALID_RESPONSE",
        "SEC recent filings are missing a required array."
      );
  const count = (columns.accessionNumber as unknown[]).length;
  if (count > MAX_ROWS)
    throw new SecError(
      "INVALID_RESPONSE",
      "SEC recent filings exceed the row limit."
    );
  const entries = Object.entries(columns);
  for (const [key, values] of entries) {
    if (!Array.isArray(values) || values.length !== count)
      throw new SecError(
        "INVALID_RESPONSE",
        "SEC parallel filing arrays have inconsistent lengths or types."
      );
    if (
      !stringColumns.has(key) &&
      !numericColumns.has(key) &&
      !requiredColumns.includes(key as (typeof requiredColumns)[number])
    )
      throw new SecError(
        "INVALID_RESPONSE",
        "SEC returned an unrecognized filing column."
      );
    for (const value of values) {
      if (key === "acceptanceDateTime") {
        const timestamp = z.iso.datetime({ offset: true }).parse(value);
        realDate.parse(timestamp.slice(0, 10));
      } else if (stringColumns.has(key)) z.string().max(16000).parse(value);
      else if (numericColumns.has(key)) {
        if (key === "isXBRLNumeric" && value === null) continue;
        z.number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER)
          .parse(value);
        if (key !== "size" && value !== 0 && value !== 1)
          throw new SecError("INVALID_RESPONSE", "SEC XBRL flag is invalid.");
      } else if (
        !requiredColumns.includes(key as (typeof requiredColumns)[number])
      ) {
        // Reject unreviewed schema additions rather than silently omit evidence.
        throw new SecError(
          "INVALID_RESPONSE",
          "SEC returned an unrecognized filing column."
        );
      }
    }
  }
  const seen = new Map<string, string>();
  const filings: SecFiling[] = [];
  for (let i = 0; i < count; i++) {
    const rawRow = Object.fromEntries(
      entries.map(([key, values]) => [key, (values as unknown[])[i]])
    );
    const row = rowSchema.parse(rawRow);
    // Compare all source columns, not just normalized output. Identical repeats
    // collapse in source order; conflicting repeats invalidate the entire capture.
    const signature = JSON.stringify(rawRow);
    const previous = seen.get(row.accessionNumber);
    if (previous !== undefined) {
      if (previous !== signature)
        throw new SecError(
          "CONFLICTING_ACCESSION",
          "SEC returned conflicting rows for the same accession."
        );
      continue;
    }
    seen.set(row.accessionNumber, signature);
    filings.push({
      ...row,
      reportDate: row.reportDate || null,
      url:
        "https://www.sec.gov/Archives/edgar/data/" +
        String(Number(cik)) +
        "/" +
        row.accessionNumber.replace(/-/g, "") +
        "/" +
        row.primaryDocument,
    });
  }
  return { company: { cik, name: payload.name }, filings };
}

function retryDelay(value: string | null): number {
  if (!value) return 60_000;
  const delay = /^\d+$/.test(value)
    ? Number(value) * 1000
    : Date.parse(value) - Date.now();
  // Never retry earlier than SEC asks; invalid values use a conservative minute.
  return Number.isFinite(delay) ? Math.max(60_000, delay) : 60_000;
}

async function fetchBody(
  sourceUrl: string,
  userAgent: string
): Promise<unknown> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new SecError(
          "TIMEOUT",
          "SEC request exceeded the 8-second response deadline."
        )
      );
      controller.abort();
      void reader?.cancel().catch(() => {});
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      deadline,
      (async () => {
        const response = await fetch(sourceUrl, {
          redirect: "error",
          signal: controller.signal,
          headers: { "User-Agent": userAgent, Accept: "application/json" },
        });
        if (controller.signal.aborted) {
          void response.body?.cancel().catch(() => {});
          throw new SecError(
            "TIMEOUT",
            "SEC response arrived after the deadline."
          );
        }
        if (response.status === 429) {
          cooldownUntil = Math.max(
            cooldownUntil,
            Math.min(
              8.64e15,
              Date.now() + retryDelay(response.headers.get("retry-after"))
            )
          );
          void response.body?.cancel().catch(() => {});
          throw new SecError(
            "RATE_LIMITED",
            "SEC returned HTTP 429; requests are paused until " +
              new Date(cooldownUntil).toISOString() +
              "."
          );
        }
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          throw new SecError(
            "HTTP_ERROR",
            "SEC returned HTTP " + response.status + "."
          );
        }
        if (Number(response.headers.get("content-length")) > MAX_BYTES) {
          void response.body?.cancel().catch(() => {});
          throw new SecError("BODY_TOO_LARGE", "SEC response exceeds 5 MiB.");
        }
        if (
          !/^application\/json(?:\s*;|$)/i.test(
            response.headers.get("content-type") ?? ""
          )
        ) {
          void response.body?.cancel().catch(() => {});
          throw new SecError(
            "INVALID_RESPONSE",
            "SEC did not return application/json."
          );
        }
        if (!response.body)
          throw new SecError("INVALID_RESPONSE", "SEC returned no body.");
        reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let bytes = 0;
        let body = "";
        while (true) {
          const chunk = await reader.read();
          if (controller.signal.aborted)
            throw new SecError(
              "TIMEOUT",
              "SEC body read exceeded the deadline."
            );
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > MAX_BYTES)
            throw new SecError("BODY_TOO_LARGE", "SEC response exceeds 5 MiB.");
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
        try {
          return JSON.parse(body);
        } catch {
          throw new SecError("INVALID_JSON", "SEC returned malformed JSON.");
        }
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
    void reader?.cancel().catch(() => {});
  }
}

/** No cache, retries or secondary-file fetches. Caller owns persistent evidence
 * capture and durable budget. This module never imports DB or dotenv.
 * SEC docs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
 * Fair access: https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data
 */
export async function fetchSecSubmissions(
  input: string
): Promise<SecSubmissionsResult> {
  let sourceUrl = "https://data.sec.gov/submissions/";
  try {
    const cik = normalizeSecCik(input);
    sourceUrl += "CIK" + cik + ".json";
    const userAgent = ENV.secUserAgent;
    if (
      !userAgent ||
      userAgent.length > 256 ||
      /[^\x20-\x7e]/.test(userAgent) ||
      !/^\S.*\s+[^\s@]+@[^\s@]+\.[^\s@]+/.test(userAgent)
    ) {
      throw new SecError(
        "IDENTITY_NOT_CONFIGURED",
        "Configure SEC_USER_AGENT with your organization and real contact email before accessing SEC."
      );
    }
    const now = Date.now();
    if (now < cooldownUntil)
      throw new SecError(
        "RATE_LIMITED",
        "SEC cooldown remains active until " +
          new Date(cooldownUntil).toISOString() +
          "."
      );
    if (now < nextRequestAt || inFlight >= 2)
      throw new SecError(
        "RATE_LIMITED",
        "SEC process fair-access budget is busy; retry later."
      );
    nextRequestAt = now + 250;
    inFlight++;
    try {
      const data = parseSubmissions(await fetchBody(sourceUrl, userAgent), cik);
      return {
        status: data.filings.length ? "ok" : "empty",
        sourceUrl,
        retrievedAt: new Date().toISOString(),
        ...data,
        message:
          "Recent SEC submissions only; additional historical files were not fetched.",
        failureCode: null,
      };
    } finally {
      inFlight--;
    }
  } catch (error) {
    const code =
      error instanceof SecError
        ? error.code
        : error instanceof z.ZodError
          ? "INVALID_RESPONSE"
          : "NETWORK_ERROR";
    const message =
      error instanceof SecError
        ? error.message
        : error instanceof z.ZodError
          ? "SEC response failed runtime validation."
          : "SEC network or body read failed.";
    return {
      status: "unavailable",
      // Only a provider-imposed cooldown belongs in the durable global budget.
      // Local spacing/in-flight pressure must not pause every deployment instance.
      ...(code === "RATE_LIMITED" && cooldownUntil > Date.now()
        ? {
            retryAt: new Date(cooldownUntil).toISOString(),
          }
        : {}),
      sourceUrl,
      retrievedAt: null,
      company: null,
      filings: [],
      message,
      failureCode: code,
    };
  }
}
