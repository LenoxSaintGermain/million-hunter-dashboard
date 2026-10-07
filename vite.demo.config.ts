import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Standalone UI preview: no .env loading, backend, production proxy or telemetry plugin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envFile: false,
  envPrefix: "LOCAL_DEMO_PUBLIC_",
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client/public"),
  resolve: { alias: {
    "@": path.resolve(import.meta.dirname, "client/src"),
    "@shared": path.resolve(import.meta.dirname, "shared"),
    "@assets": path.resolve(import.meta.dirname, "attached_assets"),
  } },
  server: { host: "127.0.0.1", port: 3137, strictPort: true },
  build: { outDir: path.resolve(import.meta.dirname, "dist/demo"), emptyOutDir: true },
});
