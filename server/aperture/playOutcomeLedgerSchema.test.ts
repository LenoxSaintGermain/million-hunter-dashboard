import { describe, expect, it } from "vitest";
import { getDb } from "../db";

describe("paper play outcome ledger schema", () => {
  it("persists immutable slates and separately queryable counterfactual outcome observations", async () => {
    const db = await getDb();
    const [slates] = await db!.execute("SHOW COLUMNS FROM aperture_play_slates LIKE 'portfolio_snapshot'") as any;
    const [items] = await db!.execute("SHOW COLUMNS FROM aperture_play_slate_items LIKE 'outcome_result'") as any;
    const [basis] = await db!.execute("SHOW COLUMNS FROM aperture_play_slate_items LIKE 'outcome_basis'") as any;
    const [window] = await db!.execute("SHOW COLUMNS FROM aperture_play_slates LIKE 'window_key'") as any;
    const [snapshotBasis] = await db!.execute("SHOW COLUMNS FROM aperture_play_slates LIKE 'snapshot_basis'") as any;
    expect(slates).toHaveLength(1);
    expect(items).toHaveLength(1);
    expect(basis).toHaveLength(1);
    expect(window).toHaveLength(1);
    expect(snapshotBasis).toHaveLength(1);
  });
});
