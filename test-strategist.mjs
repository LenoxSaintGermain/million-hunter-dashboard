import { config } from "dotenv";
config();

const ENV_FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const ENV_FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const url = ENV_FORGE_URL
  ? `${ENV_FORGE_URL.replace(/\/$/, "")}/v1/chat/completions`
  : "https://forge.manus.im/v1/chat/completions";

console.log("URL:", url);
console.log("Key present:", !!ENV_FORGE_KEY);

const payload = {
  model: "gemini-2.5-flash",
  messages: [
    { role: "system", content: "You are STRATEGIST. Return ONLY valid JSON." },
    { role: "user", content: "Compile this thesis: HVAC businesses in the Southeast, recurring revenue, $2-5M revenue" },
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "thesis_compilation",
      strict: true,
      schema: {
        type: "object",
        properties: {
          suggestedName: { type: "string" },
          compiledFilters: {
            type: "object",
            properties: { revenueMin: { type: "number" } },
            required: [],
            additionalProperties: false,
          },
          scoringWeights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dimension: { type: "string" },
                weight: { type: "number" },
                isCustom: { type: "boolean" },
              },
              required: ["dimension", "weight", "isCustom"],
              additionalProperties: false,
            },
          },
          evidenceRequirements: { type: "array", items: { type: "string" } },
          autoDisqualifiers: { type: "array", items: { type: "string" } },
          confidenceNotes: { type: "array", items: { type: "string" } },
          estimatedTargetsMin: { type: "number" },
          estimatedTargetsMax: { type: "number" },
          estimatedCostMin: { type: "number" },
          estimatedCostMax: { type: "number" },
        },
        required: [
          "suggestedName", "compiledFilters", "scoringWeights",
          "evidenceRequirements", "autoDisqualifiers", "confidenceNotes",
          "estimatedTargetsMin", "estimatedTargetsMax",
          "estimatedCostMin", "estimatedCostMax",
        ],
        additionalProperties: false,
      },
    },
  },
  max_tokens: 4096,
  thinking: { budget_tokens: 128 },
};

try {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV_FORGE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log("HTTP status:", res.status);
  try {
    const j = JSON.parse(text);
    if (j.error) {
      console.log("API ERROR:", JSON.stringify(j.error, null, 2));
    } else {
      console.log("Model:", j.model);
      console.log("Content (first 300):", j.choices?.[0]?.message?.content?.slice(0, 300));
    }
  } catch {
    console.log("RAW (first 600):", text.slice(0, 600));
  }
} catch (e) {
  console.error("FETCH ERROR:", e.message);
}
