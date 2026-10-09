/**
 * Thesis names testers can recognise (Refs #124). Existing rows are never
 * renamed: short names like "MR" are shown with an excerpt of the statement,
 * and new saves need a descriptive name.
 */
export const MIN_DESCRIPTIVE_THESIS_NAME = 8;
const EXCERPT_CHARS = 60;

/** True for names a tester can recognise: at least 8 characters and not just initials. */
export function isDescriptiveThesisName(name: string | null | undefined): boolean {
  const trimmed = (name ?? "").trim();
  if (trimmed.length < MIN_DESCRIPTIVE_THESIS_NAME) return false;
  // Initials only, e.g. "M.R. / P.W." or "ABC DEF".
  if (/^(?:[A-Z]{1,4}[.\s/&-]*)+$/.test(trimmed)) return false;
  return true;
}

/** Error to show when a new thesis name is not descriptive, or null when it is fine. */
export function thesisNameError(name: string | null | undefined): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Give this thesis a name you'll recognise later (at least 8 characters).";
  if (!isDescriptiveThesisName(trimmed)) return `Use a descriptive name of at least ${MIN_DESCRIPTIVE_THESIS_NAME} characters, not just initials.`;
  return null;
}

/** First line of the statement, cut to 60 characters. */
export function thesisStatementExcerpt(text: string | null | undefined, max = EXCERPT_CHARS): string | null {
  const firstLine = (text ?? "").split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!firstLine) return null;
  return firstLine.length > max ? `${firstLine.slice(0, max - 1).trimEnd()}…` : firstLine;
}

/** "MR · Rates fall faster than the market expects…" for short names; the name alone otherwise. */
export function thesisDisplayLabel(name: string | null | undefined, statement: string | null | undefined, fallback = "Untitled Capital thesis"): string {
  const trimmed = (name ?? "").trim();
  if (trimmed && isDescriptiveThesisName(trimmed)) return trimmed;
  const excerpt = thesisStatementExcerpt(statement);
  if (!excerpt) return trimmed || fallback;
  return `${trimmed || fallback} · ${excerpt}`;
}
