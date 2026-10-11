import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

/** Deliberately fixed disposable loopback database. Never load .env here. */
export function openEvidenceUatDatabase() {
  if (process.env.DATABASE_URL !== "" || process.env.NODE_ENV !== "development") {
    throw new Error("Local evidence UAT requires explicitly empty DATABASE_URL and NODE_ENV=development.");
  }
  const pool = mysql.createPool({ host: "127.0.0.1", port: 13372, user: "root", password: "isolated-uat-only",
    database: "signal_evidence_uat", connectionLimit: 8, timezone: "Z" });
  const db = drizzle(pool);
  return { pool, db };
}
