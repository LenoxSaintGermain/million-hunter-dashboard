import { describe, expect, it } from "vitest";
import { isExpectedIsolatedReceiptDenial } from "./expectedUatDenial";

describe("expected isolated receipt denial classification", () => {
  it("suppresses only the exact intentional immutable-binding denial", () => {
    expect(isExpectedIsolatedReceiptDenial(new Error("Decision binding unavailable"))).toBe(true);
    expect(isExpectedIsolatedReceiptDenial(new Error("PRECONDITION_FAILED"))).toBe(false);
    expect(isExpectedIsolatedReceiptDenial(new Error("Decision binding unavailable: detail"))).toBe(false);
  });
});
