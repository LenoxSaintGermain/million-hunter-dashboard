import { requireIsolatedIntegrationDatabase } from "../../scripts/isolated-integration-identity.mjs";

// A beforeAll hook is too late: sprint8 connects during module collection.
// Validate synchronously before any test imports, and never accept the browser
// fixture database merely because it is on localhost.
requireIsolatedIntegrationDatabase(
  process.env.DATABASE_URL,
  process.env.ISOLATED_INTEGRATION_DATABASE,
);
