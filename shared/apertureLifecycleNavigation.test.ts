import { describe, expect, it } from "vitest";
import { outcomeReviewHref, parseApertureLifecycle } from "./apertureLifecycleNavigation";

describe("Execute lifecycle navigation", () => {
  it("preserves exact candidate, order and hash while selecting outcome", () => {
    const href = outcomeReviewHref("/aperture/run/780001/execute?candidate=630001&order=12&lifecycle=orders#paper-lifecycle");
    expect(href).toBe("/aperture/run/780001/execute?candidate=630001&order=12&lifecycle=alpha#paper-lifecycle");
    expect(parseApertureLifecycle(new URL(href, "https://example.test").search)).toBe("alpha");
    expect(outcomeReviewHref(href)).toBe(href);
  });
  it("leaves gate and external destinations unchanged", () => {
    for (const href of ["/aperture/decision/1/revision/2", "https://example.test/aperture/run/1/execute", "/aperture/run/1"]) {
      expect(outcomeReviewHref(href)).toBe(href);
    }
  });
  it("resets an outcome selection on subsequent ordinary or invalid order navigation", () => {
    expect(["?lifecycle=alpha", "?lifecycle=monitoring", "?lifecycle=orders", "?candidate=2", "?lifecycle=submit"].map(parseApertureLifecycle))
      .toEqual(["alpha", "monitoring", "orders", "orders", "orders"]);
  });
});
