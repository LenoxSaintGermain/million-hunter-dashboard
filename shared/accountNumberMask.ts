/**
 * One masking rule for broker account numbers in anything a tester sees
 * (Refs #119): last 4 only. The full number stays on the server for binding
 * checks and is never printed in the UI.
 */
export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  return `••••${value.slice(-4)}`;
}
