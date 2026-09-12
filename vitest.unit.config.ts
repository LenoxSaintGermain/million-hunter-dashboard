import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

/**
 * Pure/local lane. It intentionally excludes the files whose assertions
 * require a schema, seed data, or durable database writes. It does not skip
 * individual production assertions: database checks remain in test:integration;
 * deployment credential presence remains in test:credentials, unchanged.
 */
export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ["shared/**/*.test.ts", "server/aperture/objectiveMissionWorkspace.test.tsx", "server/aperture/objectiveMissionFlow.test.tsx", "server/aperture/objectiveDiscoveryResult.test.tsx", "server/aperture/objectiveMissionEntry.test.tsx", "server/aperture/discoveryLeadAction.test.tsx", "server/aperture/sourceExecutionEvidence.test.tsx", "server/aperture/gainsSourcePicker.test.tsx", "server/aperture/apertureShellChrome.test.tsx", "server/aperture/playAndReturn.test.tsx", "server/aperture/playInspectionDrawer.test.tsx", "server/aperture/researchJourneyList.test.tsx", "server/aperture/candidateComparison.test.tsx"],
    exclude: [
      "**/node_modules/**",
      "server/api-keys.test.ts",
      "server/aperture/activeCapitalThesisSchema.test.ts",
      "server/aperture/playOutcomeLedgerSchema.test.ts",
      "server/aperture/monitoringReviewReceipt.integration.test.ts",
      "server/aperture/capitalLedger.integration.test.ts",
      "server/aperture/objectiveMission.integration.test.ts",
      "server/aperture/objectiveMigration.integration.test.ts",
      "server/aperture/strategyDiscoveryWorkflow.integration.test.ts",
      "server/aperture/discoverySelection.integration.test.ts",
      "server/aperture/executionEvidence.integration.test.ts",
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
