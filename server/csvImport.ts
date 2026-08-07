/**
 * CSV ingest for broker exports (CoStar, Crexi, LoopNet, a broker's spreadsheet).
 *
 * CoStar API access has cost and business-type hurdles, so the working path is
 * to export and paste. Every platform names its columns differently, so headers
 * are matched by a set of aliases rather than an exact schema — and whatever
 * couldn't be matched is reported back so the operator knows what was ignored
 * instead of silently losing a column.
 *
 * Nothing is invented. A field absent from the CSV stays null and the scorer
 * flags it, exactly as it does for a sonar-sourced asset.
 */
import { getAssetClass } from "../shared/assetClasses";

export interface ParsedAssetRow {
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  propertyType?: string;
  squareFootage?: number;
  lotSqFt?: number;
  askingPrice?: number;
  capRate?: number;
  noi?: number;
  yearBuilt?: number;
  stories?: number;
  occupancyRate?: number;
  sourceUrl?: string;
  isHistoric?: boolean;
  opportunityZone?: boolean;
  classMetadata?: Record<string, unknown>;
}

/** Header aliases, lower-cased and stripped of punctuation. */
const ALIASES: Record<keyof ParsedAssetRow | string, string[]> = {
  name: ["name", "propertyname", "buildingname", "title", "listingname", "property"],
  address: ["address", "streetaddress", "propertyaddress", "street", "addressline1"],
  city: ["city", "municipality", "town"],
  state: ["state", "stateprovince", "st"],
  zip: ["zip", "zipcode", "postalcode"],
  propertyType: ["propertytype", "type", "buildingtype", "assettype", "usetype"],
  squareFootage: ["squarefootage", "sf", "buildingsf", "rba", "grosssf", "gsf", "buildingsize", "totalsf", "sqft", "squarefeet"],
  lotSqFt: ["lotsqft", "landsf", "lotsize", "landarea", "parcelsf", "lotsf"],
  askingPrice: ["askingprice", "price", "listprice", "saleprice", "askingsaleprice", "listingprice"],
  capRate: ["caprate", "cap", "capitalizationrate"],
  noi: ["noi", "netoperatingincome"],
  yearBuilt: ["yearbuilt", "built", "yearconstructed", "constructionyear"],
  stories: ["stories", "floors", "numberoffloors", "numstories"],
  occupancyRate: ["occupancy", "occupancyrate", "percentleased", "leased"],
  sourceUrl: ["url", "link", "listingurl", "sourceurl", "weburl"],
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Split a CSV line, honouring quoted fields containing commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** "$2,750,000" → 2750000 · "6.5%" → 0.065 for rate-ish fields. */
function toNumber(raw: string, asRate = false): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[$,\s]/g, "").replace(/[^0-9.\-%]/g, "");
  const hasPct = cleaned.includes("%");
  const n = parseFloat(cleaned.replace("%", ""));
  if (!Number.isFinite(n)) return undefined;
  if (asRate) {
    // A cap rate of "6.5" means 6.5%, not 650%.
    if (hasPct || n > 1) return n / 100;
    return n;
  }
  return n;
}

export function parseAssetCsv(csv: string, assetClass: string): {
  rows: ParsedAssetRow[];
  errors: string[];
  headerMap: { column: string; mappedTo: string | null }[];
} {
  const cls = getAssetClass(assetClass);
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ["CSV needs a header row and at least one data row"], headerMap: [] };

  const headers = splitCsvLine(lines[0]);
  const classFieldKeys = new Set(cls.fields.map((f) => norm(f.key)));

  // Map each column to a known field, a class-specific field, or nothing.
  const headerMap = headers.map((h) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(n)) return { column: h, mappedTo: field };
    }
    if (classFieldKeys.has(n)) {
      const match = cls.fields.find((f) => norm(f.key) === n);
      return { column: h, mappedTo: match ? `class:${match.key}` : null };
    }
    return { column: h, mappedTo: null };
  });

  const rows: ParsedAssetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => !c)) continue;

    const row: any = { classMetadata: {} };
    headerMap.forEach((m, idx) => {
      if (!m.mappedTo) return;
      const raw = cells[idx] ?? "";
      if (!raw) return;

      if (m.mappedTo.startsWith("class:")) {
        const key = m.mappedTo.slice("class:".length);
        const fd = cls.fields.find((f) => f.key === key);
        if (!fd) return;
        if (fd.type === "boolean") row.classMetadata[key] = /^(y|yes|true|1)$/i.test(raw);
        else if (fd.type === "percent") row.classMetadata[key] = toNumber(raw, true);
        else if (fd.type === "number" || fd.type === "currency" || fd.type === "year") row.classMetadata[key] = toNumber(raw);
        else row.classMetadata[key] = raw;
        return;
      }

      switch (m.mappedTo) {
        case "capRate":
        case "occupancyRate": row[m.mappedTo] = toNumber(raw, true); break;
        case "squareFootage":
        case "lotSqFt":
        case "askingPrice":
        case "noi":
        case "yearBuilt":
        case "stories": row[m.mappedTo] = toNumber(raw); break;
        case "state": row.state = raw.toUpperCase().slice(0, 2); break;
        default: row[m.mappedTo] = raw;
      }
    });

    if (!row.name) { errors.push(`Row ${i + 1}: no property name — skipped`); continue; }
    if (!row.city || !row.state) { errors.push(`Row ${i + 1}: "${row.name}" has no city/state — skipped`); continue; }
    // The DB requires an address; say so plainly rather than fabricating one.
    if (!row.address) row.address = "Address not provided in export";
    if (!Object.keys(row.classMetadata).length) delete row.classMetadata;

    rows.push(row as ParsedAssetRow);
  }

  const unmapped = headerMap.filter((m) => !m.mappedTo).map((m) => m.column);
  if (unmapped.length) errors.push(`Ignored ${unmapped.length} unrecognised column(s): ${unmapped.slice(0, 8).join(", ")}`);

  return { rows, errors, headerMap };
}
