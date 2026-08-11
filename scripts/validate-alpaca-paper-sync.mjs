import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema.ts";
import { getDb } from "../server/db.ts";
import { appRouter } from "../server/routers.ts";

const accountId = 1;
const db = await getDb();
if (!db) throw new Error("Database connection is unavailable");

const [admin] = await db.select().from(users).where(eq(users.id, 1)).limit(1);
if (!admin || admin.role !== "admin") throw new Error("Admin user 1 is required for this read-only validation");

const caller = appRouter.createCaller({
  user: admin,
  req: {} ,
  res: {},
});

const result = await caller.aperture.account.sync({ id: accountId });
console.log(JSON.stringify({ accountId, ...result }, null, 2));
process.exit(0);
