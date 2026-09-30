export type ApertureLifecycleTab = "orders" | "monitoring" | "alpha";

export function parseApertureLifecycle(search: string): ApertureLifecycleTab {
  const value = new URLSearchParams(search).get("lifecycle");
  return value === "monitoring" || value === "alpha" ? value : "orders";
}

/** Route only saved run-outcome reviews; decision/gate destinations stay intact. */
export function outcomeReviewHref(href: string): string {
  if (!/^\/aperture\/run\/\d+\/execute(?:[?#]|$)/.test(href)) return href;
  const url = new URL(href, "https://aperture.invalid");
  url.searchParams.set("lifecycle", "alpha");
  return `${url.pathname}${url.search}${url.hash}`;
}
