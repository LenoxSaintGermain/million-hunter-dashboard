export type CanonicalThesisLabelInput = {
  id: number;
  name?: string | null;
  isActiveCapital?: boolean | null;
};

/** Keep same-name canonical sources distinguishable without changing identity. */
export function canonicalThesisLabel(thesis: CanonicalThesisLabelInput): string {
  const name = thesis.name?.trim() || "Untitled Capital thesis";
  return `${name} · v${thesis.id}${thesis.isActiveCapital ? " · active" : ""}`;
}
