export type ExposureSource = "holding" | "intended" | "candidate" | string | null;

export interface ExposureInput {
  label: string;
  path: string;
  depth: number;
}

export interface CoverageInput {
  nodePath: string;
  symbol: string;
  source: ExposureSource;
}

export interface ExposureTheme {
  key: string;
  theme: string;
  context: string;
  covered: boolean;
  symbols: string[];
  source: ExposureSource;
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Supports legacy `a > b`, slash paths, and accidental `.children.` serialization. */
export function exposureSegments(raw: string): string[] {
  const normalized = raw
    .replace(/\.children\./gi, " › ")
    .replace(/\s*>\s*/g, " › ")
    .replace(/\s*\/\s*/g, " › ");
  return normalized
    .split("›")
    .map((segment) => titleCase(segment))
    .filter(Boolean);
}

export function friendlyExposureTheme(raw: string): { theme: string; context: string } {
  const segments = exposureSegments(raw);
  const theme = segments.at(-1) ?? "Unlabeled research theme";
  const context = segments.slice(0, -1).slice(-2).join(" · ");
  return { theme, context };
}

export function buildExposureThemes(nodes: ExposureInput[], coverage: CoverageInput[]): ExposureTheme[] {
  const hasNestedDepth = nodes.some((node) => node.depth > 0);
  const coverageByPath = new Map<string, CoverageInput[]>();
  coverage.forEach((item) => {
    const existing = coverageByPath.get(item.nodePath) ?? [];
    existing.push(item);
    coverageByPath.set(item.nodePath, existing);
  });

  return nodes
    // Newer theses include roots plus nested nodes. Legacy brief snapshots hold
    // only flat root-level leaves, which are still valid research themes.
    .filter((node) => !hasNestedDepth || node.depth > 0)
    .map((node) => {
      const matches = coverageByPath.get(node.path) ?? [];
      const friendly = friendlyExposureTheme(node.label || node.path);
      return {
        key: node.path,
        theme: friendly.theme,
        context: friendly.context,
        covered: matches.length > 0,
        symbols: Array.from(new Set(matches.map((match) => match.symbol))),
        source: matches[0]?.source ?? null,
      };
    })
    .sort((a, b) => Number(a.covered) - Number(b.covered) || a.theme.localeCompare(b.theme));
}
