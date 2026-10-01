// Additive schema preparation. Never infers ownership of historical jobs.
import "dotenv/config";
import mysql from "mysql2/promise";
const apply = process.argv.includes("--apply");
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [columns] = await db.execute("SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='scan_jobs' AND COLUMN_NAME='owner_user_id'");
  if (columns.length && columns[0].DATA_TYPE !== "int") throw new Error("Unexpected owner column type; no changes made");
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", addOwnerColumn: columns.length === 0, historicalAssignments: 0 }));
  if (apply && !columns.length) await db.query("ALTER TABLE scan_jobs ADD COLUMN owner_user_id INT NULL");
  if (apply) {
    const [verified] = await db.execute("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='scan_jobs' AND COLUMN_NAME='owner_user_id' AND DATA_TYPE='int'");
    if (Number(verified[0].n) !== 1) throw new Error("Owner column read-back failed");
    console.log(JSON.stringify({ ownerColumnVerified: true, historicalJobsUnchanged: true }));
  }
} finally { await db.end(); }
