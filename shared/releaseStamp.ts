/**
 * Release stamp shown in the signed-in UI so UAT bug reports can cite the
 * exact build (Refs #123). The SHA is baked in at build time as
 * VITE_RELEASE_SHA; when it is absent we say so instead of inventing one.
 */
export function releaseStampLabel(rawSha: string | undefined | null): { short: string | null; label: string } {
  const sha = (rawSha ?? "").trim();
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) return { short: null, label: "Release not stamped" };
  const short = sha.slice(0, 7).toLowerCase();
  return { short, label: `Release ${short}` };
}
