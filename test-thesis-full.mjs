/**
 * Full thesis compilation test — json_object format (no schema enforcement)
 * Run with: node test-thesis-full.mjs
 */
import { config } from "dotenv";
config();

const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;

console.log("=== Environment ===");
console.log("FORGE_KEY present:", !!FORGE_KEY);
console.log("FORGE_URL:", FORGE_URL);

const forgeUrl = `${FORGE_URL.replace(/\/$/, "")}/v1/chat/completions`;

const SYSTEM_PROMPT = `You are STRATEGIST. Compile investment theses into structured JSON.
All numeric values MUST be plain integers with NO decimal points (e.g. 2000000 not 2000000.0).
Return ONLY valid JSON. No markdown, no code fences.`;

console.log("\n=== LLM Call (json_object format) ===");
try {
  const res = await fetch(forgeUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${FORGE_KEY}` },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Compile this investment thesis into a JSON object with these exact keys: compiledFilters (object with revenueMin, revenueMax, geographies, businessAgeMin, headcountMin, headcountMax, exclusions), scoringWeights (array of {dimension, weight, isCustom}), evidenceRequirements (array), autoDisqualifiers (array), confidenceNotes (array), estimatedTargetsMin, estimatedTargetsMax, estimatedCostMin, estimatedCostMax, suggestedName.\n\nIMPORTANT: All numeric values MUST be plain integers with NO decimal points (e.g. 2000000 not 2000000.0).\n\nThesis: HVAC businesses in Southeast, recurring revenue, $2-5M revenue, founder-owned, no PE` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const j = await res.json();
  if (!res.ok || j.error) {
    console.error("API ERROR:", JSON.stringify(j.error || j).slice(0, 300));
    process.exit(1);
  }
  const rawContent = j.choices?.[0]?.message?.content;
  console.log("HTTP status:", res.status);
  console.log("finish_reason:", j.choices?.[0]?.finish_reason);
  console.log("content length:", rawContent?.length);
  console.log("content (first 500):", rawContent?.slice(0, 500));

  const stripped = rawContent.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const raw = JSON.parse(stripped);
  
  const toInt = (v) => v !== undefined && v !== null && v !== "" ? parseInt(String(v), 10) || 0 : undefined;
  const compiled = {
    ...raw,
    compiledFilters: {
      ...raw.compiledFilters,
      revenueMin: toInt(raw.compiledFilters?.revenueMin),
      revenueMax: toInt(raw.compiledFilters?.revenueMax),
    },
    scoringWeights: (raw.scoringWeights ?? []).map(w => ({ ...w, weight: parseInt(String(w.weight), 10) || 0 })),
    estimatedTargetsMin: toInt(raw.estimatedTargetsMin) ?? 0,
    estimatedTargetsMax: toInt(raw.estimatedTargetsMax) ?? 0,
    estimatedCostMin: toInt(raw.estimatedCostMin) ?? 0,
    estimatedCostMax: toInt(raw.estimatedCostMax) ?? 0,
  };

  console.log("\n✅ PARSE OK:");
  console.log("  suggestedName:", compiled.suggestedName);
  console.log("  revenueMin:", compiled.compiledFilters?.revenueMin, "(type:", typeof compiled.compiledFilters?.revenueMin, ")");
  console.log("  scoringWeights:", compiled.scoringWeights?.length, "items");
  console.log("  estimatedTargetsMin:", compiled.estimatedTargetsMin, "(type:", typeof compiled.estimatedTargetsMin, ")");
  console.log("\n✅ ALL STEPS PASSED");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
