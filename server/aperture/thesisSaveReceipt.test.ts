import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildThesisSaveReceipt } from "../../shared/thesisSaveReceipt";

describe("buildThesisSaveReceipt", () => {
  const fullName = "MRVL AI Data Center & Interconnect Expansion H2-2026";

  it("preserves and confirms the complete persisted thesis name", () => {
    expect(buildThesisSaveReceipt({ compilationId: 690001, requestedName: fullName, persistedName: fullName })).toEqual({
      compilationId: 690001,
      persistedName: fullName,
      nameMatchesRequest: true,
    });
  });

  it("detects a clipped or incorrectly submitted persisted name", () => {
    expect(buildThesisSaveReceipt({ compilationId: 690001, requestedName: fullName, persistedName: "MR" }).nameMatchesRequest).toBe(false);
  });

  it("requires the create route to read back and verify the persisted name", () => {
    const source = readFileSync(resolve(process.cwd(), "server/thesisRouter.ts"), "utf8");
    expect(source).toContain("persistedName: saved?.name");
    expect(source).toContain("!receipt.nameMatchesRequest");
    expect(source).toContain("return receipt");
  });
});
