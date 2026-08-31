import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { isLoginConfigured } from "@/const";

function getFirebaseApp() {
  if (!isLoginConfigured()) {
    throw new Error("Firebase sign-in is not configured for this deployment");
  }
  if (getApps().length > 0) return getApp();
  return initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
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
