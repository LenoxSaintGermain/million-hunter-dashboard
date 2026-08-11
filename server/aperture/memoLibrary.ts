/** A generated candidate memo remains visible even when validation rejects or skips it. */
export function belongsInMemoLibrary(status: string | null | undefined): boolean {
  return Boolean(status && status !== "pending");
}
