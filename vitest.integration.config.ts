import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Schema/integration lane. These tests are never silently skipped: the setup
 * file fails immediately and explicitly when an isolated database is absent.
 */
const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    include: [
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
