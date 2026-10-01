// Read-only by default. Apply atomically replaces the two verified global indexes.
import "dotenv/config";
import mysql from "mysql2/promise";
const apply = process.argv.includes("--apply");
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const inspect = async () => {
    const [rows] = await db.query("SHOW INDEX FROM deals");
    const groups = new Map();
    for (const row of rows) if (!row.Non_unique && row.Key_name !== "PRIMARY") {
      const group = groups.get(row.Key_name) ?? [];
      group[row.Seq_in_index - 1] = row.Column_name; groups.set(row.Key_name, group);
    }
    return groups;
  };
  const indexes = await inspect();
  const target = "uq_deals_owner_name_source";
  if (indexes.size === 1 && indexes.get(target)?.join(",") === "owner_user_id,name,source") {
    console.log(JSON.stringify({ alreadyScoped: true }));
  } else {
    const old = ["uq_deals_name_source", "deals_name_source_unique"];
    if (indexes.size !== 2 || !old.every(name => indexes.get(name)?.join(",") === "name,source")) throw new Error("Unexpected uniqueness schema; refusing migration");
    const [missing] = await db.query("SELECT COUNT(*) AS n FROM deals WHERE owner_user_id IS NULL");
    if (Number(missing[0].n)) throw new Error("Unassigned deals remain; reconcile owners first");
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", replaces: old, with: target, recordsChanged: 0 }));
    if (apply) {
      await db.query("ALTER TABLE deals DROP INDEX uq_deals_name_source, DROP INDEX deals_name_source_unique, ADD UNIQUE INDEX uq_deals_owner_name_source (owner_user_id, name, source)");
      const verified = await inspect();
      if (verified.size !== 1 || verified.get(target)?.join(",") !== "owner_user_id,name,source") throw new Error("Index read-back failed");
      console.log(JSON.stringify({ ownerScopedUniquenessVerified: true, recordsChanged: 0 }));
    }
  }
} finally { await db.end(); }
