/** Local test harness. Never loads production credentials or changes broker state. */
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const monitoringServer = process.argv[2] === "--monitoring-server";
const monitoringSeed = process.argv[2] === "--monitoring-seed";
const monitoringInspect = process.argv[2] === "--monitoring-inspect";
const server = process.argv[2] === "--server" || monitoringServer;
const test = process.argv[2] === "--test";
const seed = process.argv[2] === "--seed" || monitoringSeed || monitoringInspect;
const shuffle = test && process.argv[3] === "--shuffle";
if ((!server && !test && !seed) || process.argv.length > (shuffle ? 4 : 3)) throw new Error("Use --server, --seed, --monitoring-server, --monitoring-seed, --monitoring-inspect, or --test [--shuffle].");
const container = JSON.parse(execFileSync("docker", ["inspect", "sh-ch-capital-uat-db", "--format", "{{json .}}"], { encoding: "utf8" }));
const bindings = container.NetworkSettings?.Ports?.["3306/tcp"];
if (!container.State?.Running || bindings?.length !== 1 || bindings[0].HostIp !== "127.0.0.1" || bindings[0].HostPort !== "3307") throw new Error("The isolated database must be running and bound only to 127.0.0.1:3307.");
const config = container.Config.Env;
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
  NODE_ENV: "development", ISOLATED_UAT_MODE: "true", LOCAL_PREVIEW_OPENID: monitoringServer ? "uat_monitoring_20260910" : "uat_guided_20260909",
  JWT_SECRET: "isolated-uat-no-production-authority", PORT: monitoringServer ? "3112" : "3110",
  VITE_ANALYTICS_ENDPOINT: "", VITE_ANALYTICS_WEBSITE_ID: "",
});
const command = test ? "./node_modules/.bin/vitest" : "./node_modules/.bin/tsx";
// --test never seeds or starts a server. Shuffling has a fixed replayable seed
// and cannot broaden the test-file scope through arbitrary forwarded arguments.
const args = server ? ["server/_core/index.ts"] : seed ? [monitoringSeed || monitoringInspect ? "scripts/seed-monitoring-capital-uat.ts" : "scripts/seed-guided-capital-uat.ts", ...(monitoringInspect ? ["--inspect"] : [])] : ["run", "server/aperture/persistedJourneys.integration.test.ts", ...(shuffle ? ["--sequence.shuffle", "--sequence.seed=630001"] : [])];
const child = spawn(command, args, { env, stdio: "inherit" });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
