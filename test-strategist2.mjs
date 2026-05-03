import { config } from "dotenv";
config();

const ENV_FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const ENV_FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const url = `${ENV_FORGE_URL.replace(/\/$/, "")}/v1/chat/completions`;

// Test WITH thinking (current behavior)
const payloadWithThinking = {
  model: "gemini-2.5-flash",
  messages: [
    { role: "system", content: "Return ONLY valid JSON." },
    { role: "user", content: "Compile: HVAC Southeast $2-5M" },
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "test",
      strict: true,
      schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  max_tokens: 512,
  thinking: { budget_tokens: 128 },
};

// Test WITHOUT thinking
const payloadNoThinking = { ...payloadWithThinking };
delete payloadNoThinking.thinking;

async function test(label, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ENV_FORGE_KEY}` },
    body: JSON.stringify(payload),
  });
  const j = await res.json();
  const choice = j.choices?.[0];
  const msg = choice?.message;
  console.log(`\n=== ${label} ===`);
  console.log("finish_reason:", choice?.finish_reason);
  console.log("content type:", typeof msg?.content);
  console.log("content value:", JSON.stringify(msg?.content)?.slice(0, 200));
  if (msg?.content === null) {
    console.log("⚠️  content is NULL — likely a thinking block issue");
    console.log("Full message keys:", Object.keys(msg ?? {}));
  }
}

await test("WITH thinking", payloadWithThinking);
await test("WITHOUT thinking", payloadNoThinking);
