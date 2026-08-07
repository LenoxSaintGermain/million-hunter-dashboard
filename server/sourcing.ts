/**
 * Sourcing engine — one implementation, two callers.
 *
 * The research logic used to live inline in the tRPC procedure, which meant the
 * scheduler would have had to duplicate it. Extracting it keeps the manual
 * "Source real" button and the nightly job on exactly the same code path, so a
 * fix to one is a fix to both.
 */

export interface SourcingInput {
  assetClass: string;
  markets?: string[];
  /** Search the whole country rather than only the thesis's declared markets. */
  nationwide?: boolean;
  limit?: number;
  marketsPerRun?: number;
}

export interface SourcingResult {
  created: number;
  researched: number;
  citations: string[];
  searchedMarkets: string[];
  uncoveredMarkets: string[];
  message: string;
}

export async function runSourcing(raw: SourcingInput): Promise<SourcingResult> {
  const input = {
    assetClass: raw.assetClass ?? "historic",
    markets: raw.markets,
    nationwide: raw.nationwide ?? false,
    limit: raw.limit ?? 6,
    marketsPerRun: raw.marketsPerRun ?? 5,
  };

  const { getAssetClass } = await import("../shared/assetClasses");
  const { createCommercialAsset, getCommercialAssets, persistHistoricScore } = await import("./db");
  const { scoreAssetByClass } = await import("./scoring");
  const cls = getAssetClass(input.assetClass);
  const key = process.env.SONAR_API_KEY;
  if (!key) throw new Error("SONAR_API_KEY not configured — live sourcing unavailable");

  // Several cities per state. Mapping a state to ONE city meant the whole
  // thesis was really a search of that single city.
  const STATE_CITIES: Record<string, string[]> = {
    AL: ["Birmingham, AL", "Montgomery, AL", "Mobile, AL", "Huntsville, AL"],
    AK: ["Anchorage, AK", "Fairbanks, AK"],
    AZ: ["Phoenix, AZ", "Tucson, AZ", "Mesa, AZ"],
    AR: ["Little Rock, AR", "Fort Smith, AR", "Fayetteville, AR"],
    CA: ["Los Angeles, CA", "Sacramento, CA", "Fresno, CA", "Oakland, CA", "San Diego, CA"],
    CO: ["Denver, CO", "Colorado Springs, CO", "Pueblo, CO"],
    CT: ["Hartford, CT", "New Haven, CT", "Bridgeport, CT"],
    DE: ["Wilmington, DE", "Dover, DE"],
    FL: ["Tampa, FL", "Jacksonville, FL", "Orlando, FL", "Miami, FL", "Pensacola, FL"],
    GA: ["Atlanta, GA", "Savannah, GA", "Macon, GA", "Augusta, GA", "Columbus, GA"],
    HI: ["Honolulu, HI", "Hilo, HI"],
    ID: ["Boise, ID", "Idaho Falls, ID"],
    IL: ["Chicago, IL", "Peoria, IL", "Rockford, IL", "Springfield, IL"],
    IN: ["Indianapolis, IN", "Fort Wayne, IN", "Evansville, IN", "South Bend, IN"],
    IA: ["Des Moines, IA", "Cedar Rapids, IA", "Davenport, IA"],
    KS: ["Wichita, KS", "Kansas City, KS", "Topeka, KS"],
    KY: ["Louisville, KY", "Lexington, KY", "Covington, KY", "Owensboro, KY"],
    LA: ["New Orleans, LA", "Baton Rouge, LA", "Shreveport, LA"],
    ME: ["Portland, ME", "Bangor, ME"],
    MD: ["Baltimore, MD", "Frederick, MD", "Annapolis, MD"],
    MA: ["Boston, MA", "Worcester, MA", "Springfield, MA", "Lowell, MA"],
    MI: ["Detroit, MI", "Grand Rapids, MI", "Lansing, MI", "Kalamazoo, MI"],
    MN: ["Minneapolis, MN", "St. Paul, MN", "Duluth, MN"],
    MS: ["Jackson, MS", "Gulfport, MS", "Hattiesburg, MS"],
    MO: ["St. Louis, MO", "Kansas City, MO", "Springfield, MO", "Columbia, MO"],
    MT: ["Billings, MT", "Missoula, MT", "Butte, MT"],
    NE: ["Omaha, NE", "Lincoln, NE"],
    NV: ["Las Vegas, NV", "Reno, NV", "Henderson, NV"],
    NH: ["Manchester, NH", "Nashua, NH"],
    NJ: ["Newark, NJ", "Jersey City, NJ", "Trenton, NJ", "Camden, NJ"],
    NM: ["Albuquerque, NM", "Santa Fe, NM"],
    NY: ["Buffalo, NY", "Rochester, NY", "Syracuse, NY", "Albany, NY", "Brooklyn, NY"],
    NC: ["Charlotte, NC", "Raleigh, NC", "Winston-Salem, NC", "Durham, NC", "Asheville, NC"],
    ND: ["Fargo, ND", "Bismarck, ND"],
    OH: ["Columbus, OH", "Cleveland, OH", "Cincinnati, OH", "Dayton, OH", "Toledo, OH", "Akron, OH"],
    OK: ["Oklahoma City, OK", "Tulsa, OK"],
    OR: ["Portland, OR", "Eugene, OR", "Salem, OR"],
    PA: ["Philadelphia, PA", "Pittsburgh, PA", "Allentown, PA", "Erie, PA", "Scranton, PA"],
    RI: ["Providence, RI", "Pawtucket, RI"],
    SC: ["Charleston, SC", "Columbia, SC", "Greenville, SC", "Spartanburg, SC"],
    SD: ["Sioux Falls, SD", "Rapid City, SD"],
    TN: ["Nashville, TN", "Memphis, TN", "Chattanooga, TN", "Knoxville, TN"],
    TX: ["Dallas, TX", "Houston, TX", "San Antonio, TX", "Austin, TX", "Fort Worth, TX"],
    UT: ["Salt Lake City, UT", "Ogden, UT", "Provo, UT"],
    VT: ["Burlington, VT", "Montpelier, VT"],
    VA: ["Richmond, VA", "Norfolk, VA", "Roanoke, VA", "Lynchburg, VA"],
    WA: ["Seattle, WA", "Spokane, WA", "Tacoma, WA"],
    WV: ["Charleston, WV", "Huntington, WV", "Wheeling, WV"],
    WI: ["Milwaukee, WI", "Madison, WI", "Green Bay, WI"],
    WY: ["Cheyenne, WY", "Casper, WY"],
    DC: ["Washington, DC"],
  };

  // Coverage-aware market selection. The old code did `.slice(0, 4)` on the
  // class's declared markets, so 7 of the historic thesis's 11 states were
  // NEVER searched and every run re-searched the same first four — which is
  // why the pipeline came back all-Ohio. Now we search the markets we have
  // the LEAST inventory in, so repeated runs spread coverage on their own.
  const allMarkets = (
    input.markets?.length ? input.markets
    : input.nationwide ? Object.keys(STATE_CITIES)
    : (cls.markets ?? [])
  ).map((m) => m.toUpperCase());
  const priorForClass = await getCommercialAssets({ limit: 1000, assetClass: cls.id });
  const countByState = new Map<string, number>();
  for (const a of priorForClass as any[]) {
    const st = String(a.state ?? "").toUpperCase();
    countByState.set(st, (countByState.get(st) ?? 0) + 1);
  }
  // Rank by how little inventory we hold, but SHUFFLE among equals. Without
  // this, states that genuinely have no findable listings (AK, HI) stay at
  // zero forever and monopolise every subsequent run.
  const ranked = [...allMarkets]
    .map((m) => ({ m, n: countByState.get(m) ?? 0, jitter: Math.random() }))
    .sort((x, y) => (x.n - y.n) || (x.jitter - y.jitter))
    .map((x) => x.m);
  // Search the 5 least-covered markets, splitting the requested limit
  // across them so no single city can dominate the result.
  const targetStates = ranked.slice(0, input.marketsPerRun);
  const perMarket = Math.max(1, Math.ceil(input.limit / Math.max(1, targetStates.length)));
  const fieldList = cls.fields.slice(0, 8).map((f) => `"${f.key}"`).join(", ");

  const promptFor = (stateCode: string) => {
    const cities = (STATE_CITIES[stateCode] ?? [stateCode]).slice(0, 3).join(" / ");
    return `Find up to ${perMarket} REAL ${cls.label} properties currently listed for sale in ${cities}. Thesis: ${cls.description}

Return ONLY a JSON array — no prose, no explanation. Each object: "name", "address", "city", "state", "sourceUrl", plus whichever of these you can source: ${fieldList}. Omit anything not stated in the source — never guess. If you cannot find any, return [].`;
  };

  const callSonar = async (endpoint: string, prompt: string) => {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are a commercial real-estate acquisition researcher. Output ONLY a valid JSON array. No prose, no markdown fences, no explanation. Start your response with [ and end with ]." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok) throw new Error(`Sonar ${r.status}`);
    return r.json();
  };

  const parseListings = (raw: any): any[] => {
    const content: string = raw?.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
    const tryParse = (t: string) => { try { return JSON.parse(t); } catch { return null; } };
    let parsed: any = tryParse(cleaned);
    if (!parsed) {
      const a = cleaned.indexOf("["), b = cleaned.lastIndexOf("]");
      if (a >= 0 && b > a) parsed = tryParse(cleaned.slice(a, b + 1));
    }
    if (!parsed) {
      const a = cleaned.indexOf("{"), b = cleaned.lastIndexOf("}");
      if (a >= 0 && b > a) parsed = tryParse(cleaned.slice(a, b + 1));
    }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const arr = Object.values(parsed).find((v) => Array.isArray(v));
      if (Array.isArray(arr)) return arr as any[];
      if ((parsed as any).name) return [parsed];
    }
    return [];
  };

  // ONE SEARCH PER MARKET. Asking a single search to "spread across five
  // markets" does not work — the model anchors on the first one and returns
  // everything from that city. Distribution has to be structural.
  const perMarketResults = await Promise.allSettled(
    targetStates.map(async (st) => {
      let raw: any;
      try { raw = await callSonar("https://api.perplexity.ai/v1/sonar", promptFor(st)); }
      catch { raw = await callSonar("https://api.perplexity.ai/chat/completions", promptFor(st)); }
      return {
        state: st,
        listings: parseListings(raw).map((x: any) => ({ ...x, state: x?.state || st })),
        citations: Array.isArray(raw?.citations) ? raw.citations : [],
      };
    }),
  );

  const found: any[] = [];
  const citations: string[] = [];
  const perMarketCounts: Record<string, number> = {};
  for (const r of perMarketResults) {
    if (r.status !== "fulfilled") continue;
    perMarketCounts[r.value.state] = r.value.listings.length;
    found.push(...r.value.listings);
    citations.push(...r.value.citations);
  }

  if (!found.length) {
    return {
      created: 0, researched: 0, citations: [],
      searchedMarkets: targetStates, uncoveredMarkets: allMarkets.filter((m) => !(countByState.get(m) ?? 0)),
      message: `No parseable listings returned for ${targetStates.join(", ")} — try again or adjust markets`,
    };
  }

  // Dedupe against what's already in the pipeline for this class.
  const existing = await getCommercialAssets({ limit: 1000, assetClass: cls.id });
  const seen = new Set(existing.map((a: any) => `${String(a.name).toLowerCase().trim()}|${String(a.city).toLowerCase().trim()}`));

  const nativeKeys = new Set(["yearBuilt","stories","squareFootage","lotSqFt","occupancyRate","capRate","askingPrice","isHistoric","historicRegisterEligible","isStabilized","hasAirRights","higherAndBetterUseNotes","noi"]);
  let created = 0;
  const candidates = found.slice(0, input.limit);
  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    const name = String(p.name ?? "").trim();
    const city = String(p.city ?? "").trim();
    if (!name || seen.has(`${name.toLowerCase()}|${city.toLowerCase()}`)) continue;
    const native: Record<string, any> = {};
    const meta: Record<string, any> = {};
    for (const f of cls.fields) {
      const v = p[f.key];
      if (v === undefined || v === null || v === "") continue;
      // Sources report "$2,700,000" / "26,136 SF" / "92%" — strip to a number.
      const toNum = (x: any) => { const n = parseFloat(String(x).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : NaN; };
      let val: any;
      if (f.type === "boolean") val = (v === true || v === "true");
      else if (f.type === "percent") { const n = toNum(v); val = n > 1 ? n / 100 : n; }
      else if (f.type === "number" || f.type === "currency" || f.type === "year") val = toNum(v);
      else val = String(v);
      if (typeof val === "number" && !Number.isFinite(val)) continue;
      if (cls.scorer === "historic" && nativeKeys.has(f.key)) native[f.key] = val;
      else meta[f.key] = val;
    }
    const now = Date.now();
    await createCommercialAsset({
      name: name.slice(0, 200),
      address: String(p.address ?? city).slice(0, 500) || city,
      city, state: String(p.state ?? "").slice(0, 50),
      propertyType: "mixed_use",
      assetClass: cls.id,
      classMetadata: Object.keys(meta).length ? meta : undefined,
      ...native,
      source: "sonar-research",
      sourceUrl: String(p.sourceUrl ?? citations[i] ?? citations[0] ?? ""),
      createdAt: now, updatedAt: now,
    } as any);
    seen.add(`${name.toLowerCase()}|${city.toLowerCase()}`);
    created++;
  }

  // Score everything freshly sourced so the client sees a ranked pipeline.
  const all = await getCommercialAssets({ limit: 1000, assetClass: cls.id });
  for (const a of all) {
    if (a.compositeScore == null) await persistHistoricScore(a.id, scoreAssetByClass(a) as any);
  }
  // Say which markets were searched — silent market selection is how the
  // pipeline drifted all-Ohio without anyone noticing.
  const uncovered = allMarkets.filter((m) => !(countByState.get(m) ?? 0));
  return {
    created,
    researched: found.length,
    citations: citations.slice(0, 5),
    searchedMarkets: targetStates,
    uncoveredMarkets: uncovered,
    message:
      `Sourced ${created} real ${cls.shortLabel} propert${created === 1 ? "y" : "ies"} across ${targetStates.map((st) => `${st} ${perMarketCounts[st] ?? 0}`).join(" · ")}` +
      (uncovered.length ? ` · ${uncovered.length} thesis market(s) still with no inventory` : ""),
  };

}
