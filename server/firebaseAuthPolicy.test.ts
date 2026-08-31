import { describe, expect, it } from "vitest";
import { requireVerifiedFirebaseIdentity } from "./_core/firebaseAuthPolicy";

describe("Firebase session identity policy", () => {
  it("normalizes a verified Google identity into a stable bounded openId", () => {
    const identity = requireVerifiedFirebaseIdentity({
      uid: "google-uid-123",
      email: " Lenox@Example.com ",
      email_verified: true,
      name: "Lenox",
    });

    expect(identity.email).toBe("lenox@example.com");
    expect(identity.name).toBe("Lenox");
    expect(identity.openId).toMatch(/^firebase:[a-f0-9]{55}$/);
    expect(identity.openId.length).toBeLessThanOrEqual(64);
  });

  it("fails closed when the email is not verified", () => {
    expect(() => requireVerifiedFirebaseIdentity({
      uid: "google-uid-123",
      email: "lenox@example.com",
      email_verified: false,
    })).toThrow("verified Google email");
  });
});
