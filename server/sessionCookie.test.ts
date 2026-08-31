import { describe, expect, it } from "vitest";
import { COOKIE_NAME, HOSTED_SESSION_COOKIE_NAME } from "../shared/const";
import { readSessionCookie } from "./_core/sessionCookie";

describe("readSessionCookie", () => {
  it("prefers the Firebase Hosting forwarded session cookie", () => {
    expect(readSessionCookie(
      `${COOKIE_NAME}=legacy-token; ${HOSTED_SESSION_COOKIE_NAME}=hosted-token`,
    )).toBe("hosted-token");
  });

  it("accepts the legacy session cookie for direct service requests", () => {
    expect(readSessionCookie(`${COOKIE_NAME}=legacy-token`)).toBe("legacy-token");
  });

  it("returns undefined when no session cookie exists", () => {
    expect(readSessionCookie("unrelated=value")).toBeUndefined();
    expect(readSessionCookie(undefined)).toBeUndefined();
  });
});
