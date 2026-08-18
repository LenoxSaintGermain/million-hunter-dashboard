import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";

const requiredColumns = [
  "user_id",
  "run_id",
  "candidate_id",
  "decision",
  "reason",
  "created_at",
  "updated_at",
] as const;

describe("Capital Aperture trader-decision persistence schema", () => {
  const databaseUrl = process.env.DATABASE_URL;
  let connection: mysql.Connection | null = null;

  beforeAll(async () => {
    if (databaseUrl) connection = await mysql.createConnection(databaseUrl);
  });

  afterAll(async () => {
    await connection?.end();
  });

  it("retains one explicit skip or defer decision per user, run, and candidate", async () => {
    if (!connection) return;
    const [columns] = await connection.query<Array<{ COLUMN_NAME: string }>>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'aperture_play_decisions'
       AND COLUMN_NAME IN (${requiredColumns.map(() => "?").join(",")})`,
      [...requiredColumns],
    );
    expect(new Set(columns.map((column) => column.COLUMN_NAME))).toEqual(new Set(requiredColumns));

    const [indexes] = await connection.query<Array<{ INDEX_NAME: string; COLUMN_NAME: string }>>(
      `SELECT INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'aperture_play_decisions'
       AND INDEX_NAME = 'aperture_play_decision_scope' ORDER BY SEQ_IN_INDEX`,
    );
    expect(indexes.map((index) => index.COLUMN_NAME)).toEqual(["user_id", "run_id", "candidate_id"]);
  });
});
