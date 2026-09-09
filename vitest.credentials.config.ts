import { defineConfig } from "vitest/config";

/**
 * Explicit deployment-environment validation, not a unit test. All four original
 * presence assertions are retained. No provider calls are made and this config
 * does not load .env; supply the intended environment deliberately.
 */
export default defineConfig({
  root: import.meta.dirname,
  test: {
    environment: "node",
    include: ["server/api-keys.test.ts"],
  },
});
