import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Schema/integration lane. These tests are never silently skipped: the setup
 * file fails before collection unless the exact disposable DB is supplied.
 * Run node scripts/with-isolated-integration.mjs --integration to provision,
 * verify, and remove that DB without using production or the browser fixture.
 */
const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  server: { host: "127.0.0.1" },
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: [
      "server/aperture/monitoringReviewReceipt.integration.test.ts",
      "server/aperture/capitalLedger.integration.test.ts",
      "server/aperture/objectiveMission.integration.test.ts",
      "server/aperture/objectiveMigration.integration.test.ts",
      "server/aperture/strategyDiscoveryWorkflow.integration.test.ts",
      "server/aperture/persistedJourneys.integration.test.ts",
      "server/aperture/activeCapitalThesisSchema.test.ts",
      "server/aperture/playOutcomeLedgerSchema.test.ts",
      "server/scan-pipeline.test.ts",
      "server/sprint11.test.ts",
      "server/sprint4.test.ts",
      "server/sprint5.test.ts",
      "server/sprint6.test.ts",
      "server/sprint8.test.ts",
      "server/stack.test.ts",
      "server/urlImport.test.ts",
    ],
    setupFiles: ["server/test/requireIsolatedDatabase.ts"],
  },
});
