import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Dedicated zero-API renderer fixture, never part of the production entry/build.
export default defineConfig(({ command }) => {
  if (command !== "serve" || process.env.ISOLATED_UAT_MODE !== "true") throw new Error("Today fixture requires isolated serve mode.");
  return {
    root: path.resolve("tests/uat/today"), envDir: false, publicDir: false,
    plugins: [react(), tailwindcss()],
    resolve: { alias: [
      { find: "@/lib/trpc", replacement: path.resolve("tests/uat/today/queryFixture.ts") },
      { find: "@", replacement: path.resolve("client/src") },
      { find: "@shared", replacement: path.resolve("shared") },
    ] },
    server: { host: "127.0.0.1", port: 3111, strictPort: true, fs: { allow: [process.cwd()], deny: ["**/.*"] } },
  };
});
