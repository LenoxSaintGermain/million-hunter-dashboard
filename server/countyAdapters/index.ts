/**
 * County adapter registry.
 *
 * Coverage is explicit on purpose. If no adapter serves a market, the caller is
 * told so — "no county adapter for Columbus, OH" is actionable, whereas
 * silently returning nothing reads as "there is nothing here".
 */
import type { CountyAdapter } from "./types";
import { alleghenyPa } from "./alleghenyPa";

export const COUNTY_ADAPTERS: CountyAdapter[] = [alleghenyPa];

export function adapterFor(city: string, state: string): CountyAdapter | null {
  return COUNTY_ADAPTERS.find((a) => a.covers(city, state)) ?? null;
}

export function listAdapters() {
  return COUNTY_ADAPTERS.map((a) => ({ id: a.id, label: a.label, coverageNote: a.coverageNote }));
}

export type { CountyAdapter, CountyParcel, DiscoverOptions } from "./types";
