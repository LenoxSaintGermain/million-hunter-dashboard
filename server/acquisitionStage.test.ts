import { MySqlDialect } from "drizzle-orm/mysql-core";
import { expect, it, vi } from "vitest";
import { updateAcquisitionScreeningStage } from "./acquisitionStage";
it("guards rescans against archived and operator-managed stages at the SQL write boundary", async () => {
  const where = vi.fn(); const set = vi.fn(() => ({ where }));
  await updateAcquisitionScreeningStage({ update: () => ({ set }) } as any, 42, "qualified");
  const query = new MySqlDialect().sqlToQuery(where.mock.calls[0][0]);
  expect(query.sql).toContain('`deals`.`id` = ?');
  expect(query.sql).toContain('`deals`.`isArchived` = ?');
  expect(query.sql).toContain('`deals`.`stage` in (?, ?, ?, ?)');
  expect(query.params).toEqual([42, false, "new", "scanning", "qualified", "high_priority"]);
  for (const protectedStage of ["in_diligence", "loi_sent", "under_contract", "closed", "passed"])
    expect(query.params).not.toContain(protectedStage);
});
