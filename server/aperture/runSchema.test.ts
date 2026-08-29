import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredRunColumns = [
  "holding_period",
  "catalyst_deadline_at",
  "liquidity_floor_adv_usd",
  "max_single_name_pct",
  "invalidation_rule",
  "mandate_version",
  "instrument_preference",
] as const;

describe("Capital Brief run persistence schema", () => {
  const databaseUrl = process.env.DATABASE_URL;
  let connection: mysql.Connection | null = null;

  beforeAll(async () => {
    if (databaseUrl) connection = await mysql.createConnection(databaseUrl);
  });

  afterAll(async () => {
    await connection?.end();
  });

  it("contains every short-horizon mandate column required by aperture.run.start", async () => {
    if (!connection) {
      const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
      expect(schema).toContain('instrumentPreference: mysqlEnum("instrument_preference", ["shares", "options", "either"])');
      return;
    }
    const [rows] = await connection!.query<Array<{ COLUMN_NAME: string }>>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'aperture_runs'
         AND COLUMN_NAME IN (${requiredRunColumns.map(() => "?").join(",")})`,
      [...requiredRunColumns],
    );
    expect(new Set(rows.map((row) => row.COLUMN_NAME))).toEqual(new Set(requiredRunColumns));
  });
});
