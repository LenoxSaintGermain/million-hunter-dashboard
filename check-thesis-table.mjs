import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("SHOW TABLES LIKE 'thesis_compilations'");
console.log("thesis_compilations exists:", rows.length > 0);
const [rows2] = await conn.execute("SHOW TABLES");
console.log("All tables:", rows2.map(r => Object.values(r)[0]));
await conn.end();
