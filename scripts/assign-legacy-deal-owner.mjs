// Explicit, additive legacy backfill. Dry-run by default; never changes existing owners.
import "dotenv/config";
import mysql from "mysql2/promise";

const apply = process.argv.includes("--apply");
const email = "treble.design@gmail.com";
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [users] = await db.execute(
    "SELECT id, email, role, merged_into_user_id FROM users WHERE LOWER(TRIM(email)) = ?",
    [email],
  );
  if (users.length !== 1 || users[0].role !== "admin" || users[0].merged_into_user_id != null) {
    throw new Error("Expected exactly one canonical admin; refusing assignment");
  }
  const ownerId = users[0].id;
  const [columns] = await db.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deals' AND COLUMN_NAME = 'owner_user_id'",
  );
  const hasOwner = columns.length === 1;
  const [targets] = await db.query(
    `SELECT id FROM deals ${hasOwner ? "WHERE owner_user_id IS NULL" : ""} ORDER BY id`,
  );
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", email, ownerId, addOwnerColumn: !hasOwner, targetIds: targets.map(r => r.id) }));
  if (apply) {
    if (!hasOwner) await db.query("ALTER TABLE deals ADD COLUMN owner_user_id INT NULL");
    await db.beginTransaction();
    try {
      // Bound assignment to the inspected IDs: concurrent new deals are not swept in.
      for (const { id } of targets) {
        const [result] = await db.execute(
          "UPDATE deals SET owner_user_id = ?, updatedAt = updatedAt WHERE id = ? AND owner_user_id IS NULL",
          [ownerId, id],
        );
        if (result.affectedRows !== 1) throw new Error(`Deal ${id} changed during assignment; rolling back`);
      }
      for (const { id } of targets) {
        const [rows] = await db.execute("SELECT owner_user_id FROM deals WHERE id = ?", [id]);
        if (rows.length !== 1 || rows[0].owner_user_id !== ownerId) throw new Error("Assignment read-back failed");
      }
      await db.commit();
      console.log(JSON.stringify({ verifiedAssigned: targets.length, ownerId, existingOwnersUnchanged: true }));
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }
} finally {
  await db.end();
}
