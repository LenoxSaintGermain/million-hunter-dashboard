import { describe, it, expect } from "vitest";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

describe("API Key Validation", () => {
  it("GEMINI_API_KEY is set and valid (gemini-2.5-flash)", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY must be set").toBeTruthy();

    const ai = new GoogleGenAI({ apiKey: key! });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Say 'ok' in one word.",
    });
    const text = response.text?.toLowerCase() ?? "";
    expect(text.length).toBeGreaterThan(0);
  }, 30000);

  it("OPENAI_API_KEY is set and valid (gpt-5.4)", async () => {
    const key = process.env.OPENAI_API_KEY;
    expect(key, "OPENAI_API_KEY must be set").toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);

    const client = new OpenAI({ apiKey: key! });
    const response = await client.chat.completions.create({
      model: "gpt-5.4",
      messages: [{ role: "user", content: "Say 'ok' in one word." }],
      max_completion_tokens: 5,
    });
    const text = response.choices[0]?.message?.content?.toLowerCase() ?? "";
    expect(text.length).toBeGreaterThan(0);
  }, 30000);

  it("SONAR_API_KEY is set", () => {
    const key = process.env.SONAR_API_KEY;
    expect(key, "SONAR_API_KEY must be set").toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);
  });
});
