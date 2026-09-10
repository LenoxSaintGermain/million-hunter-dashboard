import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const preload = fileURLToPath(new URL("./isolated-integration-network.cjs", import.meta.url));
const cases = [
  ["remote TCP", `require('node:net').connect({host:'198.51.100.1',port:443})`],
  ["other local port", `require('node:net').connect({host:'127.0.0.1',port:3306})`],
  ["Unix socket", `require('node:net').connect({path:'/tmp/not-a-database.sock'})`],
  ["TLS", `require('node:tls').connect({host:'198.51.100.1',port:443})`],
  ["HTTP", `require('node:http').request('http://example.invalid')`],
  ["HTTPS", `require('node:https').request('https://example.invalid')`],
  ["subprocess", `require('node:child_process').execSync('false')`],
];
for (const [name, expression] of cases) {
  test(`preload blocks ${name} before opening a connection`, () => {
    const program = `require('node:assert/strict').throws(() => { ${expression}; }, /ISOLATED_INTEGRATION_NETWORK_DENIED/);`;
    assert.doesNotThrow(() => execFileSync(process.execPath, ["--require", preload, "-e", program], {
      env: { ISOLATED_INTEGRATION_DATABASE: "capital_aperture_test_20260909_zzugqp" }, stdio: "pipe",
    }));
  });
}
test("credential lane denies even the integration DB", () => {
  const program = `require('node:assert/strict').throws(() => require('node:net').connect({host:'127.0.0.1',port:3307}), /ISOLATED_INTEGRATION_NETWORK_DENIED/);`;
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--require", preload, "-e", program], { env: {}, stdio: "pipe" }));
});
test("preload blocks fetch and DNS promises", () => {
  const program = `const assert=require('node:assert/strict'); (async()=>{await assert.rejects(fetch('https://example.invalid'), /ISOLATED_INTEGRATION_NETWORK_DENIED/); await assert.rejects(require('node:dns').promises.lookup('example.invalid'), /ISOLATED_INTEGRATION_NETWORK_DENIED/);})().catch(()=>process.exitCode=1);`;
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--require", preload, "-e", program], { env: {}, stdio: "pipe" }));
});
test("browser harness resolves only literal loopback without allowing external DNS", () => {
  const program = `const a=require('node:assert/strict'),dns=require('node:dns'); dns.lookup('127.0.0.1',(e,address)=>{a.ifError(e);a.equal(address,'127.0.0.1')});dns.lookup('example.invalid',(e)=>a.match(e.message,/DNS_DENIED/));a.throws(()=>require('node:net').connect({host:'198.51.100.1',port:443}),/NETWORK_DENIED/);`;
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--require", preload, "-e", program], {
    env: { ISOLATED_BROWSER_HARNESS: "true", ISOLATED_INTEGRATION_DATABASE: "capital_aperture_test_20260909_zzugqp" }, stdio: "pipe",
  }));
});
