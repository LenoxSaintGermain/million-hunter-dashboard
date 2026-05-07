/**
 * TIDE — Temporal Intelligence for Deployment Events
 * Phase 1: Political Capital Deployment
 *
 * Three-panel editorial layout:
 *  Left  → Geography scan input + Capital Flow Feed
 *  Right → Convergence Events + Prediction Track Record
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, TrendingUp, MapPin, AlertTriangle, CheckCircle2,
  Clock, ArrowRight, BarChart2, Loader2, Target, BookOpen,
  Archive, RefreshCw, ChevronDown, ChevronUp, ExternalLink,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<FlowCategory, string> = {
  infrastructure: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  defense:        "text-red-400 bg-red-400/10 border-red-400/20",
  healthcare:     "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  housing:        "text-blue-400 bg-blue-400/10 border-blue-400/20",
  energy:         "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  education:      "text-purple-400 bg-purple-400/10 border-purple-400/20",
  agriculture:    "text-lime-400 bg-lime-400/10 border-lime-400/20",
  technology:     "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  finance:        "text-orange-400 bg-orange-400/10 border-orange-400/20",
  other:          "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
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

const SOURCE_LABELS = {
  usaspending:      "USASpending",
  federal_register: "Fed Register",
  fec:              "FEC",
};

const SUGGESTED_GEOS = [
  "Atlanta, GA", "Charlotte, NC", "Miami, FL", "Dallas, TX",
  "Nashville, TN", "Phoenix, AZ", "Denver, CO", "Washington, DC",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlowCard({ flow }: { flow: CapitalFlow }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = CATEGORY_COLORS[flow.category] || CATEGORY_COLORS.other;
  const amountStr = flow.amount
    ? `$${(flow.amount / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="border-b border-white/5 py-3 last:border-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider", colorClass)}>
              {flow.category}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {SOURCE_LABELS[flow.source]}
            </span>
            {amountStr && (
              <span className="text-[10px] font-mono text-amber-400/80">{amountStr}</span>
            )}
          </div>
          <p className="text-sm text-zinc-200 font-medium leading-snug line-clamp-2">
            {flow.entity}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{flow.raw_title}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-zinc-600 font-mono">{flow.flow_date}</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
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
            <div className="pt-2 flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <MapPin className="h-3 w-3" />
                {flow.geography}
              </div>
              <div className="text-xs text-zinc-500">
                Confidence: {Math.round(flow.confidence * 100)}%
              </div>
              {flow.source_url && (
                <a
                  href={flow.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400/70 hover:text-amber-400 flex items-center gap-1 transition-colors"
                >
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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
  const capitalStr = event.total_capital
    ? `$${(event.total_capital / 100 / 1_000_000).toFixed(1)}M`
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className={cn(
        "rounded-lg border p-4 mb-3",
        event.confidence >= 0.8
          ? "border-amber-400/30 bg-amber-400/5"
          : "border-white/8 bg-white/3"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className={cn("h-3.5 w-3.5", event.confidence >= 0.8 ? "text-amber-400" : "text-zinc-400")} />
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              {SIGNAL_LABELS[event.signal_type as SignalType] || "Convergence"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-200">{event.geography}</span>
            {capitalStr && (
              <span className="text-xs text-amber-400/80 font-mono">{capitalStr} total</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn(
            "text-xs font-mono px-1.5 py-0.5 rounded",
            event.confidence >= 0.8 ? "text-amber-400 bg-amber-400/10" : "text-zinc-400 bg-zinc-400/10"
          )}>
            {Math.round(event.confidence * 100)}%
          </span>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 mb-2"
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
            <p className="text-xs text-zinc-400 leading-relaxed mb-3 border-l-2 border-amber-400/30 pl-3">
              {event.thesis_seed}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2 border-amber-400/30 text-amber-400 hover:bg-amber-400/10"
          onClick={() => onConvert(event.id)}
        >
          <BookOpen className="h-3 w-3 mr-1" />
          Send to Thesis Engine
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2 text-zinc-500 hover:text-zinc-300"
          onClick={() => onArchive(event.id)}
        >
          <Archive className="h-3 w-3 mr-1" />
          Archive
        </Button>
      </div>
    </motion.div>
  );
}

function PredictionRow({ prediction, onUpdate }: {
  prediction: Prediction;
  onUpdate: (id: number, outcome: "confirmed" | "disconfirmed") => void;
}) {
  const outcomeIcon = {
    confirmed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
    disconfirmed: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
    pending: <Clock className="h-3.5 w-3.5 text-zinc-500" />,
  }[prediction.outcome];

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="mt-0.5">{outcomeIcon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 leading-snug">{prediction.claim}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-zinc-600 font-mono">{prediction.geography}</span>
          <span className="text-[10px] text-zinc-600">·</span>
          <span className="text-[10px] text-zinc-600 font-mono">{Math.round(prediction.confidence * 100)}% conf</span>
        </div>
      </div>
      {prediction.outcome === "pending" && (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onUpdate(prediction.id, "confirmed")}
            className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10 transition-colors"
          >
            ✓
          </button>
          <button
            onClick={() => onUpdate(prediction.id, "disconfirmed")}
            className="text-[10px] px-1.5 py-0.5 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
          >
            ✗
          </button>
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

  // tRPC queries
  const flowsQuery = trpc.tide.listFlows.useQuery({ limit: 50 });
  const convergenceQuery = trpc.tide.listConvergence.useQuery({ status: "active", limit: 20 });
  const predictionsQuery = trpc.tide.listPredictions.useQuery({ limit: 30 });

  // tRPC mutations
  const scanMutation = trpc.tide.scan.useMutation({
    onSuccess: (data) => {
      toast({
        title: "TIDE Scan Complete",
        description: data.message,
      });
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
      toast({
        title: "Thesis Seed Ready",
        description: `"${data.thesisSeed.slice(0, 80)}..." — navigate to Thesis Engine to compile.`,
      });
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

  // Filtered flows
  const flows: CapitalFlow[] = (flowsQuery.data as any[]) || [];
  const convergenceEvents: ConvergenceEvent[] = (convergenceQuery.data as any[]) || [];
  const predictions: Prediction[] = (predictionsQuery.data as any[]) || [];

  const filteredFlows = useMemo(() => {
    if (filterCategory === "all") return flows;
    return flows.filter((f) => f.category === filterCategory);
  }, [flows, filterCategory]);

  // Stats
  const totalCapital = flows.reduce((s, f) => s + (f.amount || 0), 0);
  const confirmedPredictions = predictions.filter((p) => p.outcome === "confirmed").length;
  const totalPredictions = predictions.filter((p) => p.outcome !== "pending").length;
  const accuracy = totalPredictions > 0 ? Math.round((confirmedPredictions / totalPredictions) * 100) : null;

  const categories = useMemo(() => {
    const cats = new Set(flows.map((f) => f.category));
    return ["all", ...Array.from(cats)];
  }, [flows]);

  return (
    <DashboardLayout>
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest">
                TIDE · Temporal Intelligence for Deployment Events
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold text-zinc-100 tracking-tight">
              Capital Flow Intelligence
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Phase 1: Political Capital Deployment. Monitor federal contracts, regulatory signals, and PAC flows to detect convergence events before the market prices them in.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {accuracy !== null && (
              <div className="text-right">
                <div className="text-2xl font-display font-bold text-amber-400">{accuracy}%</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Prediction Accuracy</div>
              </div>
            )}
            <div className="text-right">
              <div className="text-2xl font-display font-bold text-zinc-200">{convergenceEvents.length}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Active Events</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold text-zinc-200">
                {totalCapital > 0 ? `$${(totalCapital / 100 / 1_000_000).toFixed(0)}M` : "—"}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Capital Tracked</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Scan Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mb-6 p-4 rounded-xl border border-white/8 bg-white/3"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
              placeholder="Geography (e.g. Atlanta, GA)"
              className="bg-transparent border-white/10 text-zinc-200 placeholder:text-zinc-600 font-mono text-sm"
            />
          </div>
          <Button
            onClick={() => scanMutation.mutate({ geography })}
            disabled={scanMutation.isPending || !geography.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            {scanMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning…</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" /> Run TIDE Scan</>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Quick:</span>
          {SUGGESTED_GEOS.map((geo) => (
            <button
              key={geo}
              onClick={() => setGeography(geo)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded border transition-colors font-mono",
                geography === geo
                  ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                  : "border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20"
              )}
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
          transition={{ delay: 0.2, duration: 0.5 }}
          className="lg:col-span-3"
        >
          <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-zinc-200">Capital Flow Feed</span>
                <span className="text-xs text-zinc-500 font-mono">({filteredFlows.length})</span>
              </div>
              <button
                onClick={() => flowsQuery.refetch()}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", flowsQuery.isFetching && "animate-spin")} />
              </button>
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded border whitespace-nowrap font-mono uppercase tracking-wider transition-colors",
                    filterCategory === cat
                      ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                      : "border-white/8 text-zinc-500 hover:text-zinc-300 hover:border-white/15"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="px-4 max-h-[520px] overflow-y-auto">
              {flowsQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                </div>
              ) : filteredFlows.length === 0 ? (
                <div className="py-12 text-center">
                  <TrendingUp className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500">No flows detected yet.</p>
                  <p className="text-xs text-zinc-600 mt-1">Run a TIDE scan to populate the feed.</p>
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
          transition={{ delay: 0.3, duration: 0.5 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* Convergence Events */}
          <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-zinc-200">Convergence Events</span>
                {convergenceEvents.length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400">
                    {convergenceEvents.length}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {convergenceQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                </div>
              ) : convergenceEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <Zap className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">No convergence events yet.</p>
                  <p className="text-xs text-zinc-600 mt-1">Run a TIDE scan to detect patterns.</p>
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

          {/* Prediction Track Record */}
          <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
            <button
              onClick={() => setShowPredictions(!showPredictions)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-white/8 hover:bg-white/3 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-zinc-200">Prediction Track Record</span>
                {accuracy !== null && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400">
                    {accuracy}% accuracy
                  </span>
                )}
              </div>
              {showPredictions ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
            </button>

            <AnimatePresence>
              {showPredictions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {/* Log new prediction */}
                  <div className="px-4 pt-3 pb-2 border-b border-white/5">
                    <div className="flex gap-2">
                      <Input
                        value={newPrediction}
                        onChange={(e) => setNewPrediction(e.target.value)}
                        placeholder="Log a prediction…"
                        className="bg-transparent border-white/10 text-zinc-200 placeholder:text-zinc-600 text-xs h-8"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newPrediction.trim()) {
                            logPredictionMutation.mutate({
                              claim: newPrediction.trim(),
                              geography,
                              category: "other",
                              confidence: 0.7,
                            });
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-white/10 text-zinc-400 hover:text-zinc-200"
                        disabled={!newPrediction.trim() || logPredictionMutation.isPending}
                        onClick={() => {
                          if (newPrediction.trim()) {
                            logPredictionMutation.mutate({
                              claim: newPrediction.trim(),
                              geography,
                              category: "other",
                              confidence: 0.7,
                            });
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
                        <p className="text-xs text-zinc-600">No predictions logged yet.</p>
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
    </DashboardLayout>
  );
}
