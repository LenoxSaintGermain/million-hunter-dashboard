import { describe, expect, it } from "vitest";
import { z } from "zod";

const thesisActivateInputSchema = z.object({
  id: z.coerce.number().optional(),
  compilationId: z.coerce.number().optional(),
}).refine((data) => data.id != null || data.compilationId != null, {
  message: "Either id or compilationId must be provided",
});

describe("thesisActivateInputSchema", () => {
  it("accepts a direct numeric id", () => {
    const result = thesisActivateInputSchema.safeParse({ id: 42 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(42);
    }
  });

  it("accepts a numeric compilationId", () => {
    const result = thesisActivateInputSchema.safeParse({ compilationId: 789 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.compilationId).toBe(789);
    }
  });

  it("accepts both id and compilationId simultaneously", () => {
    const result = thesisActivateInputSchema.safeParse({ id: 42, compilationId: 789 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(42);
      expect(result.data.compilationId).toBe(789);
    }
  });

  it("coerces string representations of numbers gracefully", () => {
    const result = thesisActivateInputSchema.safeParse({ id: "101", compilationId: "202" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(101);
      expect(result.data.compilationId).toBe(202);
    }
  });

  it("fails validation when neither id nor compilationId is provided", () => {
    const result = thesisActivateInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("fails validation when invalid values are provided", () => {
    const result = thesisActivateInputSchema.safeParse({ id: "not-a-number" });
    expect(result.success).toBe(false);
  });
});
