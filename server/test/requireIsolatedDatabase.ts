import { beforeAll } from "vitest";

beforeAll(() => {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "Integration test lane requires an explicitly supplied isolated DATABASE_URL. " +
      "Do not source repository .env or use production TiDB.",
    );
  }
});
