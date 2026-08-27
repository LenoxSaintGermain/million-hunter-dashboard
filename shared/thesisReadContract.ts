export type ThesisReadFieldStatus = "canonical" | "normalized" | "unknown" | "absent";

export type ThesisReadDiagnostic = {
  status: ThesisReadFieldStatus;
  source: "array" | "json_string" | "plain_string" | "structured" | "malformed" | "null";
  code?: "THESIS_LEGACY_VALUE_WITHHELD";
};

export type CanonicalThesisReadDiagnostics = {
  confidenceNotes: ThesisReadDiagnostic;
  graph: ThesisReadDiagnostic;
  collections: Record<string, ThesisReadDiagnostic>;
};

function classify(value: unknown): ThesisReadDiagnostic["source"] {
  if (value == null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return "plain_string";
  return "structured";
}

function absentDiagnostic(): ThesisReadDiagnostic {
  return { status: "absent", source: "null" };
}

function unknownDiagnostic(source: ThesisReadDiagnostic["source"]): ThesisReadDiagnostic {
  return { status: "unknown", source, code: "THESIS_LEGACY_VALUE_WITHHELD" };
}

function stringsOnly(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : null;
}

/**
 * Canonical UI contract for thesis note collections. Recover only explicit
 * strings; an opaque or malformed legacy value is withheld rather than guessed.
 */
export function normalizeThesisStringList(value: unknown): { value: string[]; diagnostic: ThesisReadDiagnostic } {
  if (value == null) return { value: [], diagnostic: absentDiagnostic() };
  const direct = stringsOnly(value);
  if (direct) return { value: direct, diagnostic: { status: "canonical", source: "array" } };

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { value: [], diagnostic: { status: "normalized", source: "plain_string" } };
    try {
      const parsed = JSON.parse(trimmed);
      const parsedList = stringsOnly(parsed);
      if (parsedList) return { value: parsedList, diagnostic: { status: "normalized", source: "json_string" } };
      if (typeof parsed === "string") return { value: [parsed], diagnostic: { status: "normalized", source: "json_string" } };
      return { value: [], diagnostic: unknownDiagnostic("structured") };
    } catch {
      return { value: [value], diagnostic: { status: "normalized", source: "plain_string" } };
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["confidenceNotes", "confidence_notes", "notes", "items"]) {
      const list = stringsOnly(record[key]);
      if (list) return { value: list, diagnostic: { status: "normalized", source: "structured" } };
    }
  }
  return { value: [], diagnostic: unknownDiagnostic(classify(value)) };
}

export function normalizeThesisArray(value: unknown): { value: unknown[]; diagnostic: ThesisReadDiagnostic } {
  if (value == null) return { value: [], diagnostic: absentDiagnostic() };
  if (Array.isArray(value)) return { value, diagnostic: { status: "canonical", source: "array" } };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return { value: parsed, diagnostic: { status: "normalized", source: "json_string" } };
    } catch {
      return { value: [], diagnostic: unknownDiagnostic("malformed") };
    }
  }
  return { value: [], diagnostic: unknownDiagnostic(classify(value)) };
}

export function normalizeThesisRecord(value: unknown): { value: Record<string, unknown> | null; diagnostic: ThesisReadDiagnostic } {
  if (value == null) return { value: null, diagnostic: absentDiagnostic() };
  if (typeof value === "object" && !Array.isArray(value)) return { value: value as Record<string, unknown>, diagnostic: { status: "canonical", source: "structured" } };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed != null && !Array.isArray(parsed)) return { value: parsed as Record<string, unknown>, diagnostic: { status: "normalized", source: "json_string" } };
    } catch {
      return { value: null, diagnostic: unknownDiagnostic("malformed") };
    }
  }
  return { value: null, diagnostic: unknownDiagnostic(classify(value)) };
}

/** The only Capital thesis shape that may reach React consumers. */
export function normalizeCapitalThesisRead<T extends { confidenceNotes?: unknown; graph?: unknown }>(row: T): Omit<T, "confidenceNotes" | "graph"> & {
  confidenceNotes: string[];
  graph: T["graph"];
  readDiagnostics: CanonicalThesisReadDiagnostics;
} {
  const confidence = normalizeThesisStringList(row.confidenceNotes);
  const graph = normalizeThesisRecord(row.graph);
  return {
    ...row,
    confidenceNotes: confidence.value,
    graph: graph.value as T["graph"],
    readDiagnostics: {
      confidenceNotes: confidence.diagnostic,
      graph: graph.diagnostic,
      collections: {},
    } satisfies CanonicalThesisReadDiagnostics,
  };
}

/** The canonical compilation list shares the same collection discipline. */
export function normalizeCanonicalThesisRead(input: {
  confidenceNotes: unknown;
  compiledFilters: unknown;
  scoringWeights: unknown;
  evidenceRequirements: unknown;
  autoDisqualifiers: unknown;
}) {
  const confidence = normalizeThesisStringList(input.confidenceNotes);
  const compiledFilters = normalizeThesisRecord(input.compiledFilters);
  const scoringWeights = normalizeThesisArray(input.scoringWeights);
  const evidenceRequirements = normalizeThesisStringList(input.evidenceRequirements);
  const autoDisqualifiers = normalizeThesisStringList(input.autoDisqualifiers);
  return {
    confidenceNotes: confidence.value,
    compiledFilters: compiledFilters.value ?? {},
    scoringWeights: scoringWeights.value,
    evidenceRequirements: evidenceRequirements.value,
    autoDisqualifiers: autoDisqualifiers.value,
    readDiagnostics: {
      confidenceNotes: confidence.diagnostic,
      graph: absentDiagnostic(),
      collections: {
        compiledFilters: compiledFilters.diagnostic,
        scoringWeights: scoringWeights.diagnostic,
        evidenceRequirements: evidenceRequirements.diagnostic,
        autoDisqualifiers: autoDisqualifiers.diagnostic,
      },
    } satisfies CanonicalThesisReadDiagnostics,
  };
}
