import { matchesAcquisitionFinancials, parseAcquisitionListings, type AcquisitionFinancials } from "./acquisitionListing";

const allowedHosts = new Set(["bizbuysell.com", "dealstream.com", "flippa.com", "quietlight.com", "empireflippers.com"]);
export type AcquisitionSourceCheck = {
  state: "reachable" | "unavailable" | "unverified";
  checkedAt: string;
  reason: string;
};

/** A reachable URL is not evidence of availability, identity or audited figures. */
export async function checkAcquisitionSource(listingUrl: string): Promise<AcquisitionSourceCheck> {
  const checkedAt = new Date().toISOString();
  try {
    const url = new URL(listingUrl);
    if (url.protocol !== "https:" || url.port || url.username || url.password || !allowedHosts.has(url.hostname.replace(/^www\./, ""))) {
      return { state: "unverified", checkedAt, reason: "Source is outside the supported public marketplaces." };
    }
    parseAcquisitionListings([{ name: "Source check", listingUrl }]);
    const response = await fetch(listingUrl, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { Accept: "text/html" } });
    await response.body?.cancel();
    if (response.status === 404 || response.status === 410) {
      return { state: "unavailable", checkedAt, reason: `Original listing returned HTTP ${response.status}; do not promote the indexed result.` };
    }
    if (response.status === 200) {
      return { state: "reachable", checkedAt, reason: "Original page responded; availability and financial claims are not independently verified." };
    }
    return { state: "unverified", checkedAt, reason: `Original source could not be checked (HTTP ${response.status}); this does not establish that the business is sold.` };
  } catch {
    return { state: "unverified", checkedAt, reason: "Original source check could not finish; availability remains unknown." };
  }
}

export async function assessAcquisitionListings(listings: ReturnType<typeof parseAcquisitionListings>, filters: AcquisitionFinancials) {
  return Promise.all(listings.map(async listing => {
    if (!matchesAcquisitionFinancials(listing, filters)) {
      return { listing, eligible: false, sourceCheck: null, reason: "Disclosed financials are missing or outside the saved search bounds." };
    }
    const sourceCheck = await checkAcquisitionSource(listing.listingUrl);
    // A blocked request is not proof the business disappeared. Preserve it for
    // conditional research, with the unresolved source check in the receipt.
    return { listing, eligible: sourceCheck.state !== "unavailable", sourceCheck, reason: sourceCheck.reason };
  }));
}
