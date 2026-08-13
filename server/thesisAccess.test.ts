import { describe, expect, it } from "vitest";
import { canUseCanonicalThesis } from "./thesisAccess";

describe("canonical thesis sharing", () => {
  it("allows an owner to use their thesis", () => {
    expect(canUseCanonicalThesis({ ownerUserId: 1, requesterUserId: 1 })).toBe(true);
  });

  it("allows an explicitly shared use grant but never infers access", () => {
    expect(canUseCanonicalThesis({ ownerUserId: 1, requesterUserId: 2, sharedPermission: "use" })).toBe(true);
    expect(canUseCanonicalThesis({ ownerUserId: 1, requesterUserId: 2, sharedPermission: "view" })).toBe(false);
    expect(canUseCanonicalThesis({ ownerUserId: 1, requesterUserId: 2 })).toBe(false);
  });
});
