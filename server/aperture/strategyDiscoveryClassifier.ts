import { GoogleGenAI } from "@google/genai";
import { GEMINI_BALANCED } from "../../shared/models";
import type { InvokeParams, InvokeResult } from "../_core/llm";

// Gemini rejects this deeply nested schema with its repeated size/range bounds
// (live 400 INVALID_ARGUMENT). Keep structure, required fields, enums, nullability
// and additionalProperties on the wire. ALL bounds remain in the prompt and in
// strategyDiscoveryPayloadSchema's authoritative, fail-closed local validation.
function transportSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(transportSchema);
  if (!value || typeof value !== "object") return value;
  const localBounds = new Set(["$schema", "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !localBounds.has(key)).map(([key, child]) => [key,
    key === "properties" && child && typeof child === "object"
      ? Object.fromEntries(Object.entries(child).map(([name, schema]) => [name, transportSchema(schema)]))
      : transportSchema(child),
  ]));
}

/** Use the configured direct Gemini provider, not the legacy Manus/Forge gateway.
 * Transport formatting only: the caller still strictly parses and validates every
 * decision-critical field and removes unsupported verification claims.
 */
export async function classifyStrategyDiscovery(request: InvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Discovery classifier is not configured");
  const [system, user] = request.messages;
  if (request.messages.length !== 2 || system.role !== "system" || user.role !== "user"
    || typeof system.content !== "string" || typeof user.content !== "string" || !request.outputSchema?.schema) {
    throw new Error("Invalid discovery classifier request");
  }
  const response = await new GoogleGenAI({ apiKey }).models.generateContent({
    model: GEMINI_BALANCED,
    contents: [{ role: "user", parts: [{ text: user.content }] }],
    config: {
      systemInstruction: `${system.content}\nFULL_VALIDATION_SCHEMA_JSON:\n${JSON.stringify(request.outputSchema.schema)}`,
      responseMimeType: "application/json",
      responseJsonSchema: transportSchema(request.outputSchema.schema),
      temperature: 0,
      maxOutputTokens: 16_384,
      abortSignal: AbortSignal.timeout(30_000),
    },
  });
  // Never turn truncation, a safety refusal, or an absent candidate into success.
  const parts = response.candidates?.[0]?.content?.parts;
  const textOnly = !!parts?.length && parts.every(part => typeof part.text === "string"
    && Object.keys(part).every(key => ["text", "thought", "thoughtSignature"].includes(key)));
  const complete = response.candidates?.length === 1 && response.candidates[0].finishReason === "STOP" && textOnly;
  return {
    id: response.responseId ?? "discovery-classification",
    created: Date.now(), model: GEMINI_BALANCED,
    choices: [{ index: 0, message: { role: "assistant", content: response.text ?? "" },
      finish_reason: complete ? "stop" : "length" }],
  };
}
