const DEFAULT_RETURN_PATH = "/";

export function sanitizeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_RETURN_PATH;
  }
  return value;
}

export function buildLocalSignInPath(returnPath?: string | null): string {
  const safeReturnPath = sanitizeReturnPath(returnPath);
  return `/sign-in?returnPath=${encodeURIComponent(safeReturnPath)}`;
}
