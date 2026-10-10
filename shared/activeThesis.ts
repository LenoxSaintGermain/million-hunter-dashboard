/**
 * One source of truth for "which thesis is active" in the Capital UI: the
 * profile's active Capital thesis (`thesis.activeCapital`). A projection's
 * `isPrimary` / `status` flag is never used to guess it (#6). Test and UAT
 * theses are hidden from pickers unless the user asks to see them, and the
 * active thesis is never hidden.
 */

/** Names written for testing, e.g. "UAT — TLT Payroll Confirmation", "[TEST] Momentum", "QA: draft". */
const TEST_NAME = /^\s*(?:[\[(]\s*(?:uat|test|qa)\s*[\])]|(?:uat|test|qa)\s*(?:[—–\-·:|/]|$))/i;

export function isTestThesisName(name: string | null | undefined): boolean {
  return TEST_NAME.test(name ?? "");
}

export type ThesisProjection = { id: number; name: string | null; sourceCompilationId?: number | null };

export type ActiveThesisSelection =
  /** activeCapital has not answered yet: show nothing as selected. */
  | { state: "loading"; selectedId: "" }
  /** No active Capital thesis is set. */
  | { state: "none"; selectedId: "" }
  /** The active thesis exists but has no Capital projection to select yet. */
  | { state: "not_prepared"; selectedId: ""; activeName: string | null }
  | { state: "matched"; selectedId: string };

export function resolveActiveThesis(input: {
  activeLoaded: boolean;
  active: { id: number; name?: string | null } | null | undefined;
  projections: readonly ThesisProjection[] | null | undefined;
}): ActiveThesisSelection {
  if (!input.activeLoaded) return { state: "loading", selectedId: "" };
  if (!input.active) return { state: "none", selectedId: "" };
  const match = (input.projections ?? []).find((projection) => projection.sourceCompilationId === input.active!.id);
  return match ? { state: "matched", selectedId: String(match.id) } : { state: "not_prepared", selectedId: "", activeName: input.active.name ?? null };
}

/** Projections to offer in a picker. Test theses are hidden unless shown, but the selected one always stays. */
export function thesisOptions<T extends ThesisProjection>(projections: readonly T[] | null | undefined, opts: { showTest: boolean; keepId?: string | number | null }) {
  const all = projections ?? [];
  const keep = opts.keepId == null || opts.keepId === "" ? null : String(opts.keepId);
  const hiddenCount = all.filter((projection) => isTestThesisName(projection.name) && String(projection.id) !== keep).length;
  const visible = opts.showTest ? [...all] : all.filter((projection) => !isTestThesisName(projection.name) || String(projection.id) === keep);
  return { visible, hiddenCount };
}

/**
 * One count source for the thesis library and the account-bar selector (#112).
 * The library lists Capital projections plus canonical-only theses; the
 * selector can only switch to Capital projections. Both read their counts
 * from here, so the numbers agree and any difference is named.
 */
export function thesisLibraryCounts(input: {
  projections: readonly ThesisProjection[] | null | undefined;
  canonicalOnly: readonly { name: string | null }[] | null | undefined;
  keepId?: string | number | null;
}) {
  const projections = input.projections ?? [];
  const canonicalOnly = input.canonicalOnly ?? [];
  const selectableTestHidden = thesisOptions(projections, { showTest: false, keepId: input.keepId }).hiddenCount;
  const canonicalOnlyTest = canonicalOnly.filter((thesis) => isTestThesisName(thesis.name)).length;
  return {
    capital: projections.length,
    canonicalOnly: canonicalOnly.length,
    total: projections.length + canonicalOnly.length,
    selectableTestHidden,
    canonicalOnlyTest,
    testHidden: selectableTestHidden + canonicalOnlyTest,
  };
}

/** "Show 9 test theses (1 not yet in Capital)": the same number the selector shows, plus what only the library has. */
export function showTestThesesLabel(counts: { selectableTestHidden: number; canonicalOnlyTest: number }, scope: "library" | "selector"): string {
  const n = scope === "selector" ? counts.selectableTestHidden : counts.selectableTestHidden + counts.canonicalOnlyTest;
  // The selector can only switch to theses already in Capital, so it says so;
  // the library adds the ones not yet in Capital and names them.
  const base = scope === "selector" ? `Show ${n} switchable test ${n === 1 ? "thesis" : "theses"}` : `Show ${n} test ${n === 1 ? "thesis" : "theses"}`;
  return scope === "library" && counts.canonicalOnlyTest > 0 ? `${base} (${counts.canonicalOnlyTest} not yet in Capital)` : base;
}
