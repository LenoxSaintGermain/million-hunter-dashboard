import type { DealEvidenceSnapshot } from "./dealEvidence";

export type EvidenceVersionChange = {
  cik: string;
  kind: "added" | "removed" | "changed" | "recaptured" | "unchanged";
  previousReceiptIds: string[];
  nextReceiptIds: string[];
};

/** Compares recorded inputs only. A changed hash says nothing about materiality
 * or whether a finding is true. Never fetches or upgrades a saved snapshot. */
export function compareEvidenceSnapshots(previous: DealEvidenceSnapshot, next: DealEvidenceSnapshot) {
  if (previous.deal.id !== next.deal.id) throw new Error("Cannot compare evidence across different deals.");
  const dealFields = (Object.keys(previous.deal) as Array<keyof DealEvidenceSnapshot["deal"]>)
    .filter(key => previous.deal[key] !== next.deal[key]);
  const ciks = Array.from(new Set([...previous.evidence, ...next.evidence].map(item => item.cik))).sort();
  const versions: EvidenceVersionChange[] = ciks.map(cik => {
    const before = previous.evidence.filter(item => item.cik === cik);
    const after = next.evidence.filter(item => item.cik === cik);
    const ids = (items: typeof before) => Array.from(new Set(items.map(item => item.receiptId))).sort();
    const hashes = (items: typeof before) => Array.from(new Set(items.map(item => item.payloadHash))).sort();
    const previousReceiptIds = ids(before), nextReceiptIds = ids(after);
    const equal = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);
    const kind = !before.length ? "added" : !after.length ? "removed"
      : !equal(hashes(before), hashes(after)) ? "changed"
      : !equal(previousReceiptIds, nextReceiptIds) ? "recaptured" : "unchanged";
    return { cik, kind, previousReceiptIds, nextReceiptIds };
  });
  return { dealFields, versions,
    changedSources: versions.filter(item => item.kind !== "unchanged").length,
    limitation: "Input-version comparison only; not a material-risk assessment." };
}
