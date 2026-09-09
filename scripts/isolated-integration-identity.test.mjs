import { test } from "node:test";
import assert from "node:assert/strict";
import { INTEGRATION_DATABASE as db, INTEGRATION_USER as user, requireIsolatedIntegrationDatabase as check } from "./isolated-integration-identity.mjs";

const valid = `mysql://${user}:local-test-password@127.0.0.1:3307/${db}`;
test("accepts only the exact disposable DB and scoped user", () => {
  assert.equal(check(valid, db).pathname, `/${db}`);
});
for (const [name, url, marker = db] of [
  ["empty", ""], ["malformed", "not-a-url"],
  ["remote host", valid.replace("127.0.0.1", "production.example.invalid")],
  ["localhost alias", valid.replace("127.0.0.1", "localhost")],
  ["other port", valid.replace(":3307", ":3306")],
  ["browser fixture", valid.replace(db, "capital_aperture_uat_9c18799")],
  ["root user", valid.replace(user, "root")],
  ["missing password", valid.replace(":local-test-password", "")],
  ["URL overrides", valid + "?database=production"],
  ["URL fragment", valid + "#override"],
  ["missing marker", valid, ""],
]) {
  test(`rejects ${name} without echoing secrets`, () => {
    assert.throws(() => check(url, marker), error =>
      /exact disposable loopback/.test(error.message) && !error.message.includes("local-test-password"));
  });
}
