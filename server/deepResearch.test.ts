import { describe, expect, it } from "vitest";
import { dealDossierKey, dealDossierQuery, SONAR_TIMEOUT_MS, sonarRequestError } from "./deepResearch";

describe("Sonar request recovery", () => {
  it("turns an aborted upstream request into an actionable bounded-timeout error", () => {
    const error = sonarRequestError(Object.assign(new Error("aborted"), { name: "AbortError" }));
    expect(error.message).toContain(`after ${SONAR_TIMEOUT_MS / 1000} seconds`);
  });

  it("preserves non-timeout upstream errors", () => {
    expect(sonarRequestError(new Error("upstream unavailable")).message).toBe("upstream unavailable");
  });
});

it("binds dossier evidence to the exact listing rather than only a generic title", () => {
  const url = "https://example.com/illustrative-listing";
  const query = dealDossierQuery("Illustrative HVAC listing", "Unknown", "HVAC", url, "Broker claims");
  expect(query).toContain(url);
  expect(query).toContain("NOT necessarily a legal business name");
  expect(query).toContain("Broker claims");
  expect(dealDossierKey(1, url)).not.toBe(dealDossierKey(1, "https://example.com/different"));
  expect(dealDossierKey(1, url)).not.toBe("deal:1");
});
