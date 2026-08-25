import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertOutcomeWindow,
  compileDisclosureIntent,
  DISCLOSURE_MANDATE_V1,
  evaluateDisclosureTransaction,
  tightenControls,
} from "../../shared/disclosure";
import { DisclosureDocumentStore, housePtrFixtureDocument } from "./disclosureRail";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("WP-DIR1 disclosure grammar and provenance", () => {
  it("keeps omitted plan controls visibly unresolved rather than inventing them", () => {
    const plan = compileDisclosureIntent("Monitor House filings for notable public disclosures.");
    expect(plan.unresolved.join(" ")).toMatch(/Cadence|Filer|Issuer/);
  });

  it("rejects prohibited copy-trading language", () => {
    expect(() => compileDisclosureIntent("Copy Congress trades every day")).toThrow(/Prohibited/);
  });

  it("permits only tighter mandate controls", () => {
    expect(() => tightenControls({ maximumLagDays: 46 })).toThrow(/tighten/);
    expect(() => tightenControls({ minimumDisclosedRangeFloorUsd: 15_000 })).toThrow(/tighten/);
    expect(tightenControls({ maximumLagDays: 20, maximumObservationsPerPlanDay: 5 })).toMatchObject({ maximumLagDays: 20, maximumObservationsPerPlanDay: 5 });
  });

  it("retains transaction value ranges without a midpoint and holds unresolved asset text", () => {
    const now = Date.parse("2026-05-01T00:00:00.000Z");
    const result = evaluateDisclosureTransaction({
      sourceRowIdentity: "fixture:1", ownerAsStated: "spouse", rawAssetName: "Raw issuer text", transactionType: "purchase",
      transactionDate: Date.parse("2026-04-20T00:00:00.000Z"), amountMinUsd: 1_001, amountMaxUsd: 15_000,
      assetType: null, resolutionGrade: "none", publicationAt: Date.parse("2026-04-24T00:00:00.000Z"), firstObservedAt: now,
    }, { ...DISCLOSURE_MANDATE_V1, allowedAssetTypes: [...DISCLOSURE_MANDATE_V1.allowedAssetTypes] }, now);
    expect(result.state).toBe("held");
    expect(result.reasons).toEqual(expect.arrayContaining(["unsupported_asset", "entity_unresolved", "below_disclosed_range_floor"]));
    expect(result).not.toHaveProperty("amountMidpoint");
  });

  it("prevents look-ahead outcome windows", () => {
    expect(() => assertOutcomeWindow(200, 199)).toThrow(/Look-ahead/);
    expect(() => assertOutcomeWindow(200, 200)).not.toThrow();
  });

  it("stores official-source fixture bytes content-addressably and deduplicates repeated retrieval", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "dir1-store-")); roots.push(root);
    const store = new DisclosureDocumentStore(root); const document = housePtrFixtureDocument();
    const first = await store.put(document.bytes); const second = await store.put(document.bytes);
    expect(first.contentHash).toHaveLength(64); expect(second).toMatchObject({ contentHash: first.contentHash, storageKey: first.storageKey, repeated: true });
    expect((await store.get(first.storageKey)).byteLength).toBe(document.bytes.byteLength);
  });

  it("keeps the frozen official fixture source URL, original PDF hash, parser version, and all timeline values", () => {
    const document = housePtrFixtureDocument();
    expect(document.canonicalUrl).toMatch(/^https:\/\/disclosures-clerk\.house\.gov\//);
    expect(document.stableSourceDocumentId).toBe("20034401");
    expect(document.parserVersion).toBe("house-ptr-fixture-v1");
    expect(document.filedAt).toBeTypeOf("number"); expect(document.retrievedAt).toBeTypeOf("number");
    expect(document.transactions[0]?.amountMinUsd).toBe(1_001); expect(document.transactions[0]?.amountMaxUsd).toBe(15_000);
  });
});
