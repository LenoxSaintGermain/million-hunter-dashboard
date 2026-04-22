import { describe, it, expect } from "vitest";

// These tests validate that required API keys are present in the environment.
// Live API call tests are skipped to avoid flakiness from rate limits or key suspension.
describe("API Key Validation", () => {
  it("GEMINI_API_KEY is set", () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY must be set").toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);
  });

  it("OPENAI_API_KEY is set", () => {
    const key = process.env.OPENAI_API_KEY;
    expect(key, "OPENAI_API_KEY must be set").toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);
  });

  it("SONAR_API_KEY is set", () => {
    const key = process.env.SONAR_API_KEY;
    expect(key, "SONAR_API_KEY must be set").toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);
  });

  it("ANTHROPIC_API_KEY is set", () => {
    const key = process.env.ANTHROPIC_API_KEY;
    expect(key, "ANTHROPIC_API_KEY must be set").toBeTruthy();
    expect(key!.length).toBeGreaterThan(10);
  });
});
