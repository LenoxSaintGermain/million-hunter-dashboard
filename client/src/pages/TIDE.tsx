/**
 * TIDE — Temporal Intelligence for Deployment Events
 * Phase 1: Political Capital Deployment
 *
 * Editorial Finance design system — warm bone/paper, Fraunces display,
 * contextual "why this matters" explanations, no raw FEC dump links.
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { MapView } from "@/components/Map";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, TrendingUp, MapPin, AlertTriangle, CheckCircle2,
  Clock, ArrowRight, BarChart2, Loader2, Target, BookOpen,
  Archive, RefreshCw, ChevronDown, ChevronUp, Info, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type FlowCategory =
  | "infrastructure" | "defense" | "healthcare" | "housing"
  | "energy" | "education" | "agriculture" | "technology"
  | "finance" | "other";
type SignalType =
  | "infrastructure_surge" | "defense_pivot" | "housing_push"
  | "energy_transition" | "healthcare_expansion" | "government_expansion" | "other";

interface CapitalFlow {
  id: number;
  source: "usaspending" | "federal_register" | "fec";
  entity: string;
  amount: number | null;
  geography: string;
  category: FlowCategory;
  flow_date: string;
  raw_title: string;
  source_url: string;
  confidence: number;
}
interface ConvergenceEvent {
  id: number;
  geography: string;
  signal_type: SignalType;
  total_capital: number;
  thesis_seed: string;
  confidence: number;
  status: "active" | "archived" | "converted_to_thesis";
  created_at: string;
}
interface Prediction {
  id: number;
  claim: string;
  geography: string;
  category: string;
  confidence: number;
  outcome: "confirmed" | "disconfirmed" | "pending";
  predicted_at: string;
}

// ─── Number formatting ────────────────────────────────────────────────────────
function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<FlowCategory, { text: string; bg: string; border: string }> = {
  infrastructure: { text: "var(--amber)",     bg: "oklch(0.66 0.14 55 / 0.08)",  border: "oklch(0.66 0.14 55 / 0.25)" },
  defense:        { text: "var(--clay)",      bg: "oklch(0.55 0.14 28 / 0.08)",  border: "oklch(0.55 0.14 28 / 0.25)" },
  healthcare:     { text: "var(--sage)",      bg: "oklch(0.55 0.06 155 / 0.08)", border: "oklch(0.55 0.06 155 / 0.25)" },
  housing:        { text: "var(--sh-cyan)",   bg: "oklch(0.45 0.08 220 / 0.08)", border: "oklch(0.45 0.08 220 / 0.25)" },
  energy:         { text: "var(--amber)",     bg: "oklch(0.66 0.14 55 / 0.08)",  border: "oklch(0.66 0.14 55 / 0.25)" },
  education:      { text: "var(--sh-violet)", bg: "oklch(0.45 0.10 290 / 0.08)", border: "oklch(0.45 0.10 290 / 0.25)" },
  agriculture:    { text: "var(--sage)",      bg: "oklch(0.55 0.06 155 / 0.08)", border: "oklch(0.55 0.06 155 / 0.25)" },
  technology:     { text: "var(--sh-cyan)",   bg: "oklch(0.45 0.08 220 / 0.08)", border: "oklch(0.45 0.08 220 / 0.25)" },
  finance:        { text: "var(--amber)",     bg: "oklch(0.66 0.14 55 / 0.08)",  border: "oklch(0.66 0.14 55 / 0.25)" },
  other:          { text: "var(--sh-fg-3)",   bg: "var(--sh-primary-8)", border: "var(--rule)" },
};

const SIGNAL_LABELS: Record<SignalType, string> = {
  infrastructure_surge:   "Infrastructure Surge",
  defense_pivot:          "Defense Pivot",
  housing_push:           "Housing Push",
  energy_transition:      "Energy Transition",
  healthcare_expansion:   "Healthcare Expansion",
  government_expansion:   "Government Expansion",
  other:                  "Capital Convergence",
};

const SOURCE_LABELS: Record<string, { label: string; description: string }> = {
  usaspending:      { label: "Federal Contract",  description: "A federal contract award tracked via USASpending.gov — direct government spending in this geography." },
  federal_register: { label: "Regulatory Signal", description: "A Federal Register notice — regulatory activity that often precedes capital deployment or policy-driven demand." },
  fec:              { label: "Political Capital",  description: "A PAC or campaign finance filing — political money flowing into this market, often a leading indicator of policy priorities." },
};

const SIGNAL_WHY_IT_MATTERS: Record<SignalType, string> = {
  infrastructure_surge:   "Multiple federal infrastructure contracts are converging on this geography. This typically precedes 18–36 months of elevated construction, logistics, and services demand.",
  defense_pivot:          "Defense spending is concentrating here. Defense contractors, staffing firms, and adjacent services businesses tend to see sustained revenue growth in these corridors.",
  housing_push:           "Federal housing programs and subsidies are flowing into this market. Demand for property management, maintenance, and related services typically follows.",
  energy_transition:      "Energy infrastructure investment is accelerating here. Electrical contractors, equipment suppliers, and workforce training providers are positioned to benefit.",
  healthcare_expansion:   "Healthcare facility funding and regulatory approvals are clustering in this area. Medical staffing, supply chain, and ancillary services see compounding demand.",
  government_expansion:   "Government agency expansion is underway. Administrative services, IT, facilities management, and professional services contracts typically follow.",
  other:                  "Multiple capital signals are converging in this geography. The pattern suggests elevated economic activity across several sectors.",
};

const SUGGESTED_GEOS = [
  "Atlanta, GA", "Charlotte, NC", "Miami, FL", "Dallas, TX",
  "Nashville, TN", "Phoenix, AZ", "Denver, CO", "Washington, DC",
];

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── FlowCard ─────────────────────────────────────────────────────────────────
function FlowCard({ flow }: { flow: CapitalFlow }) {
  const [expanded, setExpanded] = useState(false);
  const colors = CATEGORY_COLORS[flow.category] || CATEGORY_COLORS.other;
  const sourceInfo = SOURCE_LABELS[flow.source] || { label: flow.source, description: "" };
  const rawAmount = flow.amount ? flow.amount / 100 : null;
  const amountStr = rawAmount ? fmtMoney(rawAmount) : null;
  const isSignificantAmount = rawAmount != null && rawAmount >= 1_000_000;
  // Format date — cap future dates at today
  const flowDateDisplay = (() => {
    if (!flow.flow_date) return "—";
    try {
      const d = new Date(flow.flow_date);
      const now = new Date();
      const display = d > now ? now : d;
      return display.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return flow.flow_date; }
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: EASE }}
      style={{ borderBottom: "1px solid var(--rule)", paddingTop: 14, paddingBottom: 14 }}
      className="last:border-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider"
              style={{ color: colors.text, background: colors.bg, borderColor: colors.border }}
            >
              {flow.category}
            </span>
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded-full border"
              style={{ color: "var(--sh-fg-4)", background: "var(--bone)", borderColor: "var(--rule)" }}
            >
              {sourceInfo.label}
            </span>
            {amountStr && (
              <span 
                className="font-mono text-[10px] tabular-nums"
                style={{ 
                  color: isSignificantAmount ? "var(--amber)" : "var(--sh-fg-3)", 
                  fontWeight: isSignificantAmount ? 600 : 400 
                }}
              >
                {amountStr}
              </span>
            )}
          </div>
          <p
            className="text-sm leading-snug"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)", fontWeight: 400, letterSpacing: "-0.01em" }}
          >
            {flow.entity}
          </p>
          {sourceInfo.description && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--sh-fg-3)" }}>
              {sourceInfo.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--sh-fg-4)" }}>
            {flowDateDisplay}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ color: "var(--sh-fg-4)" }}
            className="hover:opacity-70 transition-opacity"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 flex items-center gap-4 flex-wrap" style={{ borderTop: "1px solid var(--rule)" }}>
              <div className="flex items-center gap-1 text-xs" style={{ color: "var(--sh-fg-3)" }}>
                <MapPin className="h-3 w-3" />
                {flow.geography}
              </div>
              <div className="text-xs font-mono tabular-nums" style={{ color: "var(--sh-fg-4)" }}>
                Confidence: {fmtPct(flow.confidence)}
              </div>
              <div className="text-xs italic" style={{ color: "var(--sh-fg-4)" }}>
                "{flow.raw_title}"
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── ConvergenceCard ──────────────────────────────────────────────────────────
function ConvergenceCard({
  event,
  onArchive,
  onConvert,
}: {
  event: ConvergenceEvent;
  onArchive: (id: number) => void;
  onConvert: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const capitalStr = event.total_capital ? fmtMoney(event.total_capital / 100) : null;
  const isHighConf = event.confidence >= 0.8;
  const whyItMatters = SIGNAL_WHY_IT_MATTERS[event.signal_type as SignalType] || SIGNAL_WHY_IT_MATTERS.other;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: EASE }}
      className="rounded-lg border p-4 mb-3 last:mb-0"
      style={{
        borderColor: isHighConf ? "oklch(0.66 0.14 55 / 0.35)" : "var(--rule)",
        background: isHighConf ? "oklch(0.66 0.14 55 / 0.04)" : "var(--bone)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="h-3.5 w-3.5" style={{ color: isHighConf ? "var(--amber)" : "var(--sh-fg-3)" }} />
            <span className="eyebrow" style={{ color: isHighConf ? "var(--amber)" : "var(--sh-fg-3)" }}>
              {SIGNAL_LABELS[event.signal_type as SignalType] || "Convergence"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.01em" }}>
              {event.geography}
            </span>
            {capitalStr && (
              <span className="font-mono text-xs tabular-nums" style={{ color: "var(--amber)" }}>
                {capitalStr} tracked
              </span>
            )}
          </div>
        </div>
        <span
          className="font-mono text-xs tabular-nums px-2 py-0.5 rounded-full"
          style={{
            color: isHighConf ? "var(--amber)" : "var(--sh-fg-3)",
            background: isHighConf ? "oklch(0.66 0.14 55 / 0.10)" : "var(--bone)",
            border: "1px solid var(--rule)",
          }}
        >
          {fmtPct(event.confidence)}
        </span>
      </div>

      <div className="mb-3 p-3 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Info className="h-3 w-3" style={{ color: "var(--amber)" }} />
          <span className="eyebrow" style={{ color: "var(--amber)" }}>Why this matters</span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--sh-fg-2)" }}>
          {whyItMatters}
        </p>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 mb-2 text-xs transition-opacity hover:opacity-70"
        style={{ color: "var(--sh-fg-3)" }}
      >
        Thesis seed {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p
              className="text-xs leading-relaxed mb-3 pl-3 italic"
              style={{ color: "var(--sh-fg-2)", borderLeft: "2px solid oklch(0.66 0.14 55 / 0.35)" }}
            >
              {event.thesis_seed}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2"
          style={{ borderColor: "oklch(0.66 0.14 55 / 0.35)", color: "var(--amber)" }}
          onClick={() => onConvert(event.id)}
        >
          <BookOpen className="h-3 w-3 mr-1" />
          Send to Thesis Engine
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2"
          style={{ color: "var(--sh-fg-4)" }}
          onClick={() => onArchive(event.id)}
        >
          <Archive className="h-3 w-3 mr-1" />
          Archive
        </Button>
      </div>
    </motion.div>
  );
}

// ─── PredictionRow ────────────────────────────────────────────────────────────
function PredictionRow({ prediction, onUpdate }: {
  prediction: Prediction;
  onUpdate: (id: number, outcome: "confirmed" | "disconfirmed") => void;
}) {
  const outcomeIcon = {
    confirmed:    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--sage)" }} />,
    disconfirmed: <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--clay)" }} />,
    pending:      <Clock className="h-3.5 w-3.5" style={{ color: "var(--sh-fg-4)" }} />,
  }[prediction.outcome];

  return (
    <div className="flex items-start gap-3 py-2.5 last:border-0" style={{ borderBottom: "1px solid var(--rule)" }}>
      <div className="mt-0.5">{outcomeIcon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-snug" style={{ color: "var(--ink)" }}>{prediction.claim}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-[10px]" style={{ color: "var(--sh-fg-4)" }}>{prediction.geography}</span>
          <span style={{ color: "var(--rule)" }}>·</span>
          <span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--sh-fg-4)" }}>{fmtPct(prediction.confidence)} conf</span>
        </div>
      </div>
      {prediction.outcome === "pending" && (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onUpdate(prediction.id, "confirmed")}
            className="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
            style={{ borderColor: "oklch(0.55 0.06 155 / 0.35)", color: "var(--sage)" }}
          >✓</button>
          <button
            onClick={() => onUpdate(prediction.id, "disconfirmed")}
            className="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
            style={{ borderColor: "oklch(0.55 0.14 28 / 0.35)", color: "var(--clay)" }}
          >✗</button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TIDEPage() {
  const { toast } = useToast();
  const [geography, setGeography] = useState("Atlanta, GA");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showPredictions, setShowPredictions] = useState(false);
  const [newPrediction, setNewPrediction] = useState("");

  const flowsQuery = trpc.tide.listFlows.useQuery({ limit: 50 });
  const convergenceQuery = trpc.tide.listConvergence.useQuery({ status: "active", limit: 20 });
  const predictionsQuery = trpc.tide.listPredictions.useQuery({ limit: 30 });

  const scanMutation = trpc.tide.scan.useMutation({
    onSuccess: (data) => {
      toast({ title: "TIDE Scan Complete", description: data.message });
      flowsQuery.refetch();
      convergenceQuery.refetch();
    },
    onError: (err) => {
      toast({ title: "TIDE Scan Failed", description: err.message, variant: "destructive" });
    },
  });
  const archiveMutation = trpc.tide.archiveConvergence.useMutation({
    onSuccess: () => convergenceQuery.refetch(),
  });
  const convertMutation = trpc.tide.convertToThesis.useMutation({
    onSuccess: (data) => {
      toast({ title: "Thesis Seed Ready", description: `"${data.thesisSeed.slice(0, 80)}..." — navigate to Thesis Engine to compile.` });
      convergenceQuery.refetch();
    },
  });
  const logPredictionMutation = trpc.tide.logPrediction.useMutation({
    onSuccess: () => {
      setNewPrediction("");
      predictionsQuery.refetch();
      toast({ title: "Prediction logged", description: "Track record updated." });
    },
  });
  const updateOutcomeMutation = trpc.tide.updateOutcome.useMutation({
    onSuccess: () => predictionsQuery.refetch(),
  });

  const flows: CapitalFlow[] = (flowsQuery.data as any[]) || [];
  const convergenceEvents: ConvergenceEvent[] = (convergenceQuery.data as any[]) || [];
  const predictions: Prediction[] = (predictionsQuery.data as any[]) || [];

  const filteredFlows = useMemo(() => {
    // Filter out very small Political Capital amounts (FEC filings under $500 are noise)
    const meaningful = flows.filter((f) => {
      if (f.source === "fec" && f.amount && f.amount / 100 < 500) return false;
      return true;
    });
    if (filterCategory === "all") return meaningful;
    return meaningful.filter((f) => f.category === filterCategory);
  }, [flows, filterCategory]);

  const totalCapital = flows.reduce((s, f) => s + (f.amount || 0), 0);
  const confirmedPredictions = predictions.filter((p) => p.outcome === "confirmed").length;
  const totalPredictions = predictions.filter((p) => p.outcome !== "pending").length;
  const accuracy = totalPredictions > 0 ? Math.round((confirmedPredictions / totalPredictions) * 100) : null;

  const categories = useMemo(() => {
    const cats = new Set(flows.map((f) => f.category));
    return ["all", ...Array.from(cats)];
  }, [flows]);

  // ── Geography → lat/lng lookup for map markers ──────────────────────────────
  const GEO_COORDS: Record<string, { lat: number; lng: number }> = {
    "Atlanta, GA":      { lat: 33.749, lng: -84.388 },
    "Charlotte, NC":    { lat: 35.227, lng: -80.843 },
    "Miami, FL":        { lat: 25.761, lng: -80.191 },
    "Dallas, TX":       { lat: 32.776, lng: -96.796 },
    "Nashville, TN":    { lat: 36.162, lng: -86.781 },
    "Phoenix, AZ":      { lat: 33.448, lng: -112.074 },
    "Denver, CO":       { lat: 39.739, lng: -104.984 },
    "Washington, DC":   { lat: 38.907, lng: -77.036 },
    "Houston, TX":      { lat: 29.760, lng: -95.369 },
    "Chicago, IL":      { lat: 41.878, lng: -87.629 },
    "Los Angeles, CA":  { lat: 34.052, lng: -118.243 },
    "New York, NY":     { lat: 40.712, lng: -74.005 },
    "Seattle, WA":      { lat: 47.606, lng: -122.332 },
    "Austin, TX":       { lat: 30.267, lng: -97.743 },
    "Tampa, FL":        { lat: 27.947, lng: -82.458 },
    "Raleigh, NC":      { lat: 35.779, lng: -78.638 },
  };

  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Build convergence cluster markers from live data
  const clusterPoints = useMemo(() => {
    const geoMap = new Map<string, { count: number; capital: number; types: string[] }>();
    flows.forEach((f) => {
      const geo = f.geography;
      const existing = geoMap.get(geo) || { count: 0, capital: 0, types: [] };
      geoMap.set(geo, {
        count: existing.count + 1,
        capital: existing.capital + (f.amount || 0),
        types: existing.types.includes(f.category) ? existing.types : [...existing.types, f.category],
      });
    });
    convergenceEvents.forEach((e) => {
      const geo = e.geography;
      const existing = geoMap.get(geo) || { count: 0, capital: 0, types: [] };
      geoMap.set(geo, {
        count: existing.count + 2, // convergence events count double
        capital: existing.capital + (e.total_capital || 0),
        types: existing.types.includes(e.signal_type) ? existing.types : [...existing.types, e.signal_type],
      });
    });
    return Array.from(geoMap.entries())
      .map(([geo, data]) => ({ geo, ...data, coords: GEO_COORDS[geo] }))
      .filter((p) => p.coords);
  }, [flows, convergenceEvents]);

  // Place/update markers whenever map or data changes
  useEffect(() => {
    if (!mapRef.current) return;
    // Clear old markers
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];
    clusterPoints.forEach(({ coords, count, capital }) => {
      const size = Math.min(8 + count * 2, 24);
      const el = document.createElement("div");
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:oklch(0.66 0.14 55);border:2px solid oklch(0.85 0.10 55);box-shadow:0 0 ${size}px oklch(0.66 0.14 55 / 0.6);cursor:pointer;`;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position: coords,
        content: el,
        title: `${count} signals · ${fmtMoney(capital / 100)}`,
      });
      markersRef.current.push(marker);
    });
  }, [clusterPoints]);

  return (
    <EditorialTopNav>
      {/* ── TIDE Dark Hero — Stitch Reference Layout ── */}
      <div
        className="-mx-4 sm:-mx-6 lg:-mx-8 mb-0 relative overflow-hidden"
        style={{ background: "oklch(0.10 0.015 250)", borderBottom: "1px solid oklch(0.20 0.015 250)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="px-4 sm:px-6 lg:px-8 pt-10 pb-0"
        >
          {/* Eyebrow + system badge */}
          <div className="flex items-center gap-3 mb-6">
            <span
              className="font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-widest border"
              style={{ color: "oklch(0.66 0.14 55)", borderColor: "oklch(0.66 0.14 55 / 0.35)", background: "oklch(0.66 0.14 55 / 0.08)" }}
            >
              SYSTEM MODULE
            </span>
            <span className="font-mono text-[10px]" style={{ color: "oklch(0.55 0.06 155)" }}>● USASpending.gov ACTIVE</span>
            <span className="font-mono text-[10px]" style={{ color: "oklch(0.45 0.08 220)" }}>● Federal Register LIVE</span>
          </div>

          {/* Hero title */}
          <h1
            className="mb-3 leading-[1.0]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              color: "oklch(0.96 0.005 250)",
            }}
          >
            Temporal Intelligence<br />for Deployment Events
          </h1>
          <p className="mb-8 max-w-2xl" style={{ color: "oklch(0.65 0.01 250)", fontSize: 14, lineHeight: 1.6 }}>
            Ingesting USASpending.gov, Federal Register, and FEC data to detect 18–36 month demand
            implications. The platform closes the information asymmetry gap by deploying frontier AI
            models against government data sources.
          </p>

          {/* Two-column body: Map (left, col-7) + Intelligence Stream (right, col-5) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch" style={{ borderTop: "1px solid oklch(0.20 0.015 250)" }}>
            {/* Left: Real Google Map with convergence clusters */}
            <div className="lg:col-span-7 relative" style={{ borderRight: "1px solid oklch(0.20 0.015 250)" }}>
              <div className="px-0 pt-4 pb-2">
                <p className="font-mono text-[10px] uppercase tracking-widest mb-3 px-4" style={{ color: "oklch(0.45 0.01 250)" }}>
                  CONVERGENCE MAP (90-DAY CLUSTERS)
                </p>
              </div>
              <div style={{ height: 340 }}>
                <MapView
                  initialCenter={{ lat: 36.5, lng: -95.5 }}
                  initialZoom={4}
                  onMapReady={(map) => {
                    mapRef.current = map;
                    // Apply dark map style
                    map.setOptions({
                      styles: [
                        { elementType: "geometry", stylers: [{ color: "#0f0f1e" }] },
                        { elementType: "labels.text.fill", stylers: [{ color: "#4a4a6a" }] },
                        { elementType: "labels.text.stroke", stylers: [{ color: "#0f0f1e" }] },
                        { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1e1e3a" }] },
                        { featureType: "road", stylers: [{ visibility: "off" }] },
                        { featureType: "poi", stylers: [{ visibility: "off" }] },
                        { featureType: "water", elementType: "geometry", stylers: [{ color: "#080818" }] },
                        { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#12121e" }] },
                        { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#2a2a4a" }, { weight: 1 }] },
                        { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#1a1a30" }, { weight: 0.5 }] },
                      ],
                      disableDefaultUI: true,
                      gestureHandling: "greedy",
                    });
                  }}
                />
              </div>
              {/* AI Analyst commentary strip */}
              <div className="px-4 py-3" style={{ borderTop: "1px solid oklch(0.20 0.015 250)" }}>
                <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: "oklch(0.45 0.01 250)" }}>CO-ANALYST INSIGHT</p>
                <p className="text-xs italic leading-relaxed" style={{ color: "oklch(0.55 0.01 250)" }}>
                  {clusterPoints.length > 0
                    ? `SIGNAL OVERLAP (The Scout cross-reference): ${clusterPoints[0]?.geo} shows ${clusterPoints[0]?.count} converging signals totaling ${fmtMoney((clusterPoints[0]?.capital || 0) / 100)} — matches Investor DNA for "${clusterPoints[0]?.types[0] ?? "Infrastructure"} Deployment".`
                    : "Run a TIDE scan to generate AI analyst commentary on convergence patterns."}
                </p>
              </div>
            </div>

            {/* Right: Live Intelligence Stream */}
            <div className="lg:col-span-5 flex flex-col" style={{ maxHeight: 440, overflowY: "auto" }}>
              <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10" style={{ background: "oklch(0.10 0.015 250)", borderBottom: "1px solid oklch(0.20 0.015 250)" }}>
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "oklch(0.45 0.01 250)" }}>INTELLIGENCE STREAM</p>
                <div className="flex items-center gap-1.5">
                  <Radio className="h-3 w-3" style={{ color: "oklch(0.55 0.06 155)" }} />
                  <span className="font-mono text-[10px]" style={{ color: "oklch(0.55 0.06 155)" }}>LIVE</span>
                </div>
              </div>
              {/* Convergence events as stream cards */}
              {convergenceQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: "oklch(0.35 0.01 250)" }} />
                </div>
              ) : convergenceEvents.length === 0 ? (
                <div className="px-4 py-8">
                  <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: "oklch(0.35 0.01 250)" }}>CONVERGENCE EVENT</p>
                  <p className="text-sm font-medium mb-1" style={{ color: "oklch(0.65 0.01 250)" }}>No active signals</p>
                  <p className="text-xs" style={{ color: "oklch(0.40 0.01 250)" }}>Run a TIDE scan to populate the intelligence stream with live government data.</p>
                </div>
              ) : (
                convergenceEvents.slice(0, 8).map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}
                    className="px-4 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: "1px solid oklch(0.18 0.015 250)" }}
                    onClick={() => setGeography(event.geography)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest"
                        style={{
                          color: event.confidence >= 0.8 ? "oklch(0.66 0.14 55)" : "oklch(0.55 0.06 155)",
                          background: event.confidence >= 0.8 ? "oklch(0.66 0.14 55 / 0.10)" : "oklch(0.55 0.06 155 / 0.10)",
                          border: `1px solid ${event.confidence >= 0.8 ? "oklch(0.66 0.14 55 / 0.25)" : "oklch(0.55 0.06 155 / 0.25)"}`,
                        }}
                      >
                        {event.confidence >= 0.8 ? "CONVERGENCE EVENT" : "FEC SIGNAL"}
                      </span>
                      <span className="font-mono text-[10px] shrink-0" style={{ color: "oklch(0.35 0.01 250)" }}>
                        {new Date(event.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-snug mb-1" style={{ color: "oklch(0.85 0.005 250)" }}>
                      {event.thesis_seed?.slice(0, 80) ?? SIGNAL_LABELS[event.signal_type as SignalType] ?? "Capital Convergence"}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "oklch(0.45 0.01 250)" }}>
                      {event.geography} · {fmtPct(event.confidence)} confidence
                    </p>
                    {event.total_capital > 0 && (
                      <p className="font-mono text-[10px] mt-1" style={{ color: "oklch(0.55 0.06 155)" }}>
                        {fmtMoney(event.total_capital / 100)} tracked
                      </p>
                    )}
                  </motion.div>
                ))
              )}
              {/* Capital flows as stream items */}
              {flows.slice(0, 5).map((flow, i) => (
                <motion.div
                  key={`flow-${flow.id}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (convergenceEvents.length + i) * 0.05, duration: 0.4, ease: EASE }}
                  className="px-4 py-4"
                  style={{ borderBottom: "1px solid oklch(0.15 0.015 250)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span
                      className="font-mono text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest"
                      style={{ color: "oklch(0.45 0.08 220)", background: "oklch(0.45 0.08 220 / 0.10)", border: "1px solid oklch(0.45 0.08 220 / 0.25)" }}
                    >
                      FEDERAL REGISTER
                    </span>
                    <span className="font-mono text-[10px] shrink-0" style={{ color: "oklch(0.35 0.01 250)" }}>
                      {new Date(flow.flow_date || Date.now()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-snug mb-1" style={{ color: "oklch(0.75 0.005 250)" }}>
                    {flow.entity?.slice(0, 70)}
                  </p>
                  {flow.amount && flow.amount > 0 && (
                    <p className="font-mono text-[10px]" style={{ color: "oklch(0.45 0.01 250)" }}>
                      {fmtMoney(flow.amount / 100)} · {flow.geography}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Stat strip */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 divide-x"
            style={{ borderTop: "1px solid oklch(0.20 0.015 250)" }}
          >
            {[
              { label: "CAPITAL TRACKED", value: totalCapital > 0 ? fmtMoney(totalCapital / 100) : "—" },
              { label: "ACTIVE EVENTS", value: String(convergenceEvents.length) },
              { label: "ACTIVE DEALS", value: String(flows.length) },
              { label: "ACCURACY", value: accuracy !== null ? `${accuracy}%` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 sm:px-6 py-4">
                <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: "oklch(0.35 0.01 250)" }}>{label}</p>
                <p className="font-mono text-2xl tabular-nums" style={{ color: "oklch(0.85 0.005 250)", fontWeight: 600 }}>{value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Scan Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: EASE }}
        className="mb-6 p-4 rounded-lg"
        style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
              placeholder="Geography (e.g. Atlanta, GA)"
              className="font-mono text-sm"
              style={{ background: "var(--bone)", borderColor: "var(--rule)", color: "var(--ink)" }}
            />
          </div>
          <Button
            onClick={() => scanMutation.mutate({ geography })}
            disabled={scanMutation.isPending || !geography.trim()}
            style={{
              background: scanMutation.isPending ? "oklch(0.18 0.018 250 / 0.5)" : "var(--ink)",
              color: "var(--paper)",
              border: "none",
              fontWeight: 600,
            }}
          >
            {scanMutation.isPending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning…</>
              : <><Zap className="h-4 w-4 mr-2" /> Run TIDE Scan</>
            }
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="eyebrow">Quick:</span>
          {SUGGESTED_GEOS.map((geo) => (
            <button
              key={geo}
              onClick={() => setGeography(geo)}
              className="text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap font-mono transition-colors"
              style={{
                borderColor: geography === geo ? "oklch(0.66 0.14 55 / 0.40)" : "var(--rule)",
                color: geography === geo ? "var(--amber)" : "var(--sh-fg-4)",
                background: geography === geo ? "oklch(0.66 0.14 55 / 0.06)" : "transparent",
              }}
            >
              {geo}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Capital Flow Feed ── */}
        <motion.div
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
          className="lg:col-span-3"
        >
          <div className="rounded-lg overflow-hidden" style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}>
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--rule)", background: "var(--bone)" }}
            >
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" style={{ color: "var(--amber)" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>Capital Flow Feed</span>
                <span className="font-mono text-xs" style={{ color: "var(--sh-fg-4)" }}>({filteredFlows.length})</span>
              </div>
              <button onClick={() => flowsQuery.refetch()} style={{ color: "var(--sh-fg-4)" }} className="hover:opacity-70 transition-opacity">
                <RefreshCw className={cn("h-3.5 w-3.5", flowsQuery.isFetching && "animate-spin")} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--rule)" }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className="text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap font-mono uppercase tracking-wider transition-colors"
                  style={{
                    borderColor: filterCategory === cat ? "oklch(0.66 0.14 55 / 0.40)" : "var(--rule)",
                    color: filterCategory === cat ? "var(--amber)" : "var(--sh-fg-4)",
                    background: filterCategory === cat ? "oklch(0.66 0.14 55 / 0.06)" : "transparent",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="px-4 max-h-[520px] overflow-y-auto">
              {flowsQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--sh-fg-4)" }} />
                </div>
              ) : filteredFlows.length === 0 ? (
                <div className="py-12 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--rule)" }} />
                  <p className="text-sm" style={{ color: "var(--sh-fg-3)" }}>No flows detected yet.</p>
                  <p className="text-xs mt-1" style={{ color: "var(--sh-fg-4)" }}>Run a TIDE scan to populate the feed.</p>
                </div>
              ) : (
                filteredFlows.map((flow) => <FlowCard key={flow.id} flow={flow} />)
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Right: Convergence Events + Predictions ── */}
        <motion.div
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
          className="lg:col-span-2 space-y-4"
        >
          <div className="rounded-lg overflow-hidden" style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}>
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--rule)", background: "var(--bone)" }}
            >
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: "var(--amber)" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>Convergence Events</span>
                {convergenceEvents.length > 0 && (
                  <span
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ color: "var(--amber)", background: "oklch(0.66 0.14 55 / 0.10)", border: "1px solid oklch(0.66 0.14 55 / 0.25)" }}
                  >
                    {convergenceEvents.length}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {convergenceQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--sh-fg-4)" }} />
                </div>
              ) : convergenceEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <Zap className="h-6 w-6 mx-auto mb-2" style={{ color: "var(--rule)" }} />
                  <p className="text-xs" style={{ color: "var(--sh-fg-3)" }}>No convergence events yet.</p>
                  <p className="text-xs mt-1" style={{ color: "var(--sh-fg-4)" }}>Run a TIDE scan to detect patterns.</p>
                </div>
              ) : (
                convergenceEvents.map((event) => (
                  <ConvergenceCard
                    key={event.id}
                    event={event}
                    onArchive={(id) => archiveMutation.mutate({ id })}
                    onConvert={(id) => convertMutation.mutate({ id })}
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg overflow-hidden" style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}>
            <button
              onClick={() => setShowPredictions(!showPredictions)}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors"
              style={{ borderBottom: "1px solid var(--rule)", background: "var(--bone)" }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--sage)" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>Prediction Track Record</span>
                {accuracy !== null && (
                  <span
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ color: "var(--sage)", background: "oklch(0.55 0.06 155 / 0.10)", border: "1px solid oklch(0.55 0.06 155 / 0.25)" }}
                  >
                    {accuracy}% accuracy
                  </span>
                )}
              </div>
              {showPredictions
                ? <ChevronUp className="h-4 w-4" style={{ color: "var(--sh-fg-4)" }} />
                : <ChevronDown className="h-4 w-4" style={{ color: "var(--sh-fg-4)" }} />
              }
            </button>
            <AnimatePresence>
              {showPredictions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pt-3 pb-2" style={{ borderBottom: "1px solid var(--rule)" }}>
                    <div className="flex gap-2">
                      <Input
                        value={newPrediction}
                        onChange={(e) => setNewPrediction(e.target.value)}
                        placeholder="Log a prediction…"
                        className="text-xs h-8"
                        style={{ background: "var(--bone)", borderColor: "var(--rule)", color: "var(--ink)" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newPrediction.trim()) {
                            logPredictionMutation.mutate({ claim: newPrediction.trim(), geography, category: "other", confidence: 0.7 });
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        style={{ borderColor: "var(--rule)", color: "var(--sh-fg-3)" }}
                        disabled={!newPrediction.trim() || logPredictionMutation.isPending}
                        onClick={() => {
                          if (newPrediction.trim()) {
                            logPredictionMutation.mutate({ claim: newPrediction.trim(), geography, category: "other", confidence: 0.7 });
                          }
                        }}
                      >
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="px-4 max-h-[300px] overflow-y-auto">
                    {predictions.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-xs" style={{ color: "var(--sh-fg-4)" }}>No predictions logged yet.</p>
                      </div>
                    ) : (
                      predictions.map((p) => (
                        <PredictionRow
                          key={p.id}
                          prediction={p}
                          onUpdate={(id, outcome) => updateOutcomeMutation.mutate({ id, outcome })}
                        />
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </EditorialTopNav>
  );
}
