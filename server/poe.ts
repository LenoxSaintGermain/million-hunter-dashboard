/**
 * Poe API Client — OpenAI-compatible gateway to 100s of models
 *
 * Base URL: https://api.poe.com/v1
 * Auth: Poe_api_key (stored in env as Poe_api_key)
 *
 * Poe bot name reference (as of April 2026):
 *   Claude-Opus-4         → Anthropic Claude 4 Opus (most capable)
 *   Claude-Sonnet-4.6       → Anthropic Claude Sonnet 4.6 (speed+intelligence)
 *   Claude-Haiku-4.5        → Anthropic Claude Haiku 4.5 (fastest Claude)
 *   Gemini-3.1-Pro          → Google Gemini 3.1 Pro Preview (complex reasoning)
 *   Gemini-3-Flash          → Google Gemini 3 Flash Preview (frontier, cost-efficient)
 *   Gemini-3.1-Flash-Lite   → Google Gemini 3.1 Flash-Lite Preview (fastest/cheapest)
 *   GPT-5.5                 → OpenAI GPT-5.5 (released April 23, 2026)
 *   GPT-5.4                 → OpenAI GPT-5.4
 *
 * Usage: call poeChat() for simple completions, poeJSON() for structured output.
 */

import OpenAI from "openai";

// Poe API key is stored as Poe_api_key in environment
const POE_API_KEY = process.env.Poe_api_key;

// Singleton Poe client — reuse across requests
let _poeClient: OpenAI | null = null;

function getPoeClient(): OpenAI {
  if (!_poeClient) {
    if (!POE_API_KEY) {
      throw new Error(
        "Poe_api_key is not configured. Add it via webdev_request_secrets."
      );
    }
    _poeClient = new OpenAI({
      apiKey: POE_API_KEY,
      baseURL: "https://api.poe.com/v1",
    });
  }
  return _poeClient;
}

// ─── Model name constants ────────────────────────────────────────────────────

export const POE_MODELS = {
  // Anthropic via Poe
  CLAUDE_OPUS: "Claude-Opus-4",
  CLAUDE_SONNET: "Claude-Sonnet-4.6",
  CLAUDE_HAIKU: "Claude-Haiku-4.5",

  // Google via Poe
  GEMINI_PRO: "Gemini-3.1-Pro",
  GEMINI_FLASH: "Gemini-3-Flash",
  GEMINI_FLASH_LITE: "Gemini-3.1-Flash-Lite",

  // OpenAI via Poe
  GPT_FLAGSHIP: "GPT-5.5",
  GPT_FAST: "GPT-5.4",
} as const;

export type PoeModel = (typeof POE_MODELS)[keyof typeof POE_MODELS];

// ─── Core chat completion ────────────────────────────────────────────────────

export interface PoeChatParams {
  model: PoeModel | string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Simple text completion via Poe API.
 * Returns the assistant message content as a string.
 */
export async function poeChat(params: PoeChatParams): Promise<string> {
  const { model, systemPrompt, userPrompt, maxTokens = 4096, temperature = 0.3 } = params;
  const client = getPoeClient();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`[Poe] Empty response from model: ${model}`);
  }
  return content;
}

// ─── JSON structured output ──────────────────────────────────────────────────

/**
 * Structured JSON completion via Poe API.
 * Wraps poeChat with JSON extraction — parses the first JSON block in the response.
 */
export async function poeJSON<T = Record<string, unknown>>(
  params: PoeChatParams & { schema?: string }
): Promise<T> {
  const schemaHint = params.schema
    ? `\n\nRespond ONLY with valid JSON matching this schema:\n${params.schema}`
    : "\n\nRespond ONLY with valid JSON. No markdown, no explanation, no prose. Return the raw JSON value (object or array) only.";

  const raw = await poeChat({
    ...params,
    userPrompt: params.userPrompt + schemaHint,
    temperature: params.temperature ?? 0.1,
  });

  // Extract JSON from markdown code blocks if present.
  // Handles both objects {...} and arrays [...]
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr: string;
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  } else {
    // Find the outermost JSON structure — array takes priority over object
    const arrayMatch = raw.match(/(\[[\s\S]*\])/);
    const objectMatch = raw.match(/(\{[\s\S]*\})/);
    const firstArray = arrayMatch ? raw.indexOf(arrayMatch[0]) : Infinity;
    const firstObject = objectMatch ? raw.indexOf(objectMatch[0]) : Infinity;
    if (arrayMatch && firstArray <= firstObject) {
      jsonStr = arrayMatch[1].trim();
    } else if (objectMatch) {
      // If Claude wraps the array in an object like {"signals": [...]}, extract the array
      const parsed = JSON.parse(objectMatch[1]);
      const values = Object.values(parsed);
      const innerArray = values.find(v => Array.isArray(v));
      if (innerArray) {
        return innerArray as T;
      }
      jsonStr = objectMatch[1].trim();
    } else {
      jsonStr = raw.trim();
    }
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error(`[Poe] Failed to parse JSON from ${params.model}: ${jsonStr.slice(0, 200)}`);
  }
}

// ─── Health check ────────────────────────────────────────────────────────────

/**
 * Verify the Poe API key is valid and the client can reach the API.
 * Returns true on success, throws on failure.
 */
export async function poePing(): Promise<boolean> {
  const result = await poeChat({
    model: POE_MODELS.CLAUDE_HAIKU,
    userPrompt: "Reply with the single word: OK",
    maxTokens: 10,
  });
  return result.trim().toLowerCase().includes("ok");
}
