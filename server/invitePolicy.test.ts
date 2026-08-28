import { describe, expect, it } from "vitest";
import { capitalOperatorInviteProfile, matchesInviteRecipient } from "./invitePolicy";

describe("invite policy", () => {
  it("binds an email-specific invite to the intended signed-in identity", () => {
    expect(matchesInviteRecipient(" Operator@Example.com ", "operator@example.com")).toBe(true);
    expect(matchesInviteRecipient("operator@example.com", "other@example.com")).toBe(false);
    expect(matchesInviteRecipient(null, "anyone@example.com")).toBe(true);
  });

  it("gives Capital Operators the bounded workspace and inviter-approved display name", () => {
    expect(capitalOperatorInviteProfile("capital_operator", "CH Capital")).toEqual({
      defaultWorkspace: "capital_aperture_trader",
      onboardingCompleted: true,
      name: "CH Capital",
    });
    expect(capitalOperatorInviteProfile("investor", "CH Capital")).toEqual({});
  });
});
