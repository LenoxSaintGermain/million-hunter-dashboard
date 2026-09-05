export const DEFAULT_CAPITAL_THESIS_NAME = "Capital / Trade Thesis";

export type ThesisSaveReceipt = {
  compilationId: number;
  persistedName: string;
  nameMatchesRequest: boolean;
};

/**
 * Make the exact stored thesis identity visible to the caller. A save receipt
 * is evidence of persistence; it is not inferred from the submitted field.
 */
export function buildThesisSaveReceipt({
  compilationId,
  requestedName,
  persistedName,
}: {
  compilationId: number;
  requestedName?: string | null;
  persistedName?: string | null;
}): ThesisSaveReceipt {
  const expectedName = requestedName?.trim() || DEFAULT_CAPITAL_THESIS_NAME;
  const storedName = persistedName?.trim() || "";
  return {
    compilationId,
    persistedName: storedName,
    nameMatchesRequest: storedName === expectedName,
  };
}
