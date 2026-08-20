import { describe, expect, it } from "vitest";
import { getDb } from "../db";

describe("active Capital thesis profile contract", () => {
  it("persists the selected canonical Capital thesis id on the user profile", async () => {
    const db = await getDb();
    const [rows] = await db!.execute("SHOW COLUMNS FROM users LIKE 'active_capital_thesis_id'") as any;
    expect(rows).toHaveLength(1);
  });
});
