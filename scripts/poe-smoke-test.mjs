/**
 * Poe API Smoke Test
 * Tests Claude-Opus-4.7, Claude-Haiku-4.5 (ping), and GPT-5.5 via Poe API
 * Run: node scripts/poe-smoke-test.mjs
 */
import OpenAI from "openai";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const POE_API_KEY = process.env.Poe_api_key;

if (!POE_API_KEY) {
  console.error("❌ Poe_api_key not found in environment. Check .env or secrets.");
  process.exit(1);
}

const poe = new OpenAI({
  apiKey: POE_API_KEY,
  baseURL: "https://api.poe.com/v1",
});

const DEAL_CONTEXT = `
Business: Metro Commercial Cleaning — Atlanta, GA
Revenue: $1,850,000 | SDE: $720,000 | Asking: $2,100,000
Multiple: 2.9x SDE | DSCR (est): 1.42 | OZ eligible: Yes
Industry: Commercial Cleaning (NAICS 561720)
Years in business: 14 | Employees: 22 | Owner: retiring, 68 years old
`;

async function runTest(label, model, prompt, maxTokens = 200) {
  const start = Date.now();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`🧪 TEST: ${label}`);
  console.log(`   Model: ${model}`);
  console.log(`   Sending request...`);

  try {
    const response = await poe.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are a senior M&A analyst specializing in small business acquisitions. Be concise and direct.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    });

    const elapsed = Date.now() - start;
    const content = response.choices[0]?.message?.content || "";
    const usage = response.usage;

    console.log(`   ✅ SUCCESS (${elapsed}ms)`);
    console.log(`   Tokens: ${usage?.prompt_tokens ?? "?"} in / ${usage?.completion_tokens ?? "?"} out`);
    console.log(`   Model returned: ${response.model}`);
    console.log(`\n   Response preview:`);
    console.log(`   ${content.slice(0, 300).replace(/\n/g, "\n   ")}`);

    return { success: true, model, elapsed, content, usage };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`   ❌ FAILED (${elapsed}ms)`);
    console.log(`   Error: ${err.message}`);
    if (err.status) console.log(`   HTTP Status: ${err.status}`);
    if (err.error) console.log(`   API Error: ${JSON.stringify(err.error)}`);
    return { success: false, model, elapsed, error: err.message };
  }
}

async function runStructuredTest(label, model) {
  const start = Date.now();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`🧪 TEST: ${label} (JSON structured output)`);
  console.log(`   Model: ${model}`);
  console.log(`   Sending request...`);

  const prompt = `Analyze this business acquisition opportunity and return a JSON object with these exact fields:
- ownerMotivation: string (1-2 sentences on why the owner is selling)
- distressLevel: "low" | "medium" | "high"
- negotiationLeverage: string (1-2 sentences on buyer leverage points)
- recommendedApproach: string (1-2 sentences on outreach strategy)
- confidenceScore: number between 0 and 1

Deal context:
${DEAL_CONTEXT}

Respond ONLY with valid JSON. No markdown, no explanation.`;

  try {
    const response = await poe.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are an expert in seller psychology and M&A deal structuring. Output only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
      temperature: 0.1,
    });

    const elapsed = Date.now() - start;
    const raw = response.choices[0]?.message?.content || "";

    // Extract JSON
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
      console.log(`   ✅ SUCCESS — JSON parsed cleanly (${elapsed}ms)`);
      console.log(`   Tokens: ${response.usage?.prompt_tokens ?? "?"} in / ${response.usage?.completion_tokens ?? "?"} out`);
      console.log(`\n   Parsed result:`);
      console.log(`   ownerMotivation: ${parsed.ownerMotivation}`);
      console.log(`   distressLevel: ${parsed.distressLevel}`);
      console.log(`   negotiationLeverage: ${parsed.negotiationLeverage}`);
      console.log(`   recommendedApproach: ${parsed.recommendedApproach}`);
      console.log(`   confidenceScore: ${parsed.confidenceScore}`);
      return { success: true, model, elapsed, parsed };
    } catch {
      console.log(`   ⚠️  PARTIAL — Response received but JSON parse failed (${elapsed}ms)`);
      console.log(`   Raw: ${raw.slice(0, 200)}`);
      return { success: false, model, elapsed, error: "JSON parse failed", raw };
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`   ❌ FAILED (${elapsed}ms): ${err.message}`);
    return { success: false, model, elapsed, error: err.message };
  }
}

// ─── Run all tests ────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║         POE API SMOKE TEST — Signal Hunter               ║");
console.log("║         Testing Claude-Opus-4.7, Haiku-4.5, GPT-5.5     ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log(`\nPoe API Key: ${POE_API_KEY.slice(0, 8)}...${POE_API_KEY.slice(-4)}`);
console.log(`Timestamp: ${new Date().toISOString()}`);

const results = [];

// Test 1: Ping with Claude-Haiku-4.5 (fastest, cheapest — confirms API key works)
results.push(await runTest(
  "Ping / API Key Validation",
  "Claude-Haiku-4.5",
  "Reply with exactly one word: OK",
  10
));

// Test 2: Claude-Opus-4.7 — Owner Psychology (the primary use case)
results.push(await runStructuredTest(
  "Owner Psychology — Claude-Opus-4.7",
  "Claude-Opus-4.7"
));

// Test 3: Claude-Opus-4.7 — Free-form deal analysis
results.push(await runTest(
  "Deal Analysis — Claude-Opus-4.7",
  "Claude-Opus-4.7",
  `You are analyzing a potential acquisition. Give me the top 3 red flags and top 3 green flags for this deal:\n${DEAL_CONTEXT}`,
  300
));

// Test 4: GPT-5.5 — Confirm it's accessible via Poe
results.push(await runTest(
  "GPT-5.5 Availability Check",
  "GPT-5.5",
  `Briefly assess this acquisition opportunity in 2-3 sentences:\n${DEAL_CONTEXT}`,
  150
));

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log("SMOKE TEST SUMMARY");
console.log("═".repeat(60));

let passed = 0;
let failed = 0;
for (const r of results) {
  const status = r.success ? "✅ PASS" : "❌ FAIL";
  const timing = `${r.elapsed}ms`;
  console.log(`  ${status}  ${r.model.padEnd(25)} ${timing}`);
  if (r.success) passed++;
  else { failed++; if (r.error) console.log(`         └─ ${r.error}`); }
}

console.log(`\n  Total: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));

process.exit(failed > 0 ? 1 : 0);
