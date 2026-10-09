import { useId } from "react";
import "@/styles/capital-decision-atlas.css";

export type DecisionAtlasLane = { id: string; label: string; count: number | null; detail: string };
export function atlasCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Independent magnitudes, not a funnel or a percentage of portfolio risk. */
export function CapitalDecisionAtlas({ title, caption, lanes, selected, onSelect }: {
  title: string; caption: string; lanes: DecisionAtlasLane[]; selected?: string;
  onSelect?: (id: string) => void;
}) {
  const id = useId();
  const maximum = Math.max(1, ...lanes.map(lane => atlasCount(lane.count) ?? 0));
  return <section className="capital-decision-atlas" aria-labelledby={`${id}-heading`}>
    <header><h2 id={`${id}-heading`}>{title}</h2><p>{caption}</p></header>
    <div className="capital-decision-atlas-rows" data-lanes={lanes.length}>
      {lanes.map(lane => {
        const count = atlasCount(lane.count);
        const content = <>
          <span className="capital-decision-atlas-label">{lane.label}<strong>{count ?? "Unknown"}</strong></span>
          <svg viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <rect width="400" height="14" y="3" className="atlas-track" />
            {count == null ? <path d="M0 10H400" className="atlas-unknown" /> : <rect width={count / maximum * 400} height="14" y="3" className="atlas-measure" />}
          </svg>
          <span className="capital-decision-atlas-detail">{lane.detail}</span>
        </>;
        return onSelect ? <button key={lane.id} type="button" aria-pressed={selected === lane.id} onClick={() => onSelect(lane.id)}>{content}</button>
          : <div className="capital-decision-atlas-row" key={lane.id}>{content}</div>;
      })}
    </div>
  </section>;
}

/**
 * Sums the counts that were recorded and says how many runs had none (#113).
 * One legacy run without a count no longer blanks the lane; "Unknown" (null)
 * is kept only when no run has a count. A missing count is never read as zero.
 */
export function researchAtlasCounts(runs: readonly { universeCount?: number | null; candidateCount?: number | null }[]) {
  const lane = (key: "universeCount" | "candidateCount") => {
    const counted = runs.map(run => atlasCount(run[key])).filter((value): value is number => value != null);
    return { total: runs.length > 0 && counted.length === 0 ? null : counted.reduce((sum, value) => sum + value, 0), missing: runs.length - counted.length };
  };
  const symbols = lane("universeCount");
  const candidates = lane("candidateCount");
  return { symbols: symbols.total, candidates: candidates.total, symbolsMissing: symbols.missing, candidatesMissing: candidates.missing };
}

/** "Recorded …; 3 runs not counted, so the total is at least this" */
export function atlasMissingNote(detail: string, missing: number, total: number | null): string {
  if (!missing || total == null) return detail;
  return `${detail} · at least this many · ${missing} run${missing === 1 ? "" : "s"} not counted`;
}

/** Frozen illustrative props for the zero-API visual preview; never used as a fallback. */
export const capitalDecisionAtlasFixture: DecisionAtlasLane[] = [
  { id: "choose", label: "Choose", count: 4, detail: "Research journeys · all instruments" },
  { id: "approve", label: "Approve / send", count: 2, detail: "Paper tickets · selected instrument" },
  { id: "monitor", label: "Monitor", count: 7, detail: "Open records · selected instrument" },
];

export const researchDecisionAtlasFixture: DecisionAtlasLane[] = [
  { id: "symbols", label: "Universe entries", count: 24, detail: "Recorded universe counts across chapters; repeats included" },
  { id: "candidates", label: "Candidates", count: 7, detail: "Recorded candidates across chapters; not approvals" },
];
