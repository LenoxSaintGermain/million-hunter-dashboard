import { describe, expect, it } from "vitest";
import { buildLocalSignInPath, sanitizeReturnPath } from "./authRouting";

describe("self-hosted authentication routing", () => {
  it("keeps ordinary sign-in on the application origin", () => {
    expect(buildLocalSignInPath("/aperture?release=demo")).toBe(
      "/sign-in?returnPath=%2Faperture%3Frelease%3Ddemo"
    );
    expect(buildLocalSignInPath("/aperture")).not.toContain("manus.im");
  });

  it("preserves an invite return path without sending it to an external provider", () => {
    expect(buildLocalSignInPath("/invite/invite-token-123")).toBe(
      "/sign-in?returnPath=%2Finvite%2Finvite-token-123"
    );
  });

  it("fails closed on external and protocol-relative return paths", () => {
    expect(sanitizeReturnPath("https://manus.im/app-auth")).toBe("/");
    expect(sanitizeReturnPath("//manus.im/app-auth")).toBe("/");
    expect(sanitizeReturnPath("javascript:alert(1)")).toBe("/");
  });
});
