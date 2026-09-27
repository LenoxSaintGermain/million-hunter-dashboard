import { and, eq, inArray } from "drizzle-orm";
import { deals } from "../drizzle/schema";
import type { getDb } from "./db";

/** Apply only to the screening lane, checked atomically at write time.
 * A read-then-check would race with an operator starting diligence or passing.
 */
export async function updateAcquisitionScreeningStage(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>, id: number,
  stage: "new" | "qualified" | "high_priority",
) {
  await db.update(deals).set({ stage, updatedAt: new Date() }).where(and(
    eq(deals.id, id), eq(deals.isArchived, false),
    inArray(deals.stage, ["new", "scanning", "qualified", "high_priority"]),
  ));
}
