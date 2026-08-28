export function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return normalizeStringList(JSON.parse(trimmed) as unknown);
      } catch {
        return [trimmed];
      }
    }

    return [trimmed];
  }

  if (value && typeof value === "object" && "citations" in value) {
    return normalizeStringList((value as { citations?: unknown }).citations);
  }

  return [];
}

export function normalizeJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return normalizeJsonRecord(JSON.parse(trimmed) as unknown);
    } catch {
      return null;
    }
  }

  return null;
}
