import { describe, expect, it } from "vitest";
import { isJsonTrpcResponse, trpcNonJsonMessage } from "./trpcResponseGuard";

describe("tRPC response guard", () => {
  it("accepts JSON and fail-closes an HTML fallback", () => {
    expect(isJsonTrpcResponse("application/json; charset=utf-8")).toBe(true);
    expect(isJsonTrpcResponse("text/html; charset=utf-8")).toBe(false);
    expect(trpcNonJsonMessage("text/html")).toMatch(/expected JSON/i);
  });
});
