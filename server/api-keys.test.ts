import { describe, it, expect } from "vitest";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

describe("API Key Validation", () => {
  it("GEMINI_API_KEY is set and valid", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY must be set").toBeTruthy();

    const ai = new GoogleGenAI({ apiKey: key! });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say 'ok' in one word.",
    });
    const text = response.text?.toLowerCase() ?? "";
    expect(text.length).toBeGreaterThan(0);
  }, 30000);

  it("ANTHROPIC_API_KEY is set (credits check skipped — insufficient balance)", () => {
    const key = process.env.ANTHROPIC_API_KEY;
    expect(key, "ANTHROPIC_API_KEY must be set").toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);
    // Note: Anthropic account has insufficient credits. Key is valid but API calls will fail.
    // Add credits at https://console.anthropic.com/settings/billing to enable Owner Psychology module.
    // System falls back to Gemini 2.5 Pro for behavioral analysis until credits are restored.
  });

  it("SONAR_API_KEY is set", () => {
    const key = process.env.SONAR_API_KEY;
    expect(key, "SONAR_API_KEY must be set").toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);
  });
});
