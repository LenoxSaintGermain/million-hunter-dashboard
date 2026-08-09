/**
 * National Register of Historic Places — the thesis universe as a dataset.
 *
 * The NPS publishes the whole Register as an open ArcGIS service: 72,668
 * properties, of which 63,127 are individually-listed buildings, plus 19,476
 * historic-district polygons. No key, no scraping, no model in the loop — every
 * field is a database value with an NRHP reference number behind it.
 *
 * Why this changes the sourcing model: a listing site tells you what is
 * advertised for sale. This is the complete, finite list of buildings that
 * QUALIFY for the thesis, whether or not anyone is selling. You start from the
 * universe and filter, rather than searching and hoping.
 *
 * Measured cadence (national, buildings): 525 new listings in 2019, 545 in 2020,
 * 615 in 2021, 478 in 2022, 397 in 2023 — roughly 1.4 a day nationally, about 14
 * a year in Ohio. The NPS spatial layer also lags current listings by a year or
 * two (2024-25 return zero). A quarterly refresh is ample; this is a near-static
 * reference set, not a feed.
 */

const BASE = "https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer";
const POINTS = `${BASE}/0/query`;
const POLYGONS = `${BASE}/1/query`;
export const NRHP_SOURCE_URL = "https://www.nps.gov/subjects/nationalregister/index.htm";

/** The dataset stores full state names and lowercase types — abbreviations match nothing. */
const STATE_NAMES: Record<string, string> = {
  AL: "ALABAMA", AK: "ALASKA", AZ: "ARIZONA", AR: "ARKANSAS", CA: "CALIFORNIA",
  CO: "COLORADO", CT: "CONNECTICUT", DE: "DELAWARE", FL: "FLORIDA", GA: "GEORGIA",
  HI: "HAWAII", ID: "IDAHO", IL: "ILLINOIS", IN: "INDIANA", IA: "IOWA",
  KS: "KANSAS", KY: "KENTUCKY", LA: "LOUISIANA", ME: "MAINE", MD: "MARYLAND",
  MA: "MASSACHUSETTS", MI: "MICHIGAN", MN: "MINNESOTA", MS: "MISSISSIPPI",
  MO: "MISSOURI", MT: "MONTANA", NE: "NEBRASKA", NV: "NEVADA", NH: "NEW HAMPSHIRE",
  NJ: "NEW JERSEY", NM: "NEW MEXICO", NY: "NEW YORK", NC: "NORTH CAROLINA",
  ND: "NORTH DAKOTA", OH: "OHIO", OK: "OKLAHOMA", OR: "OREGON", PA: "PENNSYLVANIA",
  RI: "RHODE ISLAND", SC: "SOUTH CAROLINA", SD: "SOUTH DAKOTA", TN: "TENNESSEE",
  TX: "TEXAS", UT: "UTAH", VT: "VERMONT", VA: "VIRGINIA", WA: "WASHINGTON",
  WV: "WEST VIRGINIA", WI: "WISCONSIN", WY: "WYOMING", DC: "DISTRICT OF COLUMBIA",
};

const ABBR_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([a, n]) => [n, a]),
);

export function stateName(abbr: string): string | null {
  return STATE_NAMES[String(abbr).toUpperCase().trim()] ?? null;
}

export interface NrhpRecord {
  refNumber: string;
  name: string;
  address: string | null;
  city: string | null;
  county: string | null;
  /** Two-letter abbreviation, converted back from the dataset's full name. */
  state: string | null;
  resType: string | null;
  /** MM/DD/YY exactly as published. */
  certDate: string | null;
  listedYear: number | null;
  contributingBuildings: number | null;
  isNationalHistoricLandmark: boolean;
  /** Link to the scanned nomination document, where NPS provides one. */
  documentUrl: string | null;
  lat?: number | null;
  lng?: number | null;
  /** False for intersections, restricted locations, and vague descriptions. */
  mailable: boolean;
}

/** "04/19/84" → 1984. Two-digit years roll at 30. */
function listedYearFrom(cert: string | null): number | null {
  const m = String(cert ?? "").match(/(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const yy = Number(m[3]);
  return yy > 30 ? 1900 + yy : 2000 + yy;
}

/**
 * A large minority of NRHP addresses are not addresses: intersections
 * ("S. High and E. Main Sts."), restricted archaeological locations, or
 * directions. Those cannot be matched to a parcel or mailed, so callers need to
 * know which is which rather than discovering it downstream.
 */
export function isMailableAddress(a: string | null | undefined): boolean {
  const s = String(a ?? "").trim();
  if (s.length < 5) return false;
  if (/address\s+restricted|restricted/i.test(s)) return false;
  if (/\b(and|&)\b[^,]*\bSts?\b\.?$/i.test(s)) return false;     // an intersection
  if (/^(junction|jct|vicinity|along|off|both sides|north of|south of|east of|west of)\b/i.test(s)) return false;
  return /^\d/.test(s);                                          // starts with a street number
}

function toRecord(attrs: any, geom?: any): NrhpRecord {
  const cert = attrs.CertDate ? String(attrs.CertDate) : null;
  const address = attrs.Address ? String(attrs.Address).trim() : null;
  return {
    refNumber: String(attrs.NRIS_Refnum ?? ""),
    name: String(attrs.RESNAME ?? "").trim(),
    address,
    city: attrs.City ? String(attrs.City).trim() : null,
    county: attrs.County ? String(attrs.County).trim() : null,
    state: attrs.State ? (ABBR_BY_NAME[String(attrs.State).toUpperCase()] ?? null) : null,
    resType: attrs.ResType ? String(attrs.ResType) : null,
    certDate: cert,
    listedYear: listedYearFrom(cert),
    contributingBuildings: attrs.NumCBldg == null ? null : Number(attrs.NumCBldg),
    isNationalHistoricLandmark: String(attrs.Is_NHL ?? "").toLowerCase() === "yes",
    documentUrl: attrs.NARA_URL ? String(attrs.NARA_URL) : null,
    lat: geom?.y ?? null,
    lng: geom?.x ?? null,
    mailable: isMailableAddress(address),
  };
}

const OUT_FIELDS = "NRIS_Refnum,RESNAME,Address,City,County,State,ResType,CertDate,NumCBldg,Is_NHL,NARA_URL";
const esc = (s: string) => s.replace(/'/g, "''");

async function arcgis(endpoint: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ f: "json", ...params });
  const res = await fetch(`${endpoint}?${qs}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`NPS ArcGIS ${res.status}`);
  const j: any = await res.json();
  if (j?.error) throw new Error(`NPS ArcGIS: ${j.error.message ?? "query failed"}`);
  return j;
}

export interface NrhpSearchOptions {
  /** Two-letter state abbreviations. */
  states?: string[];
  county?: string;
  city?: string;
  /** Defaults to "building" — individually-listed structures. */
  resType?: "building" | "district" | "site" | "structure" | "object";
  /** Keep only records with a street address a parcel could be matched to. */
  mailableOnly?: boolean;
  limit?: number;
}

function whereFor(opts: NrhpSearchOptions): string {
  const clauses: string[] = [];
  const names = (opts.states ?? []).map(stateName).filter(Boolean) as string[];
  if (names.length) clauses.push(`State IN (${names.map((n) => `'${esc(n)}'`).join(", ")})`);
  if (opts.county) clauses.push(`UPPER(County) = '${esc(opts.county.toUpperCase())}'`);
  if (opts.city) clauses.push(`UPPER(City) = '${esc(opts.city.toUpperCase())}'`);
  clauses.push(`ResType = '${esc(opts.resType ?? "building")}'`);
  return clauses.join(" AND ");
}

export async function searchNrhp(opts: NrhpSearchOptions): Promise<NrhpRecord[]> {
  const j = await arcgis(POINTS, {
    where: whereFor(opts) || "1=1",
    outFields: OUT_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(Math.min(opts.limit ?? 50, 500)),
  });
  const rows: NrhpRecord[] = (j.features ?? []).map((f: any) => toRecord(f.attributes, f.geometry));
  return opts.mailableOnly ? rows.filter((r) => r.mailable) : rows;
}

/** How many records match — cheap, and the honest way to show a universe's size. */
export async function countNrhp(opts: NrhpSearchOptions): Promise<number> {
  const j = await arcgis(POINTS, { where: whereFor(opts) || "1=1", returnCountOnly: "true" });
  return Number(j.count ?? 0);
}

/**
 * Which historic districts contain this point?
 *
 * A bigger prize than the individually-listed buildings: a CONTRIBUTING
 * STRUCTURE inside a listed district qualifies for the federal credit without
 * being listed in its own right, and one district can hold hundreds of them.
 */
export async function districtsContaining(lat: number, lng: number): Promise<NrhpRecord[]> {
  const j = await arcgis(POLYGONS, {
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: OUT_FIELDS,
    returnGeometry: "false",
  });
  return (j.features ?? []).map((f: any) => toRecord(f.attributes));
}

/**
 * Best NRHP match for a known address.
 *
 * NRHP address strings are inconsistently formatted ("161-167 N. High St.",
 * "55 Nationwide Blvd."), so match on the leading house number plus a distinctive
 * street word within the city rather than on the whole string.
 */
export async function matchAddress(address: string, city: string, state: string): Promise<NrhpRecord | null> {
  const sName = stateName(state);
  if (!sName) return null;

  const clauses = [`State = '${esc(sName)}'`, `UPPER(City) = '${esc(city.toUpperCase())}'`];
  const m = String(address).trim().match(/^(\d+)\s+(.*)$/);

  if (m) {
    const houseNum = m[1];
    // Drop a leading directional so "N. High St." keys on "High".
    const firstWord = m[2].replace(/^[NSEW]\.?\s+/i, "").split(/\s+/)[0].replace(/[^A-Za-z]/g, "");
    clauses.push(`Address LIKE '${esc(houseNum)}%'`);
    if (firstWord.length > 2) clauses.push(`UPPER(Address) LIKE '%${esc(firstWord.toUpperCase())}%'`);
  } else {
    clauses.push(`UPPER(Address) LIKE '%${esc(String(address).toUpperCase().slice(0, 12))}%'`);
  }

  const j = await arcgis(POINTS, {
    where: clauses.join(" AND "),
    outFields: OUT_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "3",
  });
  const rows: NrhpRecord[] = (j.features ?? []).map((f: any) => toRecord(f.attributes, f.geometry));
  return rows[0] ?? null;
}
