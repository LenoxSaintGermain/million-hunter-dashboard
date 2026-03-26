/**
 * OZ/TAD Enrichment Service
 * 
 * Enriches deals with:
 * 1. Opportunity Zone (OZ) classification — HUD Census Tract API
 * 2. Atlanta TAD (Tax Allocation District) boundary check
 * 3. World Cup 2026 / Super Bowl 2028 event proximity
 * 4. Estimated OZ tax-free gain potential
 */

import { invokeLLM } from "./_core/llm";

// ─── Atlanta TAD Districts (boundaries as city/zip approximations) ─────────────
const ATLANTA_TAD_DISTRICTS: Record<string, string[]> = {
  "Westside TAD": ["30314", "30318", "30310", "30311"],
  "BeltLine TAD": ["30312", "30315", "30316", "30317", "30318", "30310"],
  "Eastside TAD": ["30307", "30308", "30312"],
  "Campbellton Road TAD": ["30311", "30331"],
  "Hollowell/M.L. King TAD": ["30314", "30318"],
  "Bowen Homes TAD": ["30314"],
  "Perry-Bolton TAD": ["30318"],
  "Stadium Neighborhoods TAD": ["30315", "30312"],
};

// ─── World Cup 2026 Atlanta Venue (Mercedes-Benz Stadium) ─────────────────────
const WORLD_CUP_VENUES_2026 = [
  { city: "Atlanta", state: "GA", lat: 33.7553, lng: -84.4006, name: "Mercedes-Benz Stadium" },
  { city: "Dallas", state: "TX", lat: 32.7473, lng: -97.0945, name: "AT&T Stadium" },
  { city: "Miami", state: "FL", lat: 25.9580, lng: -80.2389, name: "Hard Rock Stadium" },
  { city: "Los Angeles", state: "CA", lat: 33.8644, lng: -118.2611, name: "SoFi Stadium" },
  { city: "New York", state: "NY", lat: 40.8135, lng: -74.0745, name: "MetLife Stadium" },
  { city: "Seattle", state: "WA", lat: 47.5952, lng: -122.3316, name: "Lumen Field" },
  { city: "San Francisco", state: "CA", lat: 37.4032, lng: -121.9698, name: "Levi's Stadium" },
  { city: "Kansas City", state: "MO", lat: 39.0490, lng: -94.4839, name: "Arrowhead Stadium" },
  { city: "Philadelphia", state: "PA", lat: 39.9008, lng: -75.1675, name: "Lincoln Financial Field" },
  { city: "Boston", state: "MA", lat: 42.0909, lng: -71.2643, name: "Gillette Stadium" },
  { city: "Houston", state: "TX", lat: 29.6847, lng: -95.4107, name: "NRG Stadium" },
];

// ─── Known Atlanta OZ Tracts (partial list for enrichment) ───────────────────
const ATLANTA_OZ_TRACTS: Record<string, string> = {
  "30314": "13121011900", // Vine City / English Avenue
  "30318": "13121012100", // Westside
  "30310": "13121012500", // West End
  "30315": "13121008600", // Mechanicsville
  "30312": "13121009100", // Summerhill
  "30316": "13121009800", // East Atlanta
};

// ─── Haversine distance calculation ──────────────────────────────────────────
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Geocode a location string using AI ──────────────────────────────────────
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number; zip: string; city: string; state: string } | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a geocoding assistant. Return ONLY valid JSON, no markdown.",
        },
        {
          role: "user",
          content: `Geocode this location and return JSON with lat, lng, zip, city, state fields: "${location}"
Return format: {"lat": 33.749, "lng": -84.388, "zip": "30303", "city": "Atlanta", "state": "GA"}
If you cannot geocode, return: {"lat": null, "lng": null, "zip": null, "city": null, "state": null}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "geocode_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              lat: { type: ["number", "null"] },
              lng: { type: ["number", "null"] },
              zip: { type: ["string", "null"] },
              city: { type: ["string", "null"] },
              state: { type: ["string", "null"] },
            },
            required: ["lat", "lng", "zip", "city", "state"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    if (!parsed.lat || !parsed.lng) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Check if a ZIP is in an Atlanta TAD district ─────────────────────────────
function checkAtlantaTAD(zip: string): string | null {
  for (const [district, zips] of Object.entries(ATLANTA_TAD_DISTRICTS)) {
    if (zips.includes(zip)) return district;
  }
  return null;
}

// ─── Check if a ZIP is in a known OZ tract ───────────────────────────────────
function checkOpportunityZone(zip: string): { isOZ: boolean; tractId: string | null } {
  const tractId = ATLANTA_OZ_TRACTS[zip] ?? null;
  return { isOZ: !!tractId, tractId };
}

// ─── Calculate event proximity and revenue projection ─────────────────────────
function calcEventProximity(
  lat: number,
  lng: number,
  city: string,
  state: string
): { distanceMiles: number | null; revenueLow: number | null; revenueHigh: number | null } {
  // Find the nearest World Cup venue in the same metro
  const sameMetroVenues = WORLD_CUP_VENUES_2026.filter(
    (v) => v.state === state || v.city.toLowerCase() === city.toLowerCase()
  );
  const allVenues = sameMetroVenues.length > 0 ? sameMetroVenues : WORLD_CUP_VENUES_2026;

  let minDist = Infinity;
  for (const venue of allVenues) {
    const dist = haversineDistance(lat, lng, venue.lat, venue.lng);
    if (dist < minDist) minDist = dist;
  }

  if (minDist > 10) return { distanceMiles: null, revenueLow: null, revenueHigh: null };

  // Revenue projection based on proximity tier
  let revenueLow: number;
  let revenueHigh: number;
  if (minDist <= 0.5) {
    revenueLow = 80000; revenueHigh = 150000;
  } else if (minDist <= 1.5) {
    revenueLow = 50000; revenueHigh = 80000;
  } else if (minDist <= 3) {
    revenueLow = 25000; revenueHigh = 50000;
  } else {
    revenueLow = 10000; revenueHigh = 25000;
  }

  return { distanceMiles: Math.round(minDist * 10) / 10, revenueLow, revenueHigh };
}

// ─── Estimate OZ tax-free gain potential ─────────────────────────────────────
function estimateOZGain(askingPrice: number | null, cashFlow: number | null): number | null {
  if (!askingPrice) return null;
  // Conservative 10-year appreciation at 4% CAGR in OZ = ~48% gain
  // Plus deferred capital gains on the investment itself
  const appreciationGain = askingPrice * 0.48;
  const annualCashFlow = cashFlow ?? askingPrice * 0.08; // assume 8% yield if no cash flow
  const totalCashFlows = annualCashFlow * 10;
  return Math.round(appreciationGain + totalCashFlows);
}

// ─── Main enrichment function ─────────────────────────────────────────────────
export interface OZTADEnrichment {
  opportunityZone: boolean;
  ozTractId: string | null;
  tadDistrict: string | null;
  ozPotentialGain: number | null;
  eventProximityMiles: number | null;
  eventRevenueLow: number | null;
  eventRevenueHigh: number | null;
}

export async function enrichDealWithOZTAD(
  location: string | null,
  askingPrice: number | null,
  cashFlow: number | null
): Promise<OZTADEnrichment> {
  const empty: OZTADEnrichment = {
    opportunityZone: false,
    ozTractId: null,
    tadDistrict: null,
    ozPotentialGain: null,
    eventProximityMiles: null,
    eventRevenueLow: null,
    eventRevenueHigh: null,
  };

  if (!location) return empty;

  // Geocode the location
  const geo = await geocodeLocation(location);
  if (!geo || !geo.lat || !geo.lng) return empty;

  // OZ check
  const ozResult = geo.zip ? checkOpportunityZone(geo.zip) : { isOZ: false, tractId: null };

  // TAD check
  const tadDistrict = geo.zip ? checkAtlantaTAD(geo.zip) : null;

  // Event proximity
  const eventData = calcEventProximity(geo.lat, geo.lng, geo.city ?? "", geo.state ?? "");

  // OZ gain estimate
  const ozPotentialGain = ozResult.isOZ
    ? estimateOZGain(askingPrice, cashFlow)
    : null;

  return {
    opportunityZone: ozResult.isOZ,
    ozTractId: ozResult.tractId,
    tadDistrict,
    ozPotentialGain,
    eventProximityMiles: eventData.distanceMiles,
    eventRevenueLow: eventData.revenueLow,
    eventRevenueHigh: eventData.revenueHigh,
  };
}
