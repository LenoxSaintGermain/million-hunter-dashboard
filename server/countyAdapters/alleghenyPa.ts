/**
 * Allegheny County, PA (Pittsburgh) — via the Western PA Regional Data Center.
 *
 * WPRDC runs a CKAN instance with a SQL endpoint over the county's own tables:
 *   584,999 parcel assessments (owner, use, sale history, fair-market value)
 *    88,273 tax liens keyed by parcel ID
 *
 * Joining those two answers the question that defeated web search entirely:
 * "which commercial buildings here are carrying serious tax debt?" Every value
 * returned is a database field with a parcel ID, so there is no room for a
 * model to fill a gap.
 */
import type { CountyAdapter, CountyParcel, DiscoverOptions } from "./types";

const SQL_ENDPOINT = "https://data.wprdc.org/api/3/action/datastore_search_sql";
const ASSESSMENTS = "65855e14-549e-4992-b5be-d629afc676fa";
const LIENS = "d1e80180-5b2e-4dab-8ec3-be621628649e";
const DATASET_URL = "https://data.wprdc.org/dataset/allegheny-county-property-assessments";

/**
 * Use codes that aren't a building you could buy and reuse: raw land, air
 * rights, and parcels the county records with no street number.
 */
const EXCLUDED_USE = [
  "VACANT COMMERCIAL LAND", "AIR RIGHTS", "COMM AUX BUILDING",
  "PARKING LOT", "VACANT LAND", "COMMON AREA",
];

async function runSql(sql: string): Promise<any[]> {
  const url = `${SQL_ENDPOINT}?sql=${encodeURIComponent(sql)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`WPRDC ${res.status}`);
  const j: any = await res.json();
  if (!j?.success) throw new Error(`WPRDC query failed: ${JSON.stringify(j?.error ?? {}).slice(0, 200)}`);
  return j.result?.records ?? [];
}

const num = (v: any): number | null => {
  if (v == null || v === "" || v === "None") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** "09-30-2021" → 2021 */
function yearOf(d: any): number | null {
  const m = String(d ?? "").match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function toParcel(r: any): CountyParcel | null {
  const houseNum = String(r.PROPERTYHOUSENUM ?? "").trim();
  const street = String(r.PROPERTYADDRESS ?? "").trim();
  // A parcel recorded at house number 0 has no usable street address.
  if (!street || !houseNum || houseNum === "0") return null;

  const lien = num(r.total_amount);
  const saleYear = yearOf(r.SALEDATE);
  const nowYear = new Date().getUTCFullYear();

  const signals: any = {
    sources: lien ? ["delinquent_tax"] : [],
    taxDelinquentAmount: lien,
    // The lien table gives an amount, not a count of years — inferring years
    // from a dollar figure would be a guess, so it stays null.
    taxDelinquentYears: null,
    assessedValue: num(r.FAIRMARKETTOTAL),
    ownerIsEstateOrTrust: /ESTATE|TRUST/i.test(String(r.OWNERDESC ?? "")) || null,
    yearsSinceLastSale: saleYear ? nowYear - saleYear : null,
    notes: [
      r.USEDESC ? `County use code: ${r.USEDESC}` : null,
      lien ? `Outstanding tax lien of $${Math.round(lien).toLocaleString()} against parcel ${r.PARID}` : null,
      saleYear ? `Last recorded sale ${r.SALEDATE}${num(r.SALEPRICE) ? ` for $${Math.round(num(r.SALEPRICE)!).toLocaleString()}` : ""}` : null,
      num(r.FAIRMARKETTOTAL) ? `County fair-market value $${Math.round(num(r.FAIRMARKETTOTAL)!).toLocaleString()}` : null,
    ].filter(Boolean).join(" · ") || null,
    citations: [DATASET_URL],
  };

  return {
    parcelId: String(r.PARID ?? ""),
    address: `${houseNum} ${street}`.replace(/\s+/g, " ").trim(),
    city: String(r.PROPERTYCITY ?? "").trim(),
    state: "PA",
    ownerName: r.OWNERDESC ? String(r.OWNERDESC) : null,
    useDescription: r.USEDESC ? String(r.USEDESC) : null,
    lotSqFt: num(r.LOTAREA),
    assessedValue: num(r.FAIRMARKETTOTAL),
    lastSaleDate: r.SALEDATE ? String(r.SALEDATE) : null,
    lastSalePrice: num(r.SALEPRICE),
    yearBuilt: null,   // not present in this table
    signals,
    sourceUrl: DATASET_URL,
  };
}

const esc = (s: string) => s.replace(/'/g, "''");

export const alleghenyPa: CountyAdapter = {
  id: "allegheny-pa",
  label: "Allegheny County, PA (Pittsburgh)",
  coverageNote:
    "Live county data: 585k parcel assessments joined to 88k tax liens. Gives owner, use code, sale history, assessed value and outstanding lien amount. Does not include year built or code violations.",

  covers(city, state) {
    if (String(state).toUpperCase() !== "PA") return false;
    // The dataset is Allegheny County only. Pennsylvania has 67 counties, so
    // rule out the obvious out-of-county metros rather than claiming the state.
    const elsewhere = ["PHILADELPHIA", "HARRISBURG", "ERIE", "ALLENTOWN", "SCRANTON", "READING", "BETHLEHEM", "LANCASTER", "ALTOONA", "YORK"];
    return !elsewhere.includes(String(city).toUpperCase().trim());
  },

  async discoverDistressed(opts: DiscoverOptions): Promise<CountyParcel[]> {
    const minLien = opts.minLien ?? 15000;
    const limit = Math.min(opts.limit ?? 20, 60);
    const cityFilter = opts.city ? ` AND UPPER(a."PROPERTYCITY") = '${esc(opts.city.toUpperCase())}'` : "";
    const excluded = EXCLUDED_USE.map((u) => `'${esc(u)}'`).join(", ");

    const sql = `SELECT a."PARID", a."PROPERTYHOUSENUM", a."PROPERTYADDRESS", a."PROPERTYCITY",
        a."USEDESC", a."OWNERDESC", a."SALEDATE", a."SALEPRICE", a."FAIRMARKETTOTAL", a."LOTAREA",
        l.total_amount
      FROM "${ASSESSMENTS}" a
      JOIN "${LIENS}" l ON a."PARID" = l.pin
      WHERE a."CLASSDESC" = 'COMMERCIAL'
        AND l.total_amount >= ${minLien}
        AND a."USEDESC" NOT IN (${excluded})
        AND a."PROPERTYHOUSENUM" <> '0'
        ${cityFilter}
      ORDER BY l.total_amount DESC
      LIMIT ${limit}`;

    const rows = await runSql(sql);
    return rows.map(toParcel).filter((p): p is CountyParcel => p !== null);
  },

  async lookupByAddress(address, city, state): Promise<CountyParcel | null> {
    if (!this.covers(city, state)) return null;
    // Match on the street name and house number separately — the county stores
    // them in two columns, and a whole-string match almost never hits.
    const m = String(address).trim().match(/^(\d+)\s+(.*)$/);
    if (!m) return null;
    const houseNum = m[1];
    const street = m[2].toUpperCase().replace(/[.,]/g, "").trim();

    const sql = `SELECT a."PARID", a."PROPERTYHOUSENUM", a."PROPERTYADDRESS", a."PROPERTYCITY",
        a."USEDESC", a."OWNERDESC", a."SALEDATE", a."SALEPRICE", a."FAIRMARKETTOTAL", a."LOTAREA",
        l.total_amount
      FROM "${ASSESSMENTS}" a
      LEFT JOIN "${LIENS}" l ON a."PARID" = l.pin
      WHERE a."PROPERTYHOUSENUM" = '${esc(houseNum)}'
        AND UPPER(a."PROPERTYADDRESS") LIKE '${esc(street.split(" ")[0])}%'
        AND UPPER(a."PROPERTYCITY") = '${esc(city.toUpperCase())}'
      LIMIT 5`;

    const rows = await runSql(sql);
    for (const r of rows) {
      const p = toParcel(r);
      if (p) return p;
    }
    return null;
  },
};
