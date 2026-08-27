/** The receipt UI intentionally contains this exact, safe fail-closed outcome. */
export function isExpectedIsolatedReceiptDenial(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message === "Decision binding unavailable";
}
