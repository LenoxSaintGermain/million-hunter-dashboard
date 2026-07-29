/**
 * The verification queue's field specs.
 *
 * Confidence is currently a scarlet letter: five of seven assets sit at 20% and
 * every tier is capped, which makes a decent pipeline read as junk. The five
 * critical fields aren't a penalty — they're the actual work. This file turns
 * each one into something researchable and writable, so verifying a field
 * visibly raises confidence and unlocks the real tier.
 *
 * Each spec says: what to ask the web, what shape the answer takes, and how to
 * write it back onto the asset.
 */

export interface FieldSpec {
  /** Must match the label produced by criticalFieldStatus() in the scorer. */
  key: string;
  short: string;
  /** Question handed to sonar-pro, with {name}/{address}/{city}/{state} filled in. */
  prompt: string;
  /** JSON shape the model must return. */
  schema: string;
  /** Turn the parsed answer into a DB patch. Returns null if unusable.
   *  `columns` are native commercial_assets columns; `meta` goes to the class's
   *  metadata blob (historic_inputs for historic, class_metadata otherwise). */
  apply: (parsed: any) => { columns?: Record<string, any>; meta?: Record<string, any> } | null;
  /** One-line human summary of what was found, for the accept UI. */
  summarize: (parsed: any) => string;
}

const ADDR = "{name} at {address}, {city}, {state}";

export const FIELD_SPECS: FieldSpec[] = [
  {
    key: "Year Built (pre-1945, 2-source)",
    short: "Year built",
    prompt: `In what year was ${ADDR} originally constructed? Cite at least two independent sources (county auditor/assessor, National Register nomination, historical society, newspaper archive). If sources disagree, report the earliest well-sourced year and say so.`,
    schema: `{"yearBuilt":number|null,"sourceCount":number,"confident":boolean,"note":"1-2 sentences naming the sources"}`,
    apply: (p) => {
      const y = Number(p?.yearBuilt);
      if (!Number.isFinite(y) || y < 1600 || y > new Date().getFullYear()) return null;
      // Two-source rule is the whole point of this field — one source is not verified.
      const verified = p?.confident === true && Number(p?.sourceCount ?? 0) >= 2;
      return { columns: { yearBuilt: y }, meta: { yearBuiltVerified: verified } };
    },
    summarize: (p) => `Built ${p?.yearBuilt ?? "?"} · ${p?.sourceCount ?? 0} source(s)`,
  },
  {
    key: "GSF & parcel boundaries",
    short: "GSF & parcel",
    prompt: `What is the gross building area (square feet) and the parcel/lot size (square feet) for ${ADDR}? Prefer the county auditor or assessor parcel record. Convert acres to square feet if needed.`,
    schema: `{"squareFootage":number|null,"lotSqFt":number|null,"parcelId":"string|null","note":"1-2 sentences naming the source"}`,
    apply: (p) => {
      const gsf = Number(p?.squareFootage), lot = Number(p?.lotSqFt);
      const columns: Record<string, any> = {};
      if (Number.isFinite(gsf) && gsf > 100) columns.squareFootage = Math.round(gsf);
      if (Number.isFinite(lot) && lot > 100) columns.lotSqFt = Math.round(lot);
      if (!Object.keys(columns).length) return null;
      return { columns, meta: p?.parcelId ? { parcelId: String(p.parcelId) } : {} };
    },
    summarize: (p) => `${p?.squareFootage ? Number(p.squareFootage).toLocaleString() + " GSF" : "GSF ?"} · ${p?.lotSqFt ? Number(p.lotSqFt).toLocaleString() + " SF lot" : "lot ?"}`,
  },
  {
    key: "Ownership entity & title",
    short: "Ownership & title",
    prompt: `Who currently owns ${ADDR}? Give the owner of record from the county auditor/recorder, the entity type, the most recent recorded transfer date and price if available, and whether the owner's mailing address is out of state.`,
    schema: `{"ownerName":"string|null","entityType":"string|null","lastTransferDate":"YYYY-MM-DD or null","lastTransferPrice":number|null,"outOfStateOwner":boolean|null,"confident":boolean,"note":"1-2 sentences naming the source"}`,
    apply: (p) => {
      if (!p?.ownerName || p?.confident !== true) return null;
      return {
        meta: {
          ownershipVerified: true,
          ownerName: String(p.ownerName).slice(0, 200),
          ownerEntityType: p.entityType ? String(p.entityType).slice(0, 80) : undefined,
          lastTransferDate: p.lastTransferDate ?? undefined,
          outOfStateOwner: p.outOfStateOwner ?? undefined,
        },
      };
    },
    summarize: (p) => `${p?.ownerName ?? "owner ?"}${p?.outOfStateOwner ? " · out-of-state" : ""}`,
  },
  {
    key: "NRHP / district status",
    short: "Register status",
    prompt: `Is ${ADDR} individually listed on the National Register of Historic Places, a contributing structure in a listed historic district, formally determined eligible, or none of these? Name the district if applicable and give the NRHP reference number if listed.`,
    schema: `{"status":"listed|contributing|eligible|not_eligible|unknown","districtName":"string|null","nrhpRefNumber":"string|null","note":"1-2 sentences naming the source"}`,
    apply: (p) => {
      const st = String(p?.status ?? "unknown");
      if (!["listed", "contributing", "eligible", "not_eligible"].includes(st)) return null;
      return {
        columns: {
          isHistoric: st === "listed" || st === "contributing",
          historicRegisterEligible: st === "eligible" || st === "listed" || st === "contributing",
        },
        meta: {
          registerStatus: st,
          districtName: p?.districtName ? String(p.districtName).slice(0, 160) : undefined,
          nrhpRefNumber: p?.nrhpRefNumber ? String(p.nrhpRefNumber).slice(0, 40) : undefined,
        },
      };
    },
    summarize: (p) => `${p?.status ?? "unknown"}${p?.districtName ? ` · ${p.districtName}` : ""}`,
  },
  {
    key: "Prior HTC syndication check",
    short: "Prior HTC check",
    prompt: `Has ${ADDR} previously used federal Historic Tax Credits — i.e. was there a prior certified rehabilitation (NPS Part 2/Part 3 approval) or a syndicated HTC transaction? A prior credit within the last 5 years disqualifies a new federal HTC claim. If you find no evidence of a prior credit, say so explicitly.`,
    schema: `{"priorCreditFound":boolean,"approxYear":number|null,"note":"1-2 sentences on what you searched and found"}`,
    apply: (p) => {
      if (typeof p?.priorCreditFound !== "boolean") return null;
      return {
        meta: {
          priorHtcChecked: true,
          priorHtcClaimed: p.priorCreditFound,
          priorHtcYear: p.approxYear ?? undefined,
        },
      };
    },
    summarize: (p) => (p?.priorCreditFound ? `Prior HTC found${p?.approxYear ? ` (~${p.approxYear})` : ""} — disqualifying` : "No prior HTC found"),
  },
];

/**
 * Self-storage critical fields. The generic scorer flags a class's `critical`
 * fields by LABEL, so these keys must match what genericScore.ts emits.
 */
export const STORAGE_FIELD_SPECS: FieldSpec[] = [
  {
    key: "Net Rentable Sq Ft",
    short: "Net rentable SF",
    prompt: `What is the net rentable square footage and unit count of the self-storage facility ${ADDR}? Use the listing, the operator's website, or a storage-industry directory.`,
    schema: `{"netRentableSqFt":number|null,"units":number|null,"note":"1-2 sentences naming the source"}`,
    apply: (p) => {
      const sf = Number(p?.netRentableSqFt), u = Number(p?.units);
      const meta: Record<string, any> = {};
      if (Number.isFinite(sf) && sf > 500) meta.netRentableSqFt = Math.round(sf);
      if (Number.isFinite(u) && u > 0) meta.units = Math.round(u);
      if (!Object.keys(meta).length) return null;
      return { meta };
    },
    summarize: (p) => `${p?.netRentableSqFt ? Number(p.netRentableSqFt).toLocaleString() + " NRSF" : "NRSF ?"}${p?.units ? ` · ${p.units} units` : ""}`,
  },
  {
    key: "Physical Occupancy %",
    short: "Occupancy",
    prompt: `What is the current physical occupancy of the self-storage facility ${ADDR}, and what does it charge per square foot per year? Use the listing or the operator's published rates.`,
    schema: `{"occupancyRate":number|null,"rentPerSqFt":number|null,"note":"1-2 sentences naming the source"}`,
    apply: (p) => {
      let occ = Number(p?.occupancyRate);
      if (Number.isFinite(occ) && occ > 1) occ = occ / 100; // tolerate "92"
      const rate = Number(p?.rentPerSqFt);
      const meta: Record<string, any> = {};
      if (Number.isFinite(occ) && occ > 0 && occ <= 1) meta.occupancyRate = occ;
      if (Number.isFinite(rate) && rate > 0) meta.rentPerSqFt = rate;
      if (!Object.keys(meta).length) return null;
      return { meta };
    },
    summarize: (p) => `${p?.occupancyRate != null ? Math.round((Number(p.occupancyRate) > 1 ? Number(p.occupancyRate) : Number(p.occupancyRate) * 100)) + "% occupied" : "occupancy ?"}${p?.rentPerSqFt ? ` · $${p.rentPerSqFt}/SF` : ""}`,
  },
  {
    key: "Asking Price",
    short: "Asking price",
    prompt: `What is the current asking price for the self-storage facility ${ADDR}? Report the price the listing states today, and whether it has been reduced.`,
    schema: `{"askingPrice":number|null,"reduced":boolean|null,"note":"1-2 sentences naming the source"}`,
    apply: (p) => {
      const v = Number(p?.askingPrice);
      if (!Number.isFinite(v) || v < 1000) return null;
      return { columns: { askingPrice: v } };
    },
    summarize: (p) => `$${Number(p?.askingPrice ?? 0).toLocaleString()}${p?.reduced ? " (reduced)" : ""}`,
  },
];

const ALL_SPECS = [...FIELD_SPECS, ...STORAGE_FIELD_SPECS];

export function getFieldSpec(key: string): FieldSpec | undefined {
  return ALL_SPECS.find((f) => f.key === key);
}

export function fillPrompt(spec: FieldSpec, asset: Record<string, any>): string {
  return spec.prompt
    .replace("{name}", String(asset.name ?? ""))
    .replace("{address}", String(asset.address ?? ""))
    .replace("{city}", String(asset.city ?? ""))
    .replace("{state}", String(asset.state ?? ""));
}
