import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Radar, MapPin, Zap, TrendingUp, AlertTriangle, Clock,
  DollarSign, RefreshCw, Sparkles, ChevronRight, Filter,
  Building2, Target, Fuel, ParkingCircle, Landmark, Coins,
  Globe, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

const SIGNAL_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string; description: string }> = {
  permit_filed: { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "Permit Filed", description: "Construction permits signal incoming development" },
  tad_boundary: { icon: Landmark, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", label: "TAD Boundary", description: "Tax Allocation District plays" },
  zoning_change: { icon: Building2, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Zoning Change", description: "Rezoning creates value arbitrage" },
  world_event: { icon: Globe, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", label: "World Event", description: "Major events create demand spikes" },
  land_play: { icon: MapPin, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", label: "Land Play", description: "Undervalued land with optionality" },
  gas_station_hold: { icon: Fuel, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "Gas Station Hold", description: "Corner lots with redevelopment optionality" },
  parking_arbitrage: { icon: ParkingCircle, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Parking Arb", description: "Surface lots in density corridors" },
  lot_prep: { icon: Target, color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20", label: "Lot Prep", description: "Prep for acquisition by major developer" },
  microloan: { icon: Coins, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", label: "Microloan", description: "CDFI capital arbitrage" },
  other: { icon: Zap, color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20", label: "Signal", description: "Creative opportunity" },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const UrgencyBar = ({ score }: { score: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score * 100}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={cn(
          "h-full rounded-full",
          score >= 0.8 ? "bg-rose-500" : score >= 0.6 ? "bg-amber-500" : "bg-emerald-500"
        )}
      />
    </div>
    <span className={cn(
      "text-xs font-bold w-8 text-right",
      score >= 0.8 ? "text-rose-400" : score >= 0.6 ? "text-amber-400" : "text-emerald-400"
    )}>
      {Math.round(score * 100)}
    </span>
  </div>
);

export default function OpportunityRadar() {
  const { toast } = useToast();
  const [location, setLocation] = useState("Atlanta, GA");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const { data: signals = [], refetch } = trpc.opportunityRadar.list.useQuery();

  const scanMutation = trpc.opportunityRadar.scan.useMutation({
    onSuccess: (data) => {
      setIsScanning(false);
      refetch();
      toast({ title: `${data.length} signals found`, description: `Opportunity scan complete for ${location}` });
    },
    onError: (err) => {
      setIsScanning(false);
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const handleScan = () => {
    setIsScanning(true);
    scanMutation.mutate({ location });
  };

  const filteredSignals = activeFilter
    ? signals.filter((s: any) => s.signalType === activeFilter)
    : signals;

  const signalTypeCounts = signals.reduce((acc: Record<string, number>, s: any) => {
    acc[s.signalType] = (acc[s.signalType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] border border-white/5 p-6 md:p-8"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-cyan-500/5" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Radar className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-rose-400">Opportunity Radar</span>
              {signals.length > 0 && (
                <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-xs ml-auto">
                  {signals.length} active signals
                </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              See what the{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-cyan-400">
                market is telegraphing.
              </span>
            </h1>
            <p className="text-gray-400 text-sm max-w-2xl">
              Permits filed. TAD boundaries shifting. World Cup coming. Gas stations with optionality. 
              The signals savvy investors act on — before the crowd catches on.
            </p>
          </div>
        </motion.div>

        {/* Scan Controls */}
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 bg-card/50 border border-white/8 rounded-xl px-4" style={{ background: "var(--sh-surface-1)" }}>
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Atlanta, GA"
              className="bg-transparent border-0 text-white placeholder:text-gray-500 focus-visible:ring-0 px-0"
            />
          </div>
          <Button
            onClick={handleScan}
            disabled={isScanning}
            className="gap-2 bg-gradient-to-r from-rose-500 to-cyan-500 hover:from-rose-400 hover:to-cyan-400 text-white border-0 rounded-xl px-6"
          >
            {isScanning ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Radar className="w-4 h-4" />
              </motion.div>
            ) : (
              <Radar className="w-4 h-4" />
            )}
            {isScanning ? "Scanning..." : "Scan Market"}
          </Button>
        </div>

        {/* Signal Type Filters */}
        {signals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFilter(null)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                activeFilter === null
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/3 border-white/8 text-gray-500 hover:text-gray-300"
              )}
            >
              <Filter className="w-3 h-3" />
              All ({signals.length})
            </button>
            {Object.entries(signalTypeCounts).map(([type, count]) => {
              const cfg = SIGNAL_CONFIG[type] ?? SIGNAL_CONFIG.other;
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type === activeFilter ? null : type)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    activeFilter === type ? `${cfg.bg} ${cfg.color}` : "bg-white/3 border-white/8 text-gray-500 hover:text-gray-300"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {signals.length === 0 && !isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-center">
              <Radar className="w-8 h-8 text-rose-400/40" />
            </div>
            <div className="text-center">
              <div className="text-white font-semibold mb-1">No signals yet</div>
              <div className="text-sm text-gray-500">Enter a market and scan to discover creative investment opportunities</div>
            </div>
            <Button onClick={handleScan} className="gap-2 bg-gradient-to-r from-rose-500 to-cyan-500 text-white border-0">
              <Sparkles className="w-4 h-4" />
              Scan {location}
            </Button>
          </motion.div>
        )}

        {/* Scanning Animation */}
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 space-y-4"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full border border-rose-500/20 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Radar className="w-7 h-7 text-rose-400" />
                </motion.div>
              </div>
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full border border-rose-500/20"
              />
            </div>
            <div className="text-center">
              <div className="text-white font-semibold">Scanning {location}...</div>
              <div className="text-sm text-gray-500 mt-1">Analyzing permits, TADs, zoning changes, and creative plays</div>
            </div>
          </motion.div>
        )}

        {/* Signal Cards */}
        {filteredSignals.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <AnimatePresence>
              {filteredSignals.map((signal: any, i: number) => {
                const cfg = SIGNAL_CONFIG[signal.signalType] ?? SIGNAL_CONFIG.other;
                const Icon = cfg.icon;
                const isExpanded = expandedId === signal.id;

                return (
                  <motion.div
                    key={signal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    layout
                  >
                    <Card
                      className={cn(
                        "border cursor-pointer transition-all hover:scale-[1.01]",
                        isExpanded ? cfg.bg : "bg-card/50 border-white/8 hover:border-white/15"
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : signal.id)}
                    >
                      <CardContent className="p-5 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
                              <Icon className={cn("w-5 h-5", cfg.color)} />
                            </div>
                            <div>
                              <Badge variant="outline" className={cn("text-[10px] font-bold mb-1", cfg.color, cfg.bg)}>
                                {cfg.label}
                              </Badge>
                              <div className="font-semibold text-white text-sm leading-tight">{signal.title}</div>
                              {signal.location && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  {signal.location}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={cn(
                              "text-xs font-bold",
                              (signal.urgencyScore ?? 0) >= 0.8 ? "text-rose-400" :
                              (signal.urgencyScore ?? 0) >= 0.6 ? "text-amber-400" : "text-emerald-400"
                            )}>
                              {(signal.urgencyScore ?? 0) >= 0.8 ? "🔴 URGENT" :
                               (signal.urgencyScore ?? 0) >= 0.6 ? "🟡 WATCH" : "🟢 MONITOR"}
                            </div>
                          </div>
                        </div>

                        {/* Urgency Bar */}
                        <div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Urgency Score</span>
                            <span>Act Window</span>
                          </div>
                          <UrgencyBar score={signal.urgencyScore ?? 0.5} />
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {signal.estimatedROI && (
                            <div className="text-center">
                              <div className="text-[10px] text-muted-foreground">Est. ROI</div>
                              <div className="text-sm font-bold text-emerald-400">
                                {((signal.estimatedROI - 1) * 100).toFixed(0)}%
                              </div>
                            </div>
                          )}
                          {signal.estimatedHoldYears && (
                            <div className="text-center">
                              <div className="text-[10px] text-muted-foreground">Hold Period</div>
                              <div className="text-sm font-bold text-white">{signal.estimatedHoldYears}yr</div>
                            </div>
                          )}
                          {signal.capitalRequired && (
                            <div className="text-center">
                              <div className="text-[10px] text-muted-foreground">Capital Req.</div>
                              <div className="text-sm font-bold text-blue-400">
                                {signal.capitalRequired >= 1000000
                                  ? `$${(signal.capitalRequired / 1000000).toFixed(1)}M`
                                  : `$${(signal.capitalRequired / 1000).toFixed(0)}k`}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Expanded AI Analysis */}
                        <AnimatePresence>
                          {isExpanded && signal.aiAnalysis && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-3 border-t border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                  <Sparkles className={cn("w-3.5 h-3.5", cfg.color)} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI Analysis</span>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed">{signal.aiAnalysis}</p>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    className="flex-1 h-8 text-xs bg-gradient-to-r from-rose-500/20 to-cyan-500/20 border border-white/10 text-white hover:border-white/20"
                                    onClick={(e) => { e.stopPropagation(); window.location.href = "/strategy-blender"; }}
                                  >
                                    Add to Blender
                                    <ChevronRight className="w-3 h-3 ml-1" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs border-white/10"
                                    onClick={(e) => { e.stopPropagation(); window.location.href = "/investor-dossier"; }}
                                  >
                                    Build Dossier
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {!isExpanded && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span>Click for AI analysis</span>
                            <ChevronRight className="w-3 h-3" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Creative Play Templates */}
        {signals.length === 0 && !isScanning && (
          <div className="space-y-3">
            <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Example Creative Plays</p>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { type: "world_event", title: "FIFA World Cup 2026 Parking Arb", location: "Atlanta, GA", urgency: 0.95, roi: 1.4, capital: 180000, preview: "64 matches. 1.5M+ visitors. Surface lots near stadium at pre-event pricing." },
                { type: "tad_boundary", title: "Westside TAD Expansion Play", location: "Atlanta, GA", urgency: 0.88, roi: 0.9, capital: 350000, preview: "City council vote Q2. Properties inside boundary get tax increment financing." },
                { type: "gas_station_hold", title: "Buckhead Corner Lot Hold", location: "Buckhead, GA", urgency: 0.75, roi: 1.1, capital: 480000, preview: "Decommissioned gas station. EPA Phase 1 clean. Motivated seller, 18mo on market." },
              ].map((play) => {
                const cfg = SIGNAL_CONFIG[play.type];
                const Icon = cfg.icon;
                return (
                  <Card key={play.title} className="bg-card/50 border-white/8 opacity-60" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("w-4 h-4", cfg.color)} />
                        <Badge variant="outline" className={cn("text-[10px]", cfg.color, cfg.bg)}>{cfg.label}</Badge>
                      </div>
                      <div className="text-sm font-semibold text-white">{play.title}</div>
                      <div className="text-xs text-gray-500">{play.preview}</div>
                      <div className="text-[10px] text-muted-foreground italic">Scan to unlock real signals like this</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
