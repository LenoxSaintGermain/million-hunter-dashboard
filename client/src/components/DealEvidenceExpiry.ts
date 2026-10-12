import { useEffect, useReducer } from "react";

/** Local clock only. Re-arm at each upcoming expiry; never read a source or provider. */
export function scheduleEvidenceExpiry(
  expirations: readonly number[],
  notify: () => void
) {
  const dates = Array.from(new Set(expirations.filter(Number.isFinite))).sort(
    (a, b) => a - b
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  function arm() {
    const now = Date.now();
    const next = dates.find(date => date > now);
    if (cancelled || next === undefined) return;
    timer = setTimeout(
      () => {
        if (cancelled) return;
        if (Date.now() >= next) notify();
        arm();
      },
      Math.min(next - now, 2_147_483_647)
    );
  }
  arm();
  return () => {
    cancelled = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}

export function useEvidenceExpiry(
  expirations: readonly (Date | string | null | undefined)[]
) {
  const [, rerender] = useReducer((revision: number) => revision + 1, 0);
  const key = Array.from(
    new Set(
      expirations
        .map(value => (value == null ? NaN : new Date(value).getTime()))
        .filter(Number.isFinite)
    )
  )
    .sort((a, b) => a - b)
    .join(",");
  useEffect(
    () =>
      scheduleEvidenceExpiry(key ? key.split(",").map(Number) : [], rerender),
    [key]
  );
  return Date.now();
}
