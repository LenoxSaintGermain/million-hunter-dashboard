// Browser-only fixture inspection. No production API, login, or database writes.
// PLAYWRIGHT_MODULE may point to a bundled playwright module.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
const mutations = [];
page.on("pageerror", error => errors.push(error.message));
const deal = { id: 1, name: "Illustrative HVAC business", industry: "HVAC", location: "Georgia", askingPrice: 1770000, cashFlow: 506000, revenue: 1700000, stage: "qualified", score: 0.732, redFlagCount: null, isSynthetic: true, listingUrl: "https://example.com/illustrative-listing", description: "Illustrative discovery capture. Listing figures are source-reported, not verified. " .repeat(10) };
const data = {
  "auth.me": { id: 1, name: "Fixture reviewer", role: "admin", onboardingCompleted: true },
  "user.onboardingStatus": { completed: true },
  "deals.getById": { deal, signal: null, memo: null },
  "deals.list": [deal, { ...deal, id: 2, name: "Illustrative project business", cashFlow: null, askingPrice: null }],
  "agents.getTrajectory": [],
  "agent.getLatestRuns": [],
  "agents.getRuns": [],
};
await context.route("**/api/**", async route => {
  const req = route.request();
  if (req.method() !== "GET") { mutations.push(req.url()); await route.abort(); return; }
  const names = new URL(req.url()).pathname.split("/api/trpc/")[1]?.split(",") ?? [];
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(names.map(name => ({ result: { data: { json: data[decodeURIComponent(name)] ?? null } } }))) });
});
await page.goto("http://127.0.0.1:3120/deal/1");
await page.getByRole("heading", { name: "The Senior.", exact: true }).waitFor();
for (const width of [1440, 972, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `/tmp/hunter-deal-${width}.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
  if (width === 390) await page.getByRole("button", { name: "The Senior ↗", exact: true }).click();
  assert.equal(await page.getByRole("tab", { name: /Challenge the cash/ }).isVisible(), true);
  await page.getByRole("tab", { name: /Challenge the cash/ }).click();
  await page.getByRole("button", { name: "Run Third Signal Analysis", exact: true }).waitFor();
  assert.equal(mutations.length, 0, "Opening a reading pane must not run an agent");
  if (width === 390) {
    await page.getByRole("button", { name: "The Senior ↗", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: "/tmp/hunter-senior-mobile.png", fullPage: true });
  }
  await page.getByRole("tab", { name: /Follow the sources/ }).click();
}
await page.setViewportSize({ width: 972, height: 1000 });
for (const name of [/Test the financing/, /Hear the committee/, /Build the argument/]) {
  await page.getByRole("tab", { name }).click();
  assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 1);
}
await page.locator(".deal-desk-drawer summary").first().click();
for (const name of [/Prepare outreach/, /Explore a seller scenario/, /Direct the specialists/, /Trace the reasoning/, /Prepare an LOI/]) {
  await page.getByRole("tab", { name }).click();
  assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 1);
}
assert.deepEqual(mutations, [], "Reading specialist panes must never execute them");
await page.setViewportSize({ width: 972, height: 1000 });
await page.goto("http://127.0.0.1:3120/scan");
await page.getByRole("heading", { name: "Illustrative HVAC business" }).waitFor();
for (const width of [1440, 972, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `/tmp/hunter-scan-${width}.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `scan overflow at ${width}`);
}
assert.deepEqual(errors, []);
assert.deepEqual(mutations, []);
console.log(JSON.stringify({ result: "PASS", viewports: [1440, 972, 390], mutations: mutations.length, errors, fixtures: "illustrative browser-only" }));
await browser.close();
