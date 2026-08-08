/**
 * County data adapters.
 *
 * The web-search experiment established the ceiling: a search model can tell you
 * WHICH office holds a tax roll, but cannot enumerate it. County records live in
 * parcel-keyed portals and open-data APIs, not in readable web pages.
 *
 * So we go direct. Each adapter wraps one county's actual data service, and
 * because the query runs against the county's own dataset there is nothing for a
 * model to invent — every figure here is a database value with a parcel ID
 * attached.
 *
 * Adding a county = one file implementing this interface. Coverage is
 * deliberately explicit: `covers()` returning false is a useful answer, and the
 * UI says "no adapter for this county" rather than silently finding nothing.
 */
import type { OffMarketSignals } from "../../shared/offMarket";

export interface CountyParcel {
  parcelId: string;
  /** Street address only — city/state are separate columns downstream. */
  address: string;
  city: string;
  state: string;
  ownerName?: string | null;
  /** The county's own use description, e.g. "OFFICE - 1-2 STORIES". */
  useDescription?: string | null;
  yearBuilt?: number | null;
  lotSqFt?: number | null;
  /** County fair-market / assessed total — NOT an asking price. */
  assessedValue?: number | null;
  lastSaleDate?: string | null;
  lastSalePrice?: number | null;
  /** Public-record signals, already shaped for the motivation model. */
  signals: OffMarketSignals;
  /** Where a human can verify this row themselves. */
  sourceUrl: string;
}

export interface DiscoverOptions {
  /** Restrict to one city within the county, if the adapter supports it. */
  city?: string;
  /** Minimum outstanding lien / delinquency in dollars. */
  minLien?: number;
  limit?: number;
}

export interface CountyAdapter {
  id: string;
  label: string;
  /** Human-readable note on what this adapter can and cannot see. */
  coverageNote: string;
  /** Does this adapter serve the given city/state? */
  covers(city: string, state: string): boolean;
  /** Find distressed COMMERCIAL parcels — the off-market discovery query. */
  discoverDistressed(opts: DiscoverOptions): Promise<CountyParcel[]>;
  /** Enrich one known address with real county data. */
  lookupByAddress(address: string, city: string, state: string): Promise<CountyParcel | null>;
}
