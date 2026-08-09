/**
 * Property-use classification.
 *
 * The National Register carries no use code — a nomination records significance,
 * not what the building is for. So a Register pull returns churches, schools,
 * theatres, houses, monuments and bridges side by side, and a pipeline sorted by
 * score puts "Welsh Presbyterian Church" above a warehouse.
 *
 * The important call: for an ADAPTIVE REUSE thesis, churches and schools are not
 * the problem — they are among the best targets. A deconsecrated church becomes
 * apartments; a closed school becomes lofts. What doesn't belong is a
 * single-family house, a cemetery, a monument, or a bridge.
 *
 * Classification is deterministic keyword matching, not a model. It is a
 * heuristic over building names, so it reports its own confidence and the term
 * it matched, and callers can show the user why something was categorised.
 * Where a county adapter supplies a real use code, that should win.
 */

export type PropertyUseCategory =
  | "commercial"      // store, shop, bank, office, hotel, market
  | "industrial"      // warehouse, mill, factory, foundry
  | "institutional"   // school, church, lodge, library, courthouse, hospital
  | "entertainment"   // theatre, opera house, cinema, club
  | "residential"     // house, rowhouse, apartment building
  | "civic_monument"  // monument, memorial, statue, fountain
  | "funerary"        // cemetery, mausoleum
  | "infrastructure"  // bridge, dam, lighthouse, tower
  | "agricultural"    // farm, barn, grange
  | "unknown";

export const USE_CATEGORY_LABELS: Record<PropertyUseCategory, string> = {
  commercial: "Commercial",
  industrial: "Industrial",
  institutional: "Institutional",
  entertainment: "Entertainment",
  residential: "Residential",
  civic_monument: "Monument",
  funerary: "Funerary",
  infrastructure: "Infrastructure",
  agricultural: "Agricultural",
  unknown: "Unclassified",
};

/**
 * Words that mean "this is a building you could occupy". Plenty of buildings are
 * named after someone — "Orton Memorial Laboratory", "X Memorial Hospital" — so a
 * commemorative word alone must not classify a building as a monument.
 */
const BUILDING_NOUN = /\b(laborator(y|ies)|hospital|librar(y|ies)|hall|building|center|centre|auditorium|gymnasium|stadium|union|school|college|university|church|chapel|theat(re|er)|house|home|institute|academy|arena|clinic|dormitory|residence)\b/i;

/**
 * Ordered most-specific first — "Opera House" must not be caught by the "House"
 * rule, and "Schoolhouse" is a school, not a dwelling.
 */
const RULES: { category: PropertyUseCategory; confidence: number; terms: RegExp; unless?: RegExp }[] = [
  // Entertainment before institutional/residential: "Opera House", "Playhouse".
  { category: "entertainment", confidence: 0.9, terms: /\b(theat(re|er)|opera\s*house|playhouse|cinema|auditorium|ballroom|amphitheat)/i },

  { category: "funerary", confidence: 0.95, terms: /\b(cemetery|graveyard|mausoleum|burial|tomb|crypt|columbarium)\b/i, unless: BUILDING_NOUN },
  { category: "civic_monument", confidence: 0.9, terms: /\b(monument|memorial|obelisk|statue|fountain|cenotaph)\b/i, unless: BUILDING_NOUN },
  { category: "infrastructure", confidence: 0.9, terms: /\b(bridge|viaduct|aqueduct|dam|lighthouse|water\s*tower|silo|trestle|culvert|lock\s*(no|#)?\s*\d)/i, unless: BUILDING_NOUN },

  { category: "industrial", confidence: 0.85, terms: /\b(warehouse|factory|foundry|mill|works|brewery|distillery|tannery|grain\s*elevator|manufactur|packing\s*(house|plant)|machine\s*(shop|company)|laborator(y|ies)|power\s*(house|plant)|freight|roundhouse)\b/i },

  { category: "institutional", confidence: 0.85, terms: /\b(school|schoolhouse|academy|college|university|seminary|institute|librar(y|ies)|courthouse|city\s*hall|town\s*hall|post\s*office|hospital|asylum|sanitarium|orphanage|armory|firehouse|fire\s*station|police|jail|church|chapel|cathedral|synagogue|temple|meeting\s*house|parish|mission|convent|monastery|rectory|lodge|masonic|odd\s*fellows|grange\s*hall|y\.?m\.?c\.?a|y\.?w\.?c\.?a|club\s*house)\b/i },

  { category: "commercial", confidence: 0.85, terms: /\b(bank|hotel|inn|store|shop|market|arcade|department|mercantile|commercial|office|exchange|emporium|garage|service\s*station|filling\s*station|dealership|restaurant|tavern|saloon|pharmacy|drug\s*(store|co))\b/i },

  { category: "agricultural", confidence: 0.8, terms: /\b(farm|farmstead|barn|granary|creamery|dairy|stock\s*yard|orchard)\b/i },

  // Residential last — "House" is the weakest and most over-matched term, and by
  // this point the specific uses above have already claimed their names.
  { category: "residential", confidence: 0.7, terms: /\b(house|residence|home|mansion|cottage|rowhouse|row\s*house|apartment|tenement|dwelling|manor|villa|estate|farmhouse)\b/i },
];

export interface UseClassification {
  category: PropertyUseCategory;
  /** 0–1. Low means the name simply didn't say. */
  confidence: number;
  /** The text that triggered the match, so a user can judge it. */
  matchedTerm: string | null;
}

/**
 * Classify a building from its name. Returns "unknown" rather than guessing when
 * nothing matches — an unclassified building is a prompt to look, not a reject.
 */
export function classifyUseFromName(name: string | null | undefined): UseClassification {
  const s = String(name ?? "").trim();
  if (!s) return { category: "unknown", confidence: 0, matchedTerm: null };

  for (const rule of RULES) {
    const m = s.match(rule.terms);
    if (!m) continue;
    // A commemorative or structural word loses to an actual building noun.
    if (rule.unless && rule.unless.test(s)) continue;
    return { category: rule.category, confidence: rule.confidence, matchedTerm: m[0] };
  }
  return { category: "unknown", confidence: 0, matchedTerm: null };
}

/**
 * Map a county's own use description onto our categories. A real use code beats
 * a name heuristic, so callers should prefer this when an adapter supplies one.
 */
export function classifyUseFromCountyCode(useDesc: string | null | undefined): UseClassification {
  const s = String(useDesc ?? "").trim();
  if (!s) return { category: "unknown", confidence: 0, matchedTerm: null };
  const c = classifyUseFromName(s);
  // County codes are authoritative, so a match is worth more than the same
  // words appearing in a building's name.
  return c.category === "unknown" ? c : { ...c, confidence: Math.min(1, c.confidence + 0.1) };
}

/**
 * Categories worth pulling for an adaptive-reuse thesis.
 *
 * Institutional and entertainment are IN on purpose: closed schools, empty
 * churches and dark theatres are the classic conversion plays. Out are the
 * things you cannot convert into leasable space — single houses, cemeteries,
 * monuments, bridges.
 */
export const ADAPTIVE_REUSE_CATEGORIES: PropertyUseCategory[] = [
  "commercial", "industrial", "institutional", "entertainment", "unknown",
];

/** Never useful for a building-conversion thesis, whatever the class. */
export const NEVER_REUSABLE: PropertyUseCategory[] = ["funerary", "civic_monument", "infrastructure"];
