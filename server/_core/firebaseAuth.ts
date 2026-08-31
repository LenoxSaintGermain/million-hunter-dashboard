import type { Express, Request } from "express";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { requireVerifiedFirebaseIdentity } from "./firebaseAuthPolicy";
import { sdk } from "./sdk";

function requestOrigin(req: Request): string {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0]!.trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0]!.trim();
  return `${forwardedProto}://${forwardedHost}`;
}

function isTrustedOrigin(req: Request): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  const allowed = new Set([requestOrigin(req), ENV.publicAppOrigin].filter(Boolean));
  return allowed.has(origin);
}

function firebaseAdminAuth() {
  if (!ENV.firebaseProjectId) throw new Error("FIREBASE_PROJECT_ID is not configured");
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: ENV.firebaseProjectId });
  }
  return getAuth();
}

export function registerFirebaseAuthRoutes(app: Express) {
  app.post("/api/auth/firebase/session", async (req, res) => {
    if (!isTrustedOrigin(req)) {
      res.status(403).json({ error: "Sign-in request origin was not accepted" });
      return;
    }
    const idToken = req.body?.idToken;
    if (typeof idToken !== "string" || idToken.length < 100) {
      res.status(400).json({ error: "A Firebase ID token is required" });
      return;
    }

    try {
      const decoded = await firebaseAdminAuth().verifyIdToken(idToken, true);
      const identity = requireVerifiedFirebaseIdentity(decoded);
      const existing = await db.getCanonicalUserByEmail(identity.email);
      const openId = existing?.openId ?? identity.openId;
      const role = !existing && ENV.ownerEmail && identity.email === ENV.ownerEmail
        ? "admin" as const
        : undefined;

      await db.upsertUser({
        openId,
        email: identity.email,
        name: identity.name ?? undefined,
        loginMethod: "firebase-google",
        lastSignedIn: new Date(),
        ...(role ? { role } : {}),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: identity.name || identity.email,
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("[Firebase Auth] Session creation failed", error instanceof Error ? error.message : error);
      const message = error instanceof Error && error.message.includes("Multiple unlinked accounts")
        ? "This email is attached to multiple operator profiles. An administrator must link them before sign-in."
        : "Google sign-in could not be verified";
      res.status(message.startsWith("This email") ? 409 : 401).json({ error: message });
    }
  });
}
