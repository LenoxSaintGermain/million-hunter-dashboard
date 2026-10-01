import { expect, it } from "vitest";
import { createDeal } from "./db";
import { deals } from "../drizzle/schema";
import { getTableConfig } from "drizzle-orm/mysql-core";
it("rejects ownerless legacy ingestion before accessing the database", async () => {
  for (const ownerUserId of [undefined, null, 0, -1, 1.5]) {
    await expect(createDeal({ name: "Illustrative test", ownerUserId } as any)).rejects.toThrow("explicit deal owner");
  }
});
it("declares duplicate identity within an owner, not across accounts", () => {
  const index = getTableConfig(deals).indexes.find(i => i.config.name === "uq_deals_owner_name_source");
  expect(index?.config.unique).toBe(true);
  expect(index?.config.columns.map(c => "name" in c ? c.name : undefined)).toEqual(["owner_user_id", "name", "source"]);
});
