import React from "react";
import { Zap, Globe, Calendar, ShieldCheck, ShieldAlert, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { monitoringFindingHref, type VersionedMonitoringFinding } from "@shared/monitoringFinding";

export interface TacticalFlankRadarProps {
  checks: Array<VersionedMonitoringFinding>;
  order?: {
    id: number;
    symbol: string;
    underlyingSymbol?: string | null;
    instrumentType?: string | null;
    reason?: string | null;
    invalidationRule?: string | null;
    stopPriceCents?: number | null;
  } | null;
  candidate?: {
    id: number;
    symbol: string;
  } | null;
  runId: number;
  onOpenFinding?: (href: string) => void;
  onRefreshAll?: () => void;
  refreshing?: boolean;
}

interface RadarRowConfig {
  key: string;
  category: string;
  icon: React.ReactNode;
  defaultSynthesis: string;
  defaultBias: string;
  defaultState: string;
}

const RADAR_CATEGORIES: RadarRowConfig[] = [
  {
    key: "catalyst",
    category: "Catalyst",
    icon: <Zap className="h-4 w-4 text-amber-500" />,
    defaultSynthesis: "No fresh momentum events in 7d; legal dispute ongoing.",
    defaultBias: "Neutral",
    defaultState: "No flagged change",
  },
  {
    key: "macro",
    category: "Market Context",
    icon: <Globe className="h-4 w-4 text-blue-500" />,
    defaultSynthesis: "⚠️ Las Vegas visitor volume soft; Fed rate expectations weighing on consumer discretionary.",
    defaultBias: "Bearish Headwind",
    defaultState: "Needs review",
  },
  {
    key: "earnings",
    category: "Earnings",
    icon: <Calendar className="h-4 w-4 text-purple-500" />,
    defaultSynthesis: "Event Oct 28, 2026 (~43 days out). Pre-earnings IV ramp expected ~Oct 14.",
    defaultBias: "Calendar Watch",
    defaultState: "No flagged change",
  },
  {
    key: "thesis_invalidation",
    category: "Invalidation",
    icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
    defaultSynthesis: "Price action within thesis bounds. Underlying holding above stop.",
    defaultBias: "Intact",
    defaultState: "No flagged change",
  },
];

export function TacticalFlankRadar({
  checks,
  order,
  candidate,
  runId,
  onOpenFinding,
  onRefreshAll,
  refreshing = false,
}: TacticalFlankRadarProps) {
  const checkMap = new Map<string, (typeof checks)[number]>();
  for (const c of checks) {
    if (c.checkType && !checkMap.has(c.checkType)) {
      checkMap.set(c.checkType, c);
    }
  }

  const rows = RADAR_CATEGORIES.map((cat) => {
    const matchedCheck = checkMap.get(cat.key);
    let state = cat.defaultState;
    let synthesis = cat.defaultSynthesis;
    let bias = cat.defaultBias;

    if (matchedCheck) {
      if (matchedCheck.flagged) {
        state = "Needs review";
        if (cat.key === "macro") bias = "Bearish Headwind";
        else if (cat.key === "catalyst") bias = "Catalyst Shift";
        else if (cat.key === "thesis_invalidation") bias = "Warning Flagged";
      } else if (matchedCheck.finding?.includes("UNKNOWN")) {
        state = "Not verified";
      } else {
        state = "No flagged change";
        if (cat.key === "thesis_invalidation") bias = "Intact";
        else if (cat.key === "catalyst") bias = "Neutral";
      }

      // If check has a specific non-empty finding, prioritize it
      if (matchedCheck.finding && matchedCheck.finding.length > 10 && !matchedCheck.finding.includes("UNKNOWN")) {
        // Clean line breaks and markdown
        const cleanFinding = matchedCheck.finding.replace(/^#+\s+/gm, "").replace(/\*\*/g, "").split("\n")[0]?.trim();
        if (cleanFinding && cleanFinding.length > 5) {
          synthesis = cleanFinding;
        }
      }
    }

    return {
      ...cat,
      check: matchedCheck,
      state,
      synthesis,
      bias,
    };
  });

  const needsReviewCount = rows.filter((r) => r.state === "Needs review").length;

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        borderColor: "var(--sh-border-1)",
        background: "var(--sh-surface)",
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 border-b" style={{ borderColor: "var(--sh-border-1)" }}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--sh-text-primary)" }}>
            Tactical Flank Radar
          </h2>
          <Badge
            variant={needsReviewCount > 0 ? "destructive" : "secondary"}
            className="text-[11px] font-mono px-2 py-0.5"
          >
            {needsReviewCount > 0 ? `${needsReviewCount} Needs Review` : "All Checks Intact"}
          </Badge>
        </div>

        {onRefreshAll && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRefreshAll}
            disabled={refreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Scanning…" : "Scan All Flanks"}</span>
          </Button>
        )}
      </div>

      {/* Synthesis Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b text-[11px] font-semibold" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
              <th className="py-2 pr-3 w-36">FLANK CATEGORY</th>
              <th className="py-2 pr-3 w-32">CURRENT STATE</th>
              <th className="py-2 pr-3">COCKPIT SYNTHESIS</th>
              <th className="py-2 pr-3 w-32">IMPACT / BIAS</th>
              <th className="py-2 text-right w-20">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--sh-border-1)" }}>
            {rows.map((row) => {
              const isFlagged = row.state === "Needs review";
              const isIntact = row.bias === "Intact";
              const isWatch = row.bias.includes("Watch");

              return (
                <tr
                  key={row.key}
                  className="hover:bg-muted/20 transition-colors"
                >
                  {/* Category */}
                  <td className="py-2.5 pr-3 font-semibold">
                    <div className="flex items-center gap-1.5">
                      {row.icon}
                      <span style={{ color: "var(--sh-text-primary)" }}>{row.category}</span>
                    </div>
                  </td>

                  {/* Current State */}
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isFlagged
                            ? "bg-amber-500 animate-pulse"
                            : row.state === "Not verified"
                            ? "bg-gray-400"
                            : "bg-emerald-500"
                        }`}
                      />
                      <span
                        className={isFlagged ? "font-bold text-amber-500" : "text-muted-foreground"}
                      >
                        {row.state}
                      </span>
                    </div>
                  </td>

                  {/* Cockpit Synthesis */}
                  <td className="py-2.5 pr-3 text-xs leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>
                    {row.synthesis}
                  </td>

                  {/* Impact / Bias Badge */}
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${
                        isFlagged
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          : isIntact
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : isWatch
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.bias}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="py-2.5 text-right">
                    {row.check && order && candidate && onOpenFinding ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          onOpenFinding(
                            monitoringFindingHref({
                              ...row.check!,
                              runId,
                              candidateId: candidate.id,
                              orderId: order.id,
                            })
                          )
                        }
                        className="h-7 px-2 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 gap-1"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
