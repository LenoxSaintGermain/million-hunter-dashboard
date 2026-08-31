export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const AUTH_UNAVAILABLE_PATH = "/auth-unavailable";

export const isLoginConfigured = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  if (!oauthPortalUrl || !appId) return false;

  try {
    new URL(oauthPortalUrl);
    return true;
  } catch {
    return false;
  }
};

// Generate login URL at runtime so redirect URI reflects the current origin.
// Must never throw: it runs inside useAuth on public pages (landing, demo
// surfaces) — a missing/malformed OAuth env would otherwise crash-loop every
// route through the ErrorBoundary.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    if (!isLoginConfigured()) throw new Error("OAuth is not configured");
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch {
    console.warn("[auth] VITE_OAUTH_PORTAL_URL is missing or invalid — login unavailable");
    return AUTH_UNAVAILABLE_PATH;
  }
};
