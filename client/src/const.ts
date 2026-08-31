import { buildLocalSignInPath } from "@shared/authRouting";
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const AUTH_UNAVAILABLE_PATH = "/auth-unavailable";

export const isLoginConfigured = () => {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID
  );
};

// Keep self-hosted authentication on this origin. The return path is relative
// and sanitized so public pages cannot create an external auth redirect.
export const getLoginUrl = (returnPath?: string) => {
  if (!isLoginConfigured()) {
    console.warn("[auth] Firebase sign-in is not configured — login unavailable");
    return AUTH_UNAVAILABLE_PATH;
  }
  const currentPath = typeof window === "undefined"
    ? "/"
    : `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return buildLocalSignInPath(returnPath ?? currentPath);
};
