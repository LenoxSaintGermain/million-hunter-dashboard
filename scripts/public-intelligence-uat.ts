/** Loopback-only UAT: real feed router + UI, illustrative identity, no DB/broker. */
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { router, publicProcedure } from "../server/_core/trpc";
import { publicIntelligenceRouter } from "../server/routers/publicIntelligenceRouter";

if (process.env.DATABASE_URL !== "" || process.env.NODE_ENV !== "development") {
  throw new Error("UAT requires NODE_ENV=development and explicitly empty DATABASE_URL.");
}
const user = { id: 987654321, openId: "illustrative-public-feed-uat", name: "Illustrative feed UAT", email: null,
  role: "user", onboardingCompleted: true, defaultWorkspace: "acquisition" };
const uatRouter = router({
  publicIntelligence: publicIntelligenceRouter,
  auth: router({ me: publicProcedure.query(() => user) }),
  user: router({ onboardingStatus: publicProcedure.query(() => ({ completed: true, role: "user" })) }),
});
const app = express();
const server = createServer(app);
app.use("/api/trpc", createExpressMiddleware({ router: uatRouter,
  createContext: ({ req, res }) => ({ req, res, user: user as any }) }));
const root = path.resolve(import.meta.dirname, "..");
const vite = await createViteServer({ configFile: false, envFile: false,
  plugins: [react(), tailwindcss()], root: path.join(root, "client"),
  resolve: { alias: { "@": path.join(root, "client/src"), "@shared": path.join(root, "shared"), "@assets": path.join(root, "attached_assets") } },
  server: { middlewareMode: true, hmr: { server }, fs: { strict: true, deny: ["**/.*"] } }, appType: "custom" });
app.use(vite.middlewares);
app.get("*", async (req, res, next) => {
  try {
    const html = await fs.readFile(path.join(root, "client/index.html"), "utf8");
    const labeled = html.replace('<body>', '<body><aside style="padding:8px 16px;background:#0e1520;color:white;font:12px monospace">LOCAL UAT · illustrative identity · real read-only public feeds · no database or orders</aside>');
    res.type("html").send(await vite.transformIndexHtml(req.originalUrl, labeled));
  } catch (error) { next(error); }
});
server.listen(3147, "127.0.0.1", () => console.log("Feed UAT: http://127.0.0.1:3147/public-intelligence — illustrative identity, real read-only public feeds; no database."));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, async () => { await vite.close(); server.close(); process.exit(0); });
