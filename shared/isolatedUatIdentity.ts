export type IsolatedUatIdentity = "jim" | "lenox" | "ch_capital";
export type IsolatedUatCase = "qualified-play";

const STORAGE_KEY = "capital_aperture_isolated_uat_identity";
const CASE_STORAGE_KEY = "capital_aperture_isolated_uat_case";

function isIdentity(value: string | null): value is IsolatedUatIdentity {
  return value === "jim" || value === "lenox" || value === "ch_capital";
}

function isCase(value: string | null): value is IsolatedUatCase {
  return value === "qualified-play";
}

function isFixtureWorkspacePath(path: string) {
  return path.startsWith("/aperture") || path.startsWith("/thesis");
}

export function aperturePathForFixture(path: string, identity: IsolatedUatIdentity | null) {
  if (!identity || !isFixtureWorkspacePath(path)) return path;
  const [pathname, currentSearch = ""] = path.split("?");
  const search = new URLSearchParams(currentSearch);
  search.set("uat_identity", identity);
  const fixtureCase = readIsolatedUatCase();
  if (fixtureCase) search.set("uat_case", fixtureCase);
  return `${pathname}?${search.toString()}`;
}

/**
 * This only carries a fixture label in a browser session. The server still
 * refuses the corresponding request unless it is the exact loopback UAT DB in
 * development mode, so this helper cannot select an operator in production.
 */
export function readIsolatedUatIdentity(search = typeof window === "undefined" ? "" : window.location.search): IsolatedUatIdentity | null {
  const fromQuery = new URLSearchParams(search).get("uat_identity");
  if (isIdentity(fromQuery)) {
    try { window.sessionStorage.setItem(STORAGE_KEY, fromQuery); } catch { /* browser storage is optional */ }
    return fromQuery;
  }

  try {
    const fromSession = window.sessionStorage.getItem(STORAGE_KEY);
    return isIdentity(fromSession) ? fromSession : null;
  } catch {
    return null;
  }
}

/** Carries only the development fixture case; the server independently verifies the local runtime gate. */
export function readIsolatedUatCase(search = typeof window === "undefined" ? "" : window.location.search): IsolatedUatCase | null {
  const fromQuery = new URLSearchParams(search).get("uat_case");
  if (isCase(fromQuery)) {
    try { window.sessionStorage.setItem(CASE_STORAGE_KEY, fromQuery); } catch { /* browser storage is optional */ }
    return fromQuery;
  }
  try {
    const fromSession = window.sessionStorage.getItem(CASE_STORAGE_KEY);
    return isCase(fromSession) ? fromSession : null;
  } catch {
    return null;
  }
}

export function installIsolatedUatNavigationBridge() {
  if (typeof window === "undefined") return () => undefined;
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;
  const normalize = (url: string | URL | null | undefined) => {
    if (url == null) return url;
    const raw = typeof url === "string" ? url : url.toString();
    return aperturePathForFixture(raw, readIsolatedUatIdentity());
  };

  window.history.pushState = function (data, unused, url) {
    return originalPushState.call(window.history, data, unused, normalize(url));
  };
  window.history.replaceState = function (data, unused, url) {
    return originalReplaceState.call(window.history, data, unused, normalize(url));
  };

  return () => {
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
  };
}
