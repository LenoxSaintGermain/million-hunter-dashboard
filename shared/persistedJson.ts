/** MySQL JSON is decoded by the driver; MariaDB JSON aliases can arrive as text. */
export function parsePersistedJson<T>(value: T | string): T {
  // Malformed storage is an error, never an empty success state.
  return typeof value === "string" ? JSON.parse(value) as T : value;
}
