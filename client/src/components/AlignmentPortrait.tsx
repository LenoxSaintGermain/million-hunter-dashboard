import React, { useId, useState } from "react";
import { alignmentGeometry, formatAlignment, type AlignmentMeasure } from "@shared/alignmentPortrait";
import { ArrowUpRight, Fingerprint, ScanLine } from "lucide-react";
import "@/styles/hunter-harness.css";

/** The same visual grammar for assets and capital; adapters own units and provenance. */
export function AlignmentPortrait({ title, subtitle, measures, compact = false, stale = false }: {
  title: string; subtitle: string; measures: AlignmentMeasure[]; compact?: boolean; stale?: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const active = measures.find(row => row.id === selected);
  return <figure className={`alignment-portrait ${compact ? "alignment-portrait--compact" : ""}`} aria-labelledby={`${id}-title`}>
    <figcaption className="portrait-masthead"><span><Fingerprint size={16} aria-hidden="true" /> Signal Hunter / alignment portrait</span><ScanLine size={20} aria-hidden="true" /></figcaption>
    <div className="portrait-heading"><h3 id={`${id}-title`}>{title}</h3><p>{subtitle}</p></div>
    {stale && <p role="status" className="portrait-stale">Saved snapshot is stale. Recheck before relying on it.</p>}
    <div className="portrait-measures">
      {measures.map(row => {
        const geometry = alignmentGeometry(row);
        const missing = row.value == null || !Number.isFinite(row.value);
        return <button key={row.id} type="button" className="portrait-measure" data-selected={selected === row.id} data-missing={missing}
          aria-expanded={selected === row.id} aria-controls={`${id}-detail`} onClick={() => setSelected(selected === row.id ? null : row.id)}>
          <span className="portrait-measure-label">{row.label}<ArrowUpRight size={13} aria-hidden="true" /></span>
          <strong>{missing ? row.wanted : formatAlignment(row.value, row.unit)}</strong>
          {geometry ? <span className="portrait-axis" aria-hidden="true"><span className="portrait-band" style={{ left: `${geometry.left}%`, width: `${geometry.width}%` }} /><span className="portrait-point" data-basis={row.basis} style={{ left: `${geometry.point}%` }} /></span>
            : <span className="portrait-pencil" aria-hidden="true" />}
          <span className="portrait-measure-note">{missing ? "Wanted · evidence needed" : `${row.basis}${geometry ? geometry.fits ? " · within target" : " · outside target" : " · no complete target range"}`}</span>
        </button>;
      })}
    </div>
    <div id={`${id}-detail`} className="portrait-reveal" hidden={!active}>
      {active && <><strong>{active.label}</strong><p>{active.explanation}</p>{alignmentGeometry(active) && <p>Target: {formatAlignment(active.min!, active.unit)}–{formatAlignment(active.max!, active.unit)}. Scale: 0–{formatAlignment(alignmentGeometry(active)!.ceiling, active.unit)}.</p>}</>}
    </div>
    <p className="portrait-key">Band = thesis target · hollow dot = reported or modeled · solid dot = corroborated. Separate scales, never a quality score.</p>
  </figure>;
}
