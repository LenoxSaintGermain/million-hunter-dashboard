/**
 * Gemini model-ID live validator — Signal Hunter OS
 *
 * Establishes GROUND TRUTH for which Gemini model IDs the production
 * GEMINI_API_KEY can actually call. Neither CLAUDE.md nor shared/models.ts is
 * trusted here — only the API response is.
 *
 * Run FROM THE REPO ROOT:
 *     npx tsx scripts/validate-models.ts
 *
 * Cost: one ~1-token generation per candidate. Re-runnable, safe, read-only.
 * Touches no database (dotenv is loaded only for GEMINI_API_KEY).
 */

import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { VALID_GEMINI_IDS } from "../shared/models";

// Candidates = declared-valid set ∪ every id seen hardcoded or documented anywhere.
const EXTRA_CANDIDATES = [
  "gemini-3.1-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
];

const CANDIDATES = Array.from(
  new Set<string>([...Array.from(VALID_GEMINI_IDS), ...EXTRA_CANDIDATES]),
).sort();

interface Result {
  id: string;
  ok: boolean;
  detail: string;
  authFailure: boolean;
}

function classify(err: unknown): { detail: string; authFailure: boolean } {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
  const flat = raw.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  const authFailure =
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("permission_denied") ||
    lower.includes("unauthenticated") ||
    lower.includes("401") ||
    lower.includes("403");
  return { detail: flat.slice(0, 260), authFailure };
}

async function probe(genai: GoogleGenAI, id: string): Promise<Result> {
  try {
    const res = await genai.models.generateContent({
      model: id,
      contents: "hi",
      config: { maxOutputTokens: 1, temperature: 0 },
    });
    // A response object at all means the model id resolved and billed a call.
    const text = (res as any)?.text ?? "";
    return {
      id,
      ok: true,
      detail: `responded (${String(text).length} chars)`,
      authFailure: false,
    };
  } catch (err) {
    const { detail, authFailure } = classify(err);
    return { id, ok: false, detail, authFailure };
  }
}

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("FATAL: GEMINI_API_KEY is not set. Cannot establish ground truth.");
    console.error("Refusing to guess which models are valid. Set the key and re-run.");
    process.exit(1);
  }

  const genai = new GoogleGenAI({ apiKey: key });

  console.log(`Gemini model validation — ${new Date().toISOString()}`);
  console.log(`Candidates: ${CANDIDATES.length}\n`);

  const results: Result[] = [];
  for (const id of CANDIDATES) {
    process.stdout.write(`  probing ${id} ... `);
    const r = await probe(genai, id);
    results.push(r);
    console.log(r.ok ? "PASS" : "FAIL");
  }

  const width = Math.max(...CANDIDATES.map((c) => c.length));
  console.log("\n┌─ VALIDATION MATRIX ───────────────────────────────────────────");
  for (const r of results) {
    console.log(`│ ${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(width)}  ${r.detail}`);
  }
  console.log("└───────────────────────────────────────────────────────────────");

  const passed = results.filter((r) => r.ok).map((r) => r.id);
  const failed = results.filter((r) => !r.ok);
  const allAuth = failed.length === results.length && failed.every((r) => r.authFailure);

  console.log(`\nPASSED (${passed.length}): ${passed.join(", ") || "(none)"}`);
  console.log(`FAILED (${failed.length}): ${failed.map((r) => r.id).join(", ") || "(none)"}`);

  if (allAuth) {
    console.log(
      "\nWARNING: every candidate failed for an AUTH reason, not model-not-found.",
    );
    console.log("This run proves NOTHING about model availability. Fix the key and re-run.");
  }

  console.log("\nCopy the PASSED list into shared/models.ts VALID_GEMINI_IDS.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Validator crashed:", err);
  process.exit(1);
});
