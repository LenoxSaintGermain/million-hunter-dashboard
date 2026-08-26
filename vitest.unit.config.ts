import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

/**
 * Pure/local lane. It intentionally excludes the files whose assertions
 * require a schema, seed data, or durable database writes. It does not skip
 * individual production assertions: those remain mandatory in test:integration.
 */
export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ["shared/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
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
  },
}));
