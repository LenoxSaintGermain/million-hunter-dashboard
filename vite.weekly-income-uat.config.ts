import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Weekly Income (#82) zero-API fixture renderer for Quick Play states.
// Never part of the production entry or build. Mirrors vite.today-uat.config.ts.
export default defineConfig(({ command }) => {
  if (command !== "serve" || process.env.ISOLATED_UAT_MODE !== "true") throw new Error("Weekly Income fixture requires isolated serve mode.");
  return {
    root: path.resolve("tests/uat/weekly-income"), envDir: false, publicDir: false,
    plugins: [react(), tailwindcss()],
    resolve: { alias: [
      { find: "@/lib/trpc", replacement: path.resolve("tests/uat/weekly-income/noTrpc.ts") },
      { find: "@", replacement: path.resolve("client/src") },
      { find: "@shared", replacement: path.resolve("shared") },
    ] },
    server: { host: "127.0.0.1", port: 3112, strictPort: true, fs: { allow: [process.cwd()], deny: ["**/.*"] } },
  };
});
