import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONSENSUS_MODELS,
  DEFAULT_MODULE_MODELS,
  GEMINI_FAST,
  POE_DEEPSEEK_V4_FLASH,
  POE_DEEPSEEK_V4_PRO,
  POE_KIMI_K3,
  getModelById,
  toValidRoutableModelId,
} from "../shared/models";

describe("provider-diverse model policy", () => {
  it("uses three independent consensus perspectives", () => {
    expect(DEFAULT_CONSENSUS_MODELS).toEqual([
      "gemini-3.1-pro-preview",
      POE_KIMI_K3,
      POE_DEEPSEEK_V4_PRO,
    ]);
    expect(new Set(DEFAULT_CONSENSUS_MODELS.map((id) => getModelById(id)?.provider))).toEqual(
      new Set(["google", "poe"]),
    );
  });

  it("keeps every assigned model in the validated catalog", () => {
    for (const id of [...Object.values(DEFAULT_MODULE_MODELS), ...DEFAULT_CONSENSUS_MODELS]) {
      expect(getModelById(id), id).toBeDefined();
    }
  });

  it("routes Kimi and DeepSeek while failing stale ids closed", () => {
    expect(toValidRoutableModelId(POE_KIMI_K3, GEMINI_FAST)).toBe(POE_KIMI_K3);
    expect(toValidRoutableModelId(POE_DEEPSEEK_V4_FLASH, GEMINI_FAST)).toBe(POE_DEEPSEEK_V4_FLASH);
    expect(toValidRoutableModelId("deepseek-latest", GEMINI_FAST)).toBe(GEMINI_FAST);
  });
});
