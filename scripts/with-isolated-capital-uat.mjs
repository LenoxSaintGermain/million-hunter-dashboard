/** Local test harness. Never loads production credentials or changes broker state. */
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const config = JSON.parse(execFileSync("docker", ["inspect", "sh-ch-capital-uat-db", "--format", "{{json .Config.Env}}"], { encoding: "utf8" }));
const local = Object.fromEntries(config.map((entry) => { const split = entry.indexOf("="); return [entry.slice(0, split), entry.slice(split + 1)]; }));
if (local.MARIADB_DATABASE !== "capital_aperture_uat_9c18799" || !local.MARIADB_ROOT_PASSWORD) throw new Error("The exact isolated UAT database identity could not be verified.");
const env = { ...process.env };
// dotenv/config does not replace explicitly empty values. Blank all names, not
// merely the known provider keys, before starting the application/test process.
if (existsSync(".env")) for (const line of readFileSync(".env", "utf8").split("\n")) {
  const name = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=/)?.[1];
  if (name) env[name] = "";
}
for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|DATABASE|PASSWORD/.test(key)) env[key] = "";
Object.assign(env, {
  // Container-local credentials only. This root connection intentionally does
  // not satisfy the uat_app-qualified artificial play / order fixture gate.
  DATABASE_URL: `mysql://root:${encodeURIComponent(local.MARIADB_ROOT_PASSWORD)}@127.0.0.1:3307/capital_aperture_uat_9c18799`,
  NODE_ENV: "development", ISOLATED_UAT_MODE: "true", LOCAL_PREVIEW_OPENID: "uat_guided_20260909",
  JWT_SECRET: "isolated-uat-no-production-authority", PORT: "3110",
  VITE_ANALYTICS_ENDPOINT: "", VITE_ANALYTICS_WEBSITE_ID: "",
});
const server = process.argv[2] === "--server";
const test = process.argv[2] === "--test";
const seed = process.argv[2] === "--seed";
if (!server && !test && !seed) throw new Error("Use --server, --seed, or --test.");
const command = test ? "./node_modules/.bin/vitest" : "./node_modules/.bin/tsx";
const args = server ? ["server/_core/index.ts"] : seed ? ["scripts/seed-guided-capital-uat.ts"] : ["run", "server/aperture/persistedJourneys.integration.test.ts"];
const child = spawn(command, args, { env, stdio: "inherit" });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
