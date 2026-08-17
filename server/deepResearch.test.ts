import { describe, expect, it } from "vitest";
import { SONAR_TIMEOUT_MS, sonarRequestError } from "./deepResearch";

describe("Sonar request recovery", () => {
  it("turns an aborted upstream request into an actionable bounded-timeout error", () => {
    const error = sonarRequestError(Object.assign(new Error("aborted"), { name: "AbortError" }));
    expect(error.message).toContain(`after ${SONAR_TIMEOUT_MS / 1000} seconds`);
  });

  it("preserves non-timeout upstream errors", () => {
    expect(sonarRequestError(new Error("upstream unavailable")).message).toBe("upstream unavailable");
  });
});
