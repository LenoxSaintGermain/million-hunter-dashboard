/**
 * Frozen official-source fixture for deterministic WP-DIR1 tests.
 *
 * Source: Office of the Clerk, U.S. House of Representatives, PTR filing #20034401.
 * The `sourcePdfSha256` hashes the original 63,384-byte PDF retrieved on 2026-08-25.
 * `officialExtractText` is an exact text extraction of that source, retained separately
 * from the parser-normalized transaction below so tests never treat normalized fields as
 * the primary source record.
 */
export const HOUSE_PTR_20034401 = {
  source: "house_clerk" as const,
  stableSourceDocumentId: "20034401",
  canonicalUrl: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034401.pdf",
  sourcePdfSha256: "2c8d9db3d36249a7448add491cfd9604cacbc1f94c7ed3713759f5ebfb5ed575",
  sourcePdfByteSize: 63_384,
  sourceMediaType: "application/pdf",
  parserVersion: "house-ptr-fixture-v1",
  filer: {
    id: "house-member-robert-e-latta-oh05",
    name: "Hon. Robert E. Latta",
    chamber: "house" as const,
  },
  filedAt: Date.parse("2026-04-24T00:00:00.000Z"),
  retrievedAt: Date.parse("2026-08-25T20:11:41.000Z"),
  officialExtractText: `Filing ID #20034401
PERIODIC TRANSACTION REPORT
Clerk of the House of Representatives • Legislative Resource Center • B81 Cannon Building • Washington, DC 20515
Name: Hon. Robert E. Latta
Status: Member
State/District: OH05
ID: SP
Owner: SP (spouse)
Asset: Farmers & Merchants Bancorp, Inc. (FMAO) [ST]
Transaction Type: P
Transaction Date: 04/20/2026
Notification Date: 04/20/2026
Amount: $1,001 - $15,000
Filing Status: New
Description: dividend reinvestment
Comments: dividend reinvestment
Digitally Signed: Hon. Robert E. Latta, 04/24/2026`,
  parsedTransactions: [
    {
      sourceRowIdentity: "20034401:1",
      ownerAsStated: "spouse" as const,
      rawAssetName: "Farmers & Merchants Bancorp, Inc. (FMAO) [ST]",
      rawAssetDescription: "dividend reinvestment",
      transactionType: "purchase" as const,
      transactionDate: "2026-04-20",
      amountRange: { minUsd: 1_001, maxUsd: 15_000 },
      assetTypeAsStated: "ST",
      resolutionGrade: "none" as const,
      resolutionBasis: ["Fixture intentionally preserves unresolved raw asset text; no ticker mapping is inferred."],
    },
  ],
} as const;
