import React from "react";
import { Button } from "@/components/ui/button";
import { monitoringFindingVersion, type VersionedMonitoringFinding } from "@shared/monitoringFinding";
import { monitoringFindingPresentation } from "@shared/monitoringState";

export interface TacticalFlankRadarProps {
  checks: VersionedMonitoringFinding[];
  order?: { id: number; symbol: string; underlyingSymbol?: string | null; instrumentType?: "shares" | "long_call" | "long_put" | null; reason?: string | null; invalidationRule?: string | null; stopPriceCents?: number | null } | null;
  candidate?: { id: number; symbol: string } | null;
  runId: number;
  selectedKey?: string;
  onSelectFlank?: (key: string) => void;
  resolvedFindingKeys?: Set<string>;
  onOpenFinding?: (href: string) => void;
  onRefreshAll?: () => void;
  refreshing?: boolean;
}
const categories = [["catalyst", "Catalyst"], ["macro", "Market context"], ["earnings", "Earnings"], ["thesis_invalidation", "Invalidation"]] as const;

/** Missing evidence stays missing; review receipts never establish market validity. */
export function TacticalFlankRadar({ checks, order, selectedKey, onSelectFlank, resolvedFindingKeys, onRefreshAll, refreshing }: TacticalFlankRadarProps) {
  return <section className="rounded-xl border p-4 space-y-3" aria-label="Recorded monitoring categories">
    <h2 className="font-semibold">Recorded checks</h2>
    {categories.map(([key, label]) => {
      const check = checks.filter(c => c.checkType === key).sort((a, b) => b.checkedAt - a.checkedAt || b.id - a.id)[0];
      const presentation = check ? monitoringFindingPresentation({ check, instrument: order }) : null;
      const reviewed = check && resolvedFindingKeys?.has(`${check.id}:${monitoringFindingVersion(check)}`);
      return <button type="button" key={key} className="block w-full min-h-11 rounded-lg border p-3 text-left" aria-pressed={selectedKey === key} onClick={() => onSelectFlank?.(key)}>
        <span className="font-semibold">{label}</span><span className="block text-sm">{reviewed ? "Review recorded · not a current verification" : presentation?.stateLabel ?? "Not checked"}</span>
        <span className="block text-sm">{presentation?.summary ?? "Run sourced checks for this play before drawing a conclusion."}</span>
      </button>;
    })}
    {onRefreshAll && <Button className="min-h-11" variant="outline" disabled={refreshing} onClick={onRefreshAll}>{refreshing ? "Checking…" : "Refresh sourced checks"}</Button>}
  </section>;
}
