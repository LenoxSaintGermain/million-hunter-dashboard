import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DisclosureTransactionInput } from "../../shared/disclosure";
import { HOUSE_PTR_20034401 } from "./fixtures/housePtr20034401";

export type DisclosureDocument = {
  source: "house_clerk";
  stableSourceDocumentId: string;
  canonicalUrl: string;
  filer: { id: string; name: string; chamber: "house" };
  filedAt: number | null;
  retrievedAt: number;
  mediaType: string;
  parserVersion: string;
  bytes: Uint8Array;
  transactions: DisclosureTransactionInput[];
};

export type StoredDocument = { contentHash: string; storageKey: string; byteSize: number; repeated: boolean };

/** Content-addressed raw-document store. DB rows retain only this immutable reference. */
export class DisclosureDocumentStore {
  constructor(private root = process.env.DISCLOSURE_DOCUMENT_ROOT ?? "/tmp/million-hunter-disclosures") {}

  async put(bytes: Uint8Array): Promise<StoredDocument> {
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const storageKey = path.join(contentHash.slice(0, 2), contentHash);
    const destination = path.join(this.root, storageKey);
    try {
      await readFile(destination);
      return { contentHash, storageKey, byteSize: bytes.byteLength, repeated: true };
    } catch { /* first storage below */ }
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, bytes, { flag: "wx" });
    try { await rename(temporary, destination); } catch { /* another immutable writer won */ }
    return { contentHash, storageKey, byteSize: bytes.byteLength, repeated: false };
  }

  async get(storageKey: string) { return readFile(path.join(this.root, storageKey)); }
}

/** Official-source replay fixture. It contains no market or broker call. */
export function housePtrFixtureDocument(retrievedAt = HOUSE_PTR_20034401.retrievedAt): DisclosureDocument {
  const fixture = HOUSE_PTR_20034401;
  return {
    source: fixture.source,
    stableSourceDocumentId: fixture.stableSourceDocumentId,
    canonicalUrl: fixture.canonicalUrl,
    filer: fixture.filer,
    filedAt: fixture.filedAt,
    retrievedAt,
    mediaType: "text/plain",
    parserVersion: fixture.parserVersion,
    bytes: new TextEncoder().encode(fixture.officialExtractText),
    transactions: fixture.parsedTransactions.map((row) => ({
      sourceRowIdentity: row.sourceRowIdentity,
      ownerAsStated: row.ownerAsStated,
      rawAssetName: row.rawAssetName,
      transactionType: row.transactionType,
      transactionDate: Date.parse(`${row.transactionDate}T00:00:00.000Z`),
      amountMinUsd: row.amountRange.minUsd,
      amountMaxUsd: row.amountRange.maxUsd,
      assetType: null,
      resolutionGrade: row.resolutionGrade,
      publicationAt: fixture.filedAt,
      firstObservedAt: retrievedAt,
    })),
  };
}
