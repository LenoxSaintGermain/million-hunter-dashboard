import { describe, expect, it } from "vitest";
import { coveredByInvariant, ROUTINE_CONSEQUENCES, OPERATING_INVARIANT } from "./operatingInvariant";

describe("only exactly-known routine copy defers to the global banner", () => {
  it("covers the checkpoint sentence repeated on every due review", () => {
    expect(coveredByInvariant("This is a human checkpoint, not proof that an automatic check or exit occurred.")).toBe(true);
  });

  it("covers the monitoring-finding sentences repeated on every stale play", () => {
    for (const sentence of ROUTINE_CONSEQUENCES) expect(coveredByInvariant(sentence)).toBe(true);
  });

  it("keeps a specific consequence that says more than the banner", () => {
    expect(coveredByInvariant("A paper ticket cannot be prepared until these checks are resolved.")).toBe(false);
    expect(coveredByInvariant("An empty result is not treated as an all-clear. Existing records remain unchanged.")).toBe(false);
  });

  it("never matches on a keyword, only on the whole sentence", () => {
    // Same keywords, different and more specific claim.
    expect(coveredByInvariant("Human review is required before an automatic exit can be configured for this account.")).toBe(false);
    expect(coveredByInvariant("no automatic exit")).toBe(false);
  });

  it("keeps an unknown or newly written consequence visible", () => {
    expect(coveredByInvariant("A brand new warning nobody has classified yet.")).toBe(false);
    expect(coveredByInvariant(null)).toBe(false);
    expect(coveredByInvariant("")).toBe(false);
  });

  it("states the invariant the banner must carry", () => {
    expect(OPERATING_INVARIANT).toMatch(/human authorization/i);
    expect(OPERATING_INVARIANT).toMatch(/automatically/i);
  });
});
