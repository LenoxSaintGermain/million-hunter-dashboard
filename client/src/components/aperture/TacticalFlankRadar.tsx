import React from "react";
import { Zap, Globe, Calendar, ShieldCheck, ShieldAlert, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { monitoringFindingHref, monitoringFindingVersion, type VersionedMonitoringFinding } from "@shared/monitoringFinding";

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
  selectedKey?: string;
  onSelectFlank?: (key: string) => void;
  resolvedFindingKeys?: Set<string>;
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
  selectedKey,
  onSelectFlank,
  resolvedFindingKeys,
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
      const checkVersionKey = `${matchedCheck.id}:${monitoringFindingVersion(matchedCheck)}`;
      const isResolved = resolvedFindingKeys?.has(checkVersionKey) ?? false;

      if (isResolved) {
        state = "Reviewed / Intact";
        bias = "Intact";
      } else if (matchedCheck.flagged) {
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
            className={`text-[11px] font-mono px-2 py-0.5 font-bold ${
              needsReviewCount === 0 ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : ""
            }`}
          >
            {needsReviewCount > 0 ? `${needsReviewCount} NEEDS REVIEW` : "ALL CHECKS INTACT"}
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

      {/* Master Flank Navigation List */}
      <div className="space-y-2">
        {rows.map((row) => {
          const isSelected = selectedKey === row.key;
          const isFlagged = row.state === "Needs review";
          const isReviewed = row.state === "Reviewed / Intact";

          const handleSelect = () => {
            onSelectFlank?.(row.key);
            if (row.check && order && candidate && onOpenFinding) {
              onOpenFinding(
                monitoringFindingHref({
                  ...row.check,
                  runId,
                  candidateId: candidate.id,
                  orderId: order.id,
                })
              );
            }
          };

          return (
            <div
              key={row.key}
              role="button"
              tabIndex={0}
              onClick={handleSelect}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect();
                }
              }}
              className={`group relative rounded-xl border p-3 transition-all text-left cursor-pointer select-none ${
                isSelected
                  ? "border-primary/60 bg-primary/10 shadow-sm ring-1 ring-primary/30 border-l-4 border-l-primary"
                  : "border-border/60 hover:bg-muted/30 hover:border-border"
              }`}
            >
              {/* Top Row: Icon + Category Name + Status Badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-muted/40 group-hover:bg-muted/70 transition-colors">
                    {row.icon}
                  </div>
                  <span className="text-xs font-bold tracking-tight text-foreground">
                    {row.category}
                  </span>
                </div>

                {isFlagged ? (
                  <Badge variant="destructive" className="text-[10px] font-mono px-2 py-0.5 font-bold bg-amber-500/15 text-amber-500 border border-amber-500/40 animate-pulse">
                    ● NEEDS REVIEW
                  </Badge>
                ) : isReviewed ? (
                  <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 font-bold border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                    ✓ REVIEWED · INTACT
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0.5 font-medium text-muted-foreground border border-border/40">
                    INTACT
                  </Badge>
                )}
              </div>

              {/* Subtitle / Excerpt: Bias pill + Truncated headline snippet */}
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium font-mono shrink-0 ${
                    isFlagged
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      : isReviewed
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-muted/40 text-muted-foreground border border-border/30"
                  }`}>
                    {row.bias}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground leading-normal" title={row.synthesis}>
                    {row.synthesis}
                  </span>
                </div>
                <ArrowRight className={`h-3 w-3 shrink-0 transition-transform ${isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5"}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
