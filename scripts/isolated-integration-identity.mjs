export const INTEGRATION_DATABASE = "capital_aperture_test_20260909_zzugqp";
export const INTEGRATION_USER = "cap_test_20260909_zzugqp";

/** Synchronous: must run before a test module can connect during collection. */
export function requireIsolatedIntegrationDatabase(rawUrl, expectedDatabase) {
  let url;
  try { url = new URL(rawUrl); } catch { /* Never echo a credential-bearing URL. */ }
  if (!url || url.protocol !== "mysql:" || url.hostname !== "127.0.0.1" ||
      url.port !== "3307" || url.pathname !== `/${INTEGRATION_DATABASE}` ||
      url.username !== INTEGRATION_USER || !url.password || url.search || url.hash ||
      expectedDatabase !== INTEGRATION_DATABASE) {
    throw new Error("Integration tests require the exact disposable loopback database and scoped test user. Run scripts/with-isolated-integration.mjs; browser UAT and production databases are forbidden.");
  }
  return url;
}
