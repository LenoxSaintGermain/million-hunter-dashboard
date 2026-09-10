import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";

const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
const $ = load(html);

function runEntry(env: Record<string, unknown>, pathname = "/aperture/plays") {
  const appended: any[] = [];
  const document = {
    querySelector: vi.fn(() => appended[0] ?? null),
    createElement: vi.fn(() => ({ dataset: {} })),
    head: { appendChild: vi.fn((script) => { appended.push(script); }) },
  };
  // Execute the actual HTML entry module with deterministic configuration and a
  // document double. Nothing mounts the app, contacts analytics, or reads .env.
  const source = $('script[data-optional-analytics]').html();
  expect(source).toBeTruthy();
  const execute = () => new Script(source!.replaceAll("import.meta.env", "fixtureEnv")).runInNewContext({ fixtureEnv: env, document, URL, location: { origin: "https://uat.example.org", pathname } });
  execute();
  return { document, appended, execute };
}

describe("Optional analytics entry configuration", () => {
  it("never emits a literal placeholder script request", () => {
    expect($('script[src*="%VITE_ANALYTICS_"]')).toHaveLength(0);
    expect($('script[src="/src/main.tsx"]')).toHaveLength(1);
  });

  it.each([
    {}, { VITE_ANALYTICS_ENDPOINT: "https://analytics.example.org" }, { VITE_ANALYTICS_WEBSITE_ID: "fixture-site" },
    { VITE_ANALYTICS_ENDPOINT: " ", VITE_ANALYTICS_WEBSITE_ID: "fixture-site" },
    { VITE_ANALYTICS_ENDPOINT: "%VITE_ANALYTICS_ENDPOINT%", VITE_ANALYTICS_WEBSITE_ID: "fixture-site" },
    { VITE_ANALYTICS_ENDPOINT: "https://analytics.example.org", VITE_ANALYTICS_WEBSITE_ID: "%VITE_ANALYTICS_WEBSITE_ID%" },
    { VITE_ANALYTICS_ENDPOINT: "javascript:alert(1)", VITE_ANALYTICS_WEBSITE_ID: "fixture-site" },
    { VITE_ANALYTICS_ENDPOINT: "https://", VITE_ANALYTICS_WEBSITE_ID: "fixture-site" },
    { VITE_ANALYTICS_ENDPOINT: "analytics.example.org", VITE_ANALYTICS_WEBSITE_ID: "fixture-site" },
    { VITE_ANALYTICS_ENDPOINT: "https://user:secret@analytics.example.org", VITE_ANALYTICS_WEBSITE_ID: "fixture-site" },
  ])("omits analytics for absent or invalid configuration %j", (env) => {
    const { document } = runEntry(env);
    expect(document.createElement).not.toHaveBeenCalled();
    expect(document.head.appendChild).not.toHaveBeenCalled();
  });

  it.each([
    ["https://analytics.example.org", "https://analytics.example.org/umami"],
    ["https://analytics.example.org/base///", "https://analytics.example.org/base/umami"],
    ["/analytics", "https://uat.example.org/analytics/umami"],
  ])("preserves configured endpoint %s and initializes only once", (endpoint, expected) => {
    const { document, appended, execute } = runEntry({ VITE_ANALYTICS_ENDPOINT: endpoint, VITE_ANALYTICS_WEBSITE_ID: "fixture-site" });
    expect(document.createElement).toHaveBeenCalledWith("script");
    expect(appended[0]).toMatchObject({ src: expected, defer: true, dataset: { websiteId: "fixture-site", shAnalytics: "true" } });
    execute();
    expect(document.head.appendChild).toHaveBeenCalledTimes(1);
  });

  it.each(["/demo", "/demo-tour", "/brief", "/walkthrough", "/aperture/walkthrough/"])("keeps deterministic demo entry %s free of analytics requests", (pathname) => {
    const { document } = runEntry({ VITE_ANALYTICS_ENDPOINT: "https://analytics.example.org", VITE_ANALYTICS_WEBSITE_ID: "fixture-site" }, pathname);
    expect(document.createElement).not.toHaveBeenCalled();
    expect(document.head.appendChild).not.toHaveBeenCalled();
  });
});
