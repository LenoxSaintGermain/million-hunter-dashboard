import { createHash } from "node:crypto";

type FirebaseClaims = {
  uid?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
};

export type VerifiedFirebaseIdentity = {
  uid: string;
  email: string;
  name: string | null;
  openId: string;
};

export function requireVerifiedFirebaseIdentity(
  claims: FirebaseClaims
): VerifiedFirebaseIdentity {
  if (typeof claims.uid !== "string" || claims.uid.length === 0) {
    throw new Error("Firebase identity is missing a uid");
  }
  if (claims.email_verified !== true) {
    throw new Error("A verified Google email is required");
  }
  if (typeof claims.email !== "string" || claims.email.trim().length === 0) {
    throw new Error("Firebase identity is missing an email");
  }

  const email = claims.email.trim().toLowerCase();
  const digest = createHash("sha256").update(claims.uid).digest("hex").slice(0, 55);
  return {
    uid: claims.uid,
    email,
    name: typeof claims.name === "string" && claims.name.trim().length > 0
      ? claims.name.trim()
      : null,
    openId: `firebase:${digest}`,
  };
}
