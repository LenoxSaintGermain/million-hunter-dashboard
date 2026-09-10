import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");

describe("Third Signal Capital Scout contract", () => {
  it("keeps the MCP wiring paper-only and read-oriented", () => {
    const config = JSON.parse(
      readFileSync(resolve(repoRoot, ".agents/mcp_config.example.json"), "utf8"),
    ) as any;
    const env = config.mcpServers["alpaca-capital-scout"].env;

    expect(env.ALPACA_PAPER_TRADE).toBe("true");
    expect(env.ALPACA_TOOLSETS.split(",")).toEqual([
      "assets",
      "stock-data",
      "crypto-data",
      "options-data",
      "corporate-actions",
      "news",
    ]);
    expect(env.ALPACA_TOOLSETS).not.toContain("trading");
    expect(env.ALPACA_TOOLSETS).not.toContain("account");
  });

  it("declares the provenance and human-handoff contract", () => {
    const prompt = readFileSync(resolve(repoRoot, "agents/capital-scout.md"), "utf8");

    expect(prompt).toContain("Never switch to live credentials");
    expect(prompt).toContain("Do not place, replace, cancel, or liquidate orders");
    expect(prompt).toContain('"basis": "verified | modeled | unknown"');
    expect(prompt).toContain("Capital Scout hands a brief to Capital Aperture");
  });
});
