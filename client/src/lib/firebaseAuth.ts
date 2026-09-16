import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { isLoginConfigured } from "@/const";

function resolveAuthDomain(): string {
  if (typeof window !== "undefined") {
    const host = window.location.host;
    // When served via Firebase Hosting, Cloud Run, or localhost, use same-origin authDomain
    // to prevent iOS Safari ITP / WebKit storage partitioning from breaking mobile auth.
    if (
      host.includes("third-signal-capital-aperture") ||
      host.includes("web.app") ||
      host.includes("firebaseapp.com") ||
      host.includes("run.app") ||
      host.includes("localhost")
    ) {
      return host;
    }
  }
  return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "third-signal-capital-aperture.web.app";
}

function getFirebaseApp() {
  if (!isLoginConfigured()) {
    throw new Error("Firebase sign-in is not configured for this deployment");
  }
  if (getApps().length > 0) return getApp();
  return initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: resolveAuthDomain(),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
}

export async function signInWithGoogle(): Promise<string> {
  const auth = getAuth(getFirebaseApp());
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return credential.user.getIdToken(true);
}

export async function signOutFirebaseIdentity(): Promise<void> {
  if (!isLoginConfigured()) return;
  await signOut(getAuth(getFirebaseApp()));
}
