import type { Pool } from "mysql2/promise";

/** Reserved synthetic identities in the fixed disposable database only. Never
 * overwrite an existing row, including a row with unexpected ownership. */
export async function ensurePd06UatDeal(pool: Pool, id: 987654320 | 987654321, name: string, description: string) {
  const [[identity]] = await pool.query<any[]>("SELECT DATABASE() AS name");
  if (process.env.DATABASE_URL !== "" || process.env.NODE_ENV !== "development" || identity?.name !== "signal_evidence_uat") throw new Error("Isolated UAT database required.");
  const [rows] = await pool.execute<any[]>("SELECT owner_user_id, name, is_synthetic FROM deals WHERE id=?", [id]);
  if (rows.length) {
    if (rows[0].owner_user_id !== 987654321 || rows[0].name !== name || !rows[0].is_synthetic) throw new Error("Reserved UAT deal conflicts with existing data; nothing changed.");
    return;
  }
  await pool.execute("INSERT INTO deals (id,owner_user_id,name,description,isArchived,stage,is_synthetic) VALUES (?,987654321,?,?,false,'new',true)", [id, name, description]);
}
