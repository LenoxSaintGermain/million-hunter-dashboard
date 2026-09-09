/** Explicitly authorized local-only integration verification; never deploys. */
import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { INTEGRATION_DATABASE as database, INTEGRATION_USER as username } from "./isolated-integration-identity.mjs";

const mode = process.argv[2];
if (!["--integration", "--credentials"].includes(mode) || process.argv.length !== 3) throw new Error("Use --integration or --credentials. No arbitrary forwarded commands.");
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = mkdtempSync("/tmp/capital-isolated-integration.");
const snapshot = join(output, "snapshot");
mkdirSync(snapshot);
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repo, encoding: "utf8" }).split("\0").filter(Boolean);
const harness = ["scripts/with-isolated-integration.mjs", "scripts/isolated-integration-identity.mjs", "scripts/isolated-integration-network.cjs", "scripts/seed-isolated-integration.ts", "drizzle/legacyCapitalStackSchema.ts"];
const copied = [...new Set([...tracked, ...harness])];
const hashes = {};
for (const file of copied) {
  if (/^\.env(?:$|\.)/.test(file)) throw new Error("Environment files cannot enter the snapshot.");
  if (!existsSync(join(repo, file))) continue;
  mkdirSync(dirname(join(snapshot, file)), { recursive: true });
  cpSync(join(repo, file), join(snapshot, file));
  hashes[file] = createHash("sha256").update(readFileSync(join(snapshot, file))).digest("hex");
}
symlinkSync(join(repo, "node_modules"), join(snapshot, "node_modules"), "dir");
const lane = mode.slice(2);
const configName = `vitest.${lane}.config.ts`;
writeFileSync(join(snapshot, "isolated.config.ts"), `import config from './${configName}';\nexport default {...config, server: {host:'127.0.0.1'}, test: {...config.test, maxWorkers:1, minWorkers:1, pool:'forks', fileParallelism:false, reporters:['json'], outputFile:${JSON.stringify(join(output, "raw.json"))}}};\n`);
const env = {
  PATH: "/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  NODE_ENV: "test", CI: "1", DATABASE_URL: "", DOTENV_CONFIG_PATH: "/dev/null", DOTENV_CONFIG_QUIET: "true",
  NODE_OPTIONS: `--require=${join(snapshot, "scripts/isolated-integration-network.cjs")}`,
  GOOGLE_APPLICATION_CREDENTIALS: join(output, "absent-google-credentials.json"), AWS_EC2_METADATA_DISABLED: "true",
  RUN_EXTERNAL_URL_IMPORT: "", RUN_ALPACA_INTEGRATION: "", RUN_FRED_INTEGRATION: "",
};
const require = createRequire(join(repo, "package.json"));
const dotEnv = existsSync(join(repo, ".env")) ? require("dotenv").parse(readFileSync(join(repo, ".env"))) : {};
for (const name of new Set([...Object.keys(process.env), ...Object.keys(dotEnv)])) {
  if (!(name in env) && (/KEY|TOKEN|SECRET|DATABASE|PASSWORD|CREDENTIAL|API|RUN_.*INTEGRATION/i.test(name) || name in dotEnv)) env[name] = "";
}
const credentialNames = ["GEMINI_API_KEY", "OPENAI_API_KEY", "Poe_api_key", "ANTHROPIC_API_KEY"];
const credentials = {};
if (lane !== "integration") for (const name of credentialNames) {
  env[name] = process.env[name] || dotEnv[name] || "";
  credentials[name] = { present: Boolean(env[name]), meetsExistingLengthAssertion: env[name].length > 10, source: process.env[name] ? "process environment" : dotEnv[name] ? "repository .env" : "absent", providerValidated: false };
}
const secrets = Object.values(env).filter(value => value && credentialNames.some(name => env[name] === value));
const redact = text => secrets.reduce((result, secret) => result.split(secret).join("[redacted]"), text);
writeFileSync(join(output, "snapshot.json"), JSON.stringify({ head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), lane, node: process.version, hashes, untrackedTests: "excluded", database: lane === "credentials" ? "none" : database, providerCalls: "network denied", credentials }, null, 2));
console.log(JSON.stringify({ output, lane, database: lane === "credentials" ? "none" : database }));
const docker = (args, input) => execFileSync("docker", args, { encoding: "utf8", input, maxBuffer: 4 * 1024 * 1024 });
const sql = statement => docker(["exec", "-i", "sh-ch-capital-uat-db", "sh", "-c", 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot --batch --skip-column-names'], statement);
const run = (args, label) => new Promise(resolveRun => {
  const child = spawn(process.execPath, args, { cwd: snapshot, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", data => { log = (log + redact(String(data))).slice(-1024 * 1024); });
  const timer = setTimeout(() => child.kill("SIGTERM"), 240000);
  const terminate = () => child.kill("SIGTERM");
  process.once("SIGINT", terminate); process.once("SIGTERM", terminate);
  child.on("error", error => { log += redact(String(error)); });
  child.on("close", code => {
    clearTimeout(timer); process.off("SIGINT", terminate); process.off("SIGTERM", terminate);
    writeFileSync(join(output, `${label}.log`), log);
    console.log(JSON.stringify({ phase: label, exit: code }));
    resolveRun(code ?? 1);
  });
});
let ownedDatabase = false;
let ownedUser = false;
try {
  if (lane !== "credentials") {
    const container = JSON.parse(docker(["inspect", "sh-ch-capital-uat-db", "--format", "{{json .}}"]));
    const ports = container.NetworkSettings?.Ports?.["3306/tcp"];
    if (container.Name !== "/sh-ch-capital-uat-db" || !container.State?.Running || ports?.length !== 1 || ports[0].HostIp !== "127.0.0.1" || ports[0].HostPort !== "3307" || !container.Config.Env.includes("MARIADB_DATABASE=capital_aperture_uat_9c18799")) throw new Error("Exact approved loopback container identity check failed.");
    if (sql(`SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${database}';`).trim() || sql(`SELECT User FROM mysql.user WHERE User = '${username}';`).trim()) throw new Error("Disposable target already exists; refusing to reuse or delete it.");
    const password = randomBytes(32).toString("hex");
    secrets.push(password);
    sql(`CREATE DATABASE \`${database}\`;`); ownedDatabase = true;
    sql(`CREATE USER '${username}'@'%' IDENTIFIED BY '${password}';`); ownedUser = true;
    sql(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${username}'@'%';`);
    env.DATABASE_URL = `mysql://${username}:${password}@127.0.0.1:3307/${database}`;
    env.ISOLATED_INTEGRATION_DATABASE = database;
    // Prove the worker account has no browser-fixture or global privileges.
    const grants = sql(`SHOW GRANTS FOR '${username}'@'%';`);
    if (!grants.includes(`ON \`${database}\`.*`) || grants.includes("ALL PRIVILEGES ON *.*")) throw new Error("Unexpected test-account privileges.");
    const schemaExit = await run(["--import", "tsx", "scripts/seed-isolated-integration.ts"], "schema");
    if (schemaExit) throw new Error("Isolated schema preparation failed; inspect schema.log.");
  }
  process.exitCode = await run(["node_modules/vitest/vitest.mjs", "run", "--config", "isolated.config.ts"], lane);
  if (existsSync(join(output, "raw.json"))) {
    const raw = JSON.parse(readFileSync(join(output, "raw.json"), "utf8"));
    const results = raw.testResults ?? [];
    const summary = { lane, exitCode: process.exitCode, files: results.length, filesPassed: results.filter(r => r.status === "passed").length, filesFailed: results.filter(r => r.status === "failed").length, passed: raw.numPassedTests, failed: raw.numFailedTests, skipped: raw.numPendingTests,
      failures: results.filter(r => r.status === "failed").map(r => ({ file: r.name.replace(/^\/private(?=\/tmp\/)/, "").replace(snapshot + "/", ""), message: lane === "credentials" ? undefined : redact(r.message ?? "").slice(0, 3000), assertions: r.assertionResults.filter(a => a.status === "failed").map(a => ({ name: a.fullName, failures: lane === "credentials" ? undefined : a.failureMessages.map(m => redact(m).slice(0, 2500)) })) })) };
    // Raw output can contain assertion operands: redact before retaining it.
    writeFileSync(join(output, "raw.json"), redact(JSON.stringify(raw, null, 2)));
    writeFileSync(join(output, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ ...summary, failures: summary.failures.map(f => ({ file: f.file, tests: f.assertions.map(a => a.name) })) }));
  }
} catch (error) {
  console.error(redact(error.message));
  process.exitCode = 1;
} finally {
  if (ownedDatabase) sql(`DROP DATABASE \`${database}\`;`);
  if (ownedUser) sql(`DROP USER '${username}'@'%';`);
  const databaseRemoved = ownedDatabase && !sql(`SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${database}';`).trim();
  const userRemoved = ownedUser && !sql(`SELECT User FROM mysql.user WHERE User = '${username}';`).trim();
  writeFileSync(join(output, "cleanup.json"), JSON.stringify({ database, databaseRemoved, userRemoved, browserDatabaseMutations: 0 }));
  console.log(JSON.stringify({ cleanup: "owned disposable resources only", databaseRemoved, userRemoved, output }));
  if ((ownedDatabase && !databaseRemoved) || (ownedUser && !userRemoved)) process.exitCode = 1;
}
