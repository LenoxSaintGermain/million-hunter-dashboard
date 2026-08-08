/**
 * Off-market sourcing from public records.
 *
 * One search per record type per market, for the same reason the listing
 * sourcing is one-per-market: a single combined search anchors on whichever
 * source it hits first and returns everything from there.
 *
 * The honesty contract is stricter here than anywhere else in the system.
 * These are buildings nobody has listed, described by records that are often
 * partial or stale, and the temptation for a model to fill gaps is high. So:
 * every record type asks for a named source document, anything unstated stays
 * null, and a candidate without a real address is discarded rather than stored.
 */
import type { OffMarketSignals, PublicRecordSource } from "../shared/offMarket";
import { computeMotivation } from "../shared/offMarket";

export interface OffMarketCandidate {
  name: string;
  address: string;
  city: string;
  state: string;
  yearBuilt?: number | null;
  squareFootage?: number | null;
  ownerName?: string | null;
  signals: OffMarketSignals;
  motivationScore: number;
}

interface RecordProbe {
  source: PublicRecordSource;
  /** What to ask, with {city} / {state} filled in. */
  prompt: string;
  schema: string;
}

/**
 * Each probe targets a record set that is genuinely published. Land banks are
 * first because they are the highest-yield: they exist to dispose of property
 * and publish inventory, yet almost nothing indexes them as "for sale".
 */
const PROBES: RecordProbe[] = [
  {
    source: "land_bank",
    prompt: `List specific commercial or mixed-use buildings currently held in the land bank inventory for {city}, {state} (county land bank, land reutilization corporation, or municipal land bank). Give the property address and, if published, the year built and building size. Only include properties the land bank actually lists.`,
    schema: `[{"name":string,"address":string,"yearBuilt":number|null,"squareFootage":number|null,"ownerName":string|null,"note":"what the land bank record says","sourceUrl":string}]`,
  },
  {
    source: "delinquent_tax",
    prompt: `From the published delinquent property tax list for {city}, {state} (county treasurer or auditor delinquent tax roll / tax lien sale list), identify specific COMMERCIAL or MIXED-USE buildings that are tax delinquent. Give the address, how many years delinquent, and the delinquent amount if published.`,
    schema: `[{"name":string,"address":string,"taxDelinquentYears":number|null,"taxDelinquentAmount":number|null,"ownerName":string|null,"note":"what the tax record says","sourceUrl":string}]`,
  },
  {
    source: "vacant_registry",
    prompt: `From the vacant / abandoned building registry or vacant property list published by {city}, {state}, identify specific COMMERCIAL or MIXED-USE buildings currently registered as vacant. Give the address and how long it has been registered vacant if stated.`,
    schema: `[{"name":string,"address":string,"yearBuilt":number|null,"ownerName":string|null,"note":"what the registry says","sourceUrl":string}]`,
  },
  {
    source: "code_enforcement",
    prompt: `From {city}, {state} code enforcement, condemnation, or demolition-list records, identify specific COMMERCIAL or MIXED-USE buildings with open violations or on a demolition/condemned list. Give the address and the number or nature of open violations.`,
    schema: `[{"name":string,"address":string,"openCodeViolations":number|null,"condemnedOrDemolitionList":boolean|null,"ownerName":string|null,"note":"what the enforcement record says","sourceUrl":string}]`,
  },
  {
    source: "preservation_watch",
    prompt: `Identify specific historically significant COMMERCIAL buildings in {city}, {state} that are on the National Register of Historic Places or in a listed historic district AND are currently vacant, underused, endangered, or on a preservation watch/most-endangered list. Give the address and the year built. These should be buildings NOT currently for sale.`,
    schema: `[{"name":string,"address":string,"yearBuilt":number|null,"ownerName":string|null,"endangeredList":boolean|null,"vacantOrUnderused":boolean|null,"note":"why it is endangered or underused, and the source","sourceUrl":string}]`,
  },
];

const SYSTEM = `You research PUBLIC PROPERTY RECORDS. You report only what a named, real public record actually states.

Hard rules:
- Never invent a property, address, owner, or figure. If you cannot find real records, return [].
- Every property must have a REAL street address from the record. If you only have a building name and no address, omit it.
- Any field the record does not state must be null. Do not estimate.
- Prefer county auditor/treasurer, city code enforcement, land bank, and preservation-organisation sources.

Output ONLY a valid JSON array. Start with [ and end with ].`;

function parseArray(raw: any): any[] {
  const content: string = raw?.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  const tryParse = (t: string) => { try { return JSON.parse(t); } catch { return null; } };
  let parsed = tryParse(cleaned);
  if (!parsed) {
    const a = cleaned.indexOf("["), b = cleaned.lastIndexOf("]");
    if (a >= 0 && b > a) parsed = tryParse(cleaned.slice(a, b + 1));
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const arr = Object.values(parsed).find((v) => Array.isArray(v));
    if (Array.isArray(arr)) return arr as any[];
  }
  return [];
}

const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * Records often give the full "123 Main St, City, ST" string. We store city and
 * state separately, so leaving it whole renders as "…, Birmingham, AL, Birmingham, AL".
 */
function trimAddress(raw: string, city: string, state: string): string {
  let a = String(raw).trim().replace(/\s+/g, " ");
  const tail = new RegExp(`,?\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,?\\s*${state}\\s*\\d{0,5}$`, "i");
  a = a.replace(tail, "").trim();
  return a.replace(/[,\s]+$/, "");
}

/** An address that is actually an address, not a city or a shrug. */
function hasRealAddress(a: unknown): boolean {
  const s = String(a ?? "").trim();
  if (s.length < 6) return false;
  if (/^(unknown|n\/?a|not (stated|provided|disclosed)|various|multiple)$/i.test(s)) return false;
  return /\d/.test(s);   // a street address contains a number
}

export interface OffMarketRunResult {
  candidates: OffMarketCandidate[];
  perSource: Record<string, number>;
  discarded: number;
  citations: string[];
}

export async function sourceOffMarket(opts: {
  city: string;
  state: string;
  sources?: PublicRecordSource[];
  perProbe?: number;
}): Promise<OffMarketRunResult> {
  const key = process.env.SONAR_API_KEY;
  if (!key) throw new Error("SONAR_API_KEY not configured — public-record sourcing unavailable");

  const probes = opts.sources?.length
    ? PROBES.filter((p) => opts.sources!.includes(p.source))
    : PROBES;
  const perProbe = opts.perProbe ?? 4;

  const call = async (p: RecordProbe) => {
    const user = `${p.prompt.replace(/\{city\}/g, opts.city).replace(/\{state\}/g, opts.state)}

Return up to ${perProbe} properties.
Return ONLY: ${p.schema}`;
    const res = await fetch("https://api.perplexity.ai/v1/sonar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Sonar ${res.status}`);
    const raw = await res.json();
    return { source: p.source, rows: parseArray(raw), citations: Array.isArray(raw?.citations) ? raw.citations : [] };
  };

  const settled = await Promise.allSettled(probes.map(call));

  // Merge by address — the same building often appears in several record sets,
  // and that overlap is itself the strongest motivation signal.
  const byAddress = new Map<string, OffMarketCandidate>();
  const perSource: Record<string, number> = {};
  const citations: string[] = [];
  let discarded = 0;

  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    const { source, rows, citations: cits } = r.value;
    citations.push(...cits);
    let kept = 0;

    for (const row of rows) {
      if (!row?.name || !hasRealAddress(row.address)) { discarded++; continue; }
      const addrKey = `${String(row.address).toLowerCase().replace(/[^a-z0-9]/g, "")}`;

      const incoming: OffMarketSignals = {
        sources: [source],
        taxDelinquentYears: num(row.taxDelinquentYears),
        taxDelinquentAmount: num(row.taxDelinquentAmount),
        onVacantRegistry: source === "vacant_registry" ? true : null,
        onPreservationWatchList: source === "preservation_watch" ? (row.endangeredList ?? true) : null,
        reportedVacantOrUnderused: row.vacantOrUnderused ?? null,
        landBankOwned: source === "land_bank" ? true : null,
        openCodeViolations: num(row.openCodeViolations),
        condemnedOrDemolitionList: row.condemnedOrDemolitionList ?? null,
        notes: row.note ? String(row.note).slice(0, 600) : null,
        citations: row.sourceUrl ? [String(row.sourceUrl)] : [],
      };

      const existing = byAddress.get(addrKey);
      if (existing) {
        // Same building, another record set — union the signals.
        const s = existing.signals;
        s.sources = Array.from(new Set([...(s.sources ?? []), source]));
        s.taxDelinquentYears ??= incoming.taxDelinquentYears;
        s.taxDelinquentAmount ??= incoming.taxDelinquentAmount;
        s.onVacantRegistry ||= incoming.onVacantRegistry;
        s.landBankOwned ||= incoming.landBankOwned;
        s.openCodeViolations ??= incoming.openCodeViolations;
        s.condemnedOrDemolitionList ||= incoming.condemnedOrDemolitionList;
        s.onPreservationWatchList ||= incoming.onPreservationWatchList;
        s.reportedVacantOrUnderused ||= incoming.reportedVacantOrUnderused;
        s.notes = [s.notes, incoming.notes].filter(Boolean).join(" · ").slice(0, 1200);
        s.citations = Array.from(new Set([...(s.citations ?? []), ...(incoming.citations ?? [])]));
        existing.motivationScore = computeMotivation(s).score;
      } else {
        byAddress.set(addrKey, {
          name: String(row.name).slice(0, 200),
          address: trimAddress(String(row.address), opts.city, opts.state).slice(0, 200),
          city: opts.city,
          state: opts.state.toUpperCase().slice(0, 2),
          yearBuilt: num(row.yearBuilt),
          squareFootage: num(row.squareFootage),
          ownerName: row.ownerName ? String(row.ownerName).slice(0, 200) : null,
          signals: incoming,
          motivationScore: computeMotivation(incoming).score,
        });
      }
      kept++;
    }
    perSource[source] = kept;
  }

  const candidates = Array.from(byAddress.values()).sort((a, b) => b.motivationScore - a.motivationScore);
  return { candidates, perSource, discarded, citations: Array.from(new Set(citations)).slice(0, 12) };
}
