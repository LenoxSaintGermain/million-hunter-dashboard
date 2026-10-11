/** Loopback-only UAT: real feeds, illustrative identity, isolated DB budgets.
 * Never loads .env or connects to a production database/broker.
 */
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { router, publicProcedure } from "../server/_core/trpc";
import { createPublicIntelligenceRouter } from "../server/routers/publicIntelligenceRouter";
import { createEvidenceRepository } from "../server/evidenceRepository";
import { openEvidenceUatDatabase } from "./sec-evidence-local-db";

if (process.env.DATABASE_URL !== "" || process.env.NODE_ENV !== "development") {
  throw new Error(
    "UAT requires NODE_ENV=development and explicitly empty DATABASE_URL."
  );
}
if (
  !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(process.env.SEC_USER_AGENT?.trim() ?? "")
) {
  throw new Error(
    "Set SEC_USER_AGENT with your real application/contact identity before starting feed UAT."
  );
}
const { pool, db } = openEvidenceUatDatabase();
const repository = createEvidenceRepository(async () => db);
const user = {
  id: 987654321,
  openId: "illustrative-public-feed-uat",
  name: "Illustrative feed UAT",
  email: null,
  role: "user",
  onboardingCompleted: true,
  defaultWorkspace: "acquisition",
};
const uatRouter = router({
  publicIntelligence: createPublicIntelligenceRouter({
    reserve: () => repository.reserveSecProviderBudget(),
    cooldown: until => repository.setSecCooldown(until),
  }, { reserve: provider => repository.reserveFeedProvider(provider) }, ownerId => repository.reserveFeedCaller(ownerId)),
  auth: router({ me: publicProcedure.query(() => user) }),
  user: router({
    onboardingStatus: publicProcedure.query(() => ({
      completed: true,
      role: "user",
    })),
  }),
});
const app = express();
const server = createServer(app);
let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
let shutdownPromise: Promise<void> | undefined;
function shutdown(): Promise<void> {
  return (shutdownPromise ??= (async () => {
    // Attempt every cleanup even if one resource fails to close.
    const results = await Promise.allSettled([
      vite?.close(),
      new Promise<void>((resolve, reject) => {
        if (!server.listening) return resolve();
        server.close(error => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
      pool.end(),
    ]);
    const failure = results.find(result => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  })());
}
try {
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: uatRouter,
      createContext: ({ req, res }) => ({ req, res, user: user as any }),
    })
  );
  const root = path.resolve(import.meta.dirname, "..");
  vite = await createViteServer({
    configFile: false,
    envFile: false,
    plugins: [react(), tailwindcss()],
    root: path.join(root, "client"),
    resolve: {
      alias: {
        "@": path.join(root, "client/src"),
        "@shared": path.join(root, "shared"),
        "@assets": path.join(root, "attached_assets"),
      },
    },
    server: {
      middlewareMode: true,
      hmr: { server },
      fs: { strict: true, deny: ["**/.*"] },
    },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.get("*", async (req, res, next) => {
    try {
      const html = await fs.readFile(
        path.join(root, "client/index.html"),
        "utf8"
      );
      const labeled = html.replace(
        "<body>",
        '<body><aside style="padding:8px 16px;background:#0e1520;color:white;font:12px monospace">LOCAL UAT · illustrative identity · live public-provider reads · isolated database budget writes · no production database or orders</aside>'
      );
      res
        .type("html")
        .send(await vite!.transformIndexHtml(req.originalUrl, labeled));
    } catch (error) {
      next(error);
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(3147, "127.0.0.1", () => {
      server.off("error", reject);
      console.log(
        "Feed UAT: http://127.0.0.1:3147/public-intelligence — illustrative identity; live public-provider reads; isolated DB budgets; no production database or orders."
      );
      resolve();
    });
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void shutdown().then(
        () => process.exit(0),
        error => {
          console.error("Local UAT shutdown failed", error);
          process.exit(1);
        }
      );
    });
} catch (error) {
  await shutdown();
  throw error;
}
