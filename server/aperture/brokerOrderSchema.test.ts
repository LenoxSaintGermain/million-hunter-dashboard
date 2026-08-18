import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const requiredBrokerOrderColumns = [
  "reason",
  "invalidation_condition",
  "invalidation_price_cents",
  "holding_period",
  "catalyst_deadline_at",
  "market_session",
  "session_basis",
  "paper_ack_at",
  "gated_notional_cents",
  "mandate_version",
  "gate_snapshot",
  "entry_price_cents",
  "stop_price_cents",
  "slippage_cents",
  "planned_risk_cents",
  "time_stop_at",
  "no_trade_conditions",
] as const;

describe("Capital Aperture broker-order persistence schema", () => {
  const databaseUrl = process.env.DATABASE_URL;
  let connection: mysql.Connection | null = null;

  beforeAll(async () => {
    if (databaseUrl) connection = await mysql.createConnection(databaseUrl);
  });

  afterAll(async () => {
    await connection?.end();
  });

  it("contains every risk-gate field read by order queues, readiness, and run detail", async () => {
    if (!connection) return;
    const [rows] = await connection!.query<Array<{ COLUMN_NAME: string }>>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'broker_orders'
         AND COLUMN_NAME IN (${requiredBrokerOrderColumns.map(() => "?").join(",")})`,
      [...requiredBrokerOrderColumns],
    );
    expect(new Set(rows.map((row) => row.COLUMN_NAME))).toEqual(new Set(requiredBrokerOrderColumns));
  });
});
