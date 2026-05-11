import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Sparkles, ChevronRight, Building2, DollarSign,
  TrendingUp, Shield, Users, Star, Download, Share2,
  ArrowRight, CheckCircle2, AlertCircle, Clock, Zap,
  BarChart3, Target, MapPin, X
} from "lucide-react";
import { cn } from "@/lib/utils";

const INVESTOR_PROFILES = [
  { id: "family_office", label: "Family Office", description: "Preservation + yield, 3-7yr horizon", icon: Shield },
  { id: "high_net_worth", label: "High Net Worth", description: "Growth-oriented, 2-5yr horizon", icon: Star },
  { id: "syndicate", label: "Syndicate / LP", description: "Passive income, quarterly distributions", icon: Users },
  { id: "cdfi", label: "CDFI / Impact", description: "Community impact + financial return", icon: Target },
  { id: "self_directed_ira", label: "Self-Directed IRA", description: "Tax-advantaged, long hold", icon: BarChart3 },
];

const DEAL_TYPES = [
  "SBA Business Acquisition",
  "Commercial Real Estate",
  "Fix & Flip",
  "Land Play / Development",
  "Parking Arbitrage",
  "TAD Hold Strategy",
  "Mixed Portfolio",
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

function AgentCommentary({ message, color = "cyan" }: { message: string; color?: "cyan" | "emerald" | "purple" }) {
  const colorMap = {
    cyan: { border: "border-cyan-500/20", bg: "from-cyan-500/5", icon: "text-cyan-400", label: "text-cyan-400" },
    emerald: { border: "border-emerald-500/20", bg: "from-emerald-500/5", icon: "text-[var(--sage)]", label: "text-[var(--sage)]" },
    purple: { border: "border-purple-500/20", bg: "from-purple-500/5", icon: "text-purple-400", label: "text-purple-400" },
  };
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br to-transparent border p-5", c.bg, c.border)}
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-20" />
      <div className="flex items-start gap-3">
        <div className={cn("w-8 h-8 rounded-full bg-black/30 border flex items-center justify-center shrink-0 mt-0.5", c.border)}>
          <Sparkles className={cn("w-4 h-4", c.icon)} />
        </div>
        <div>
          <div className={cn("text-[10px] font-bold tracking-widest uppercase mb-1.5", c.label)}>AI Advisor</div>
          <p className="text-sm text-gray-300 leading-relaxed">{message}</p>
        </div>
      </div>
    </motion.div>
  );
}

function DossierSection({ title, icon: Icon, color, children }: any) {
  const [open, setOpen] = useState(true);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", color)} />
          <span className="text-sm font-bold text-white">{title}</span>
        </div>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InvestorReceiptDrawer({ dossier, onClose }: { dossier: any; onClose: () => void }) {
  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-[#0a0a0a] border-l border-[var(--rule)] z-50 overflow-y-auto"
    >
      <div className="sticky top-0 bg-[#0a0a0a]/90 backdrop-blur border-b border-[var(--rule)] p-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-cyan-400">Investor Receipt</div>
          <div className="text-sm font-semibold text-white mt-0.5">{dossier.dealName}</div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Deal Snapshot */}
        <div className="space-y-3">
          <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Deal Snapshot</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Asking Price", value: formatCurrency(dossier.askingPrice ?? 0), color: "text-white" },
              { label: "Down Payment", value: formatCurrency(dossier.downPayment ?? 0), color: "text-blue-400" },
              { label: "Monthly Cash Flow", value: formatCurrency(dossier.monthlyCashFlow ?? 0), color: "text-[var(--sage)]" },
              { label: "Annual Return", value: `${dossier.annualReturn ?? 0}%`, color: "text-purple-400" },
            ].map((row) => (
              <div key={row.label} className="bg-[var(--paper)] border border-[var(--rule)] rounded-xl p-3">
                <div className="text-[10px] text-muted-foreground">{row.label}</div>
                <div className={cn("text-lg font-bold mt-0.5", row.color)}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Investor-Specific Pitch */}
        {dossier.investorPitch && (
          <AgentCommentary message={dossier.investorPitch} color="cyan" />
        )}

        {/* Why This Deal */}
        {dossier.whyThisDeal && (
          <div className="space-y-2">
            <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Why This Deal</div>
            <p className="text-sm text-gray-300 leading-relaxed">{dossier.whyThisDeal}</p>
          </div>
        )}

        {/* Risk Factors */}
        {dossier.riskFactors && dossier.riskFactors.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Risk Factors</div>
            <div className="space-y-2">
              {dossier.riskFactors.map((risk: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <AlertCircle className="w-3.5 h-3.5 text-[var(--amber)] shrink-0 mt-0.5" />
                  {risk}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mitigations */}
        {dossier.mitigations && dossier.mitigations.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Mitigations</div>
            <div className="space-y-2">
              {dossier.mitigations.map((m: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sage)] shrink-0 mt-0.5" />
                  {m}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="pt-4 border-t border-[var(--rule)] space-y-3">
          <Button className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-0">
            <Download className="w-4 h-4" />
            Export PDF Dossier
          </Button>
          <Button variant="outline" className="w-full gap-2 border-[var(--rule)]">
            <Share2 className="w-4 h-4" />
            Share with Investor
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function InvestorDossier() {
  const { toast } = useToast();
  const [step, setStep] = useState<"intake" | "generating" | "result">("intake");
  const [receiptOpen, setReceiptOpen] = useState(false);

  const [form, setForm] = useState({
    dealName: "",
    dealType: "SBA Business Acquisition",
    askingPrice: 1500000,
    annualRevenue: 2200000,
    cashFlow: 480000,
    location: "Atlanta, GA",
    investorProfile: "high_net_worth",
    targetRaise: 500000,
    highlights: "",
  });

  const [result, setResult] = useState<any>(null);

  const { data: savedDossiers = [], refetch } = trpc.investorDossier.list.useQuery();

  const generateMutation = trpc.investorDossier.generate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      refetch();
    },
    onError: (err) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
      setStep("intake");
    },
  });

  const handleGenerate = () => {
    if (!form.dealName) {
      toast({ title: "Deal name required", variant: "destructive" });
      return;
    }
    setStep("generating");
    generateMutation.mutate({ ...form, title: `${form.dealName} — ${form.investorProfile} Dossier` });
  };

  const selectedProfile = INVESTOR_PROFILES.find((p) => p.id === form.investorProfile) ?? INVESTOR_PROFILES[1];
  const ProfileIcon = selectedProfile.icon;

  return (
    <EditorialTopNav>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] border border-[var(--rule)] p-6 md:p-8"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <span className="text-xs font-bold tracking-[0.2em] uppercase text-purple-400">Investor Dossier</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                The AI is{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                  looking out for them.
                </span>
              </h1>
              <p className="text-gray-400 text-sm max-w-xl">
                Bespoke investor pitch decks engineered for your specific audience. 
                Not a template — a tailored narrative that speaks their language.
              </p>
            </div>
            {savedDossiers.length > 0 && (
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 self-start md:self-center">
                {savedDossiers.length} dossiers saved
              </Badge>
            )}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "intake" && (
            <motion.div
              key="intake"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-6 lg:grid-cols-3"
            >
              <div className="lg:col-span-2 space-y-5">
                {/* Deal Info */}
                <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-5 space-y-4">
                    <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Deal Details</div>
                    <div className="grid gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Deal Name</label>
                        <Input
                          value={form.dealName}
                          onChange={(e) => setForm((f) => ({ ...f, dealName: e.target.value }))}
                          placeholder="Metro Commercial Cleaning — Atlanta"
                          className="bg-transparent border-[var(--rule)] text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Deal Type</label>
                          <select
                            value={form.dealType}
                            onChange={(e) => setForm((f) => ({ ...f, dealType: e.target.value }))}
                            className="w-full h-10 bg-black/40 border border-[var(--rule)] rounded-md text-white text-sm px-3"
                          >
                            {DEAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Location</label>
                          <div className="flex items-center gap-2 bg-black/40 border border-[var(--rule)] rounded-md px-3 h-10">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <Input
                              value={form.location}
                              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                              className="bg-transparent border-0 text-white text-sm px-0 h-auto focus-visible:ring-0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Financials */}
                <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-5 space-y-4">
                    <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Financials</div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "askingPrice", label: "Asking Price" },
                        { key: "annualRevenue", label: "Annual Revenue" },
                        { key: "cashFlow", label: "Annual Cash Flow" },
                        { key: "targetRaise", label: "Target Raise" },
                      ].map((field) => (
                        <div key={field.key}>
                          <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
                          <div className="flex items-center gap-2 bg-black/40 border border-[var(--rule)] rounded-md px-3 h-10">
                            <DollarSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <Input
                              type="number"
                              value={(form as any)[field.key]}
                              onChange={(e) => setForm((f) => ({ ...f, [field.key]: Number(e.target.value) }))}
                              className="bg-transparent border-0 text-white text-sm px-0 h-auto focus-visible:ring-0"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Key Highlights */}
                <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-5 space-y-3">
                    <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Key Highlights (optional)</div>
                    <textarea
                      value={form.highlights}
                      onChange={(e) => setForm((f) => ({ ...f, highlights: e.target.value }))}
                      placeholder="Recurring government contracts. 12-year operating history. Owner retiring — motivated seller. SBA pre-qualified..."
                      rows={3}
                      className="w-full bg-black/40 border border-[var(--rule)] rounded-md text-white text-sm px-3 py-2 resize-none focus:outline-none focus:border-[var(--rule)]"
                    />
                  </CardContent>
                </Card>

                <Button
                  onClick={handleGenerate}
                  size="lg"
                  className="w-full h-14 text-base font-bold bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white border-0 rounded-xl"
                >
                  <Sparkles className="mr-2 w-5 h-5" />
                  Generate Bespoke Dossier
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>

              {/* Investor Profile Selector */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">Investor Profile</p>
                  <div className="space-y-2">
                    {INVESTOR_PROFILES.map((profile) => {
                      const Icon = profile.icon;
                      return (
                        <button
                          key={profile.id}
                          onClick={() => setForm((f) => ({ ...f, investorProfile: profile.id }))}
                          className={cn(
                            "w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left",
                            form.investorProfile === profile.id
                              ? "bg-purple-500/10 border-purple-500/30"
                              : "bg-[var(--paper)] border-[var(--rule)] hover:border-[var(--rule)]"
                          )}
                        >
                          <Icon className={cn(
                            "w-4 h-4 shrink-0 mt-0.5",
                            form.investorProfile === profile.id ? "text-purple-400" : "text-gray-500"
                          )} />
                          <div>
                            <div className={cn(
                              "text-xs font-semibold",
                              form.investorProfile === profile.id ? "text-purple-300" : "text-gray-300"
                            )}>
                              {profile.label}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{profile.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Card className="bg-gradient-to-br from-purple-500/5 to-cyan-500/5 border-purple-500/10">
                  <CardContent className="p-5">
                    <div className="text-xs font-bold tracking-widest uppercase text-purple-400 mb-2">What you get</div>
                    <div className="space-y-2">
                      {[
                        "Narrative tailored to investor psychology",
                        "Bespoke risk/return framing",
                        "Capital stack recommendation",
                        "Agent commentary throughout",
                        "Exportable PDF dossier",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-xs text-gray-400">
                          <CheckCircle2 className="w-3 h-3 text-purple-400 shrink-0" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 space-y-6"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full border border-purple-500/20 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <FileText className="w-8 h-8 text-purple-400" />
                  </motion.div>
                </div>
                <div className="absolute inset-0 rounded-full border border-purple-500/10 animate-ping" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">Crafting your dossier...</h3>
                <p className="text-gray-400 text-sm">
                  Tailoring narrative for {selectedProfile.label} profile
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
                {[
                  "Analyzing deal financials",
                  "Profiling investor psychology",
                  "Crafting bespoke narrative",
                  "Engineering capital stack",
                  "Writing agent commentary",
                ].map((msg, i) => (
                  <motion.div
                    key={msg}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.7 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    {msg}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {step === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Dossier Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold tracking-widest uppercase text-purple-400 mb-1">Investor Dossier</div>
                  <h2 className="text-2xl font-bold text-white">{result.dealName}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">{result.dealType}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {result.location}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ProfileIcon className="w-3 h-3" />
                      {selectedProfile.label}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setReceiptOpen(true)}
                    className="gap-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0"
                  >
                    <FileText className="w-4 h-4" />
                    View Receipt
                  </Button>
                  <Button variant="outline" className="gap-2 border-[var(--rule)]" onClick={() => setStep("intake")}>
                    New Dossier
                  </Button>
                </div>
              </div>

              {/* Executive Summary */}
              {result.executiveSummary && (
                <AgentCommentary message={result.executiveSummary} color="purple" />
              )}

              {/* Dossier Sections */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Investment Thesis */}
                {result.investmentThesis && (
                  <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-5">
                      <DossierSection title="Investment Thesis" icon={TrendingUp} color="text-[var(--sage)]">
                        <p className="text-sm text-gray-300 leading-relaxed">{result.investmentThesis}</p>
                      </DossierSection>
                    </CardContent>
                  </Card>
                )}

                {/* Capital Stack */}
                {result.capitalStack && (
                  <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-5">
                      <DossierSection title="Recommended Capital Stack" icon={BarChart3} color="text-blue-400">
                        <div className="space-y-2">
                          {Object.entries(result.capitalStack)
                            .filter(([k]) => k !== "total" && k !== "notes")
                            .map(([key, value]: [string, any]) => {
                              if (!value || value === 0) return null;
                              const total = result.capitalStack.total || 1;
                              const pct = Math.round((value / total) * 100);
                              const labels: Record<string, string> = { sba7a: "SBA 7(a)", sellerNote: "Seller Note", equity: "Equity", impactFund: "Impact Fund" };
                              const colors: Record<string, string> = { sba7a: "bg-blue-500", sellerNote: "bg-purple-500", equity: "bg-emerald-500", impactFund: "bg-cyan-500" };
                              return (
                                <div key={key}>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400">{labels[key] ?? key}</span>
                                    <span className="text-white font-semibold">
                                      {formatCurrency(value)} <span className="text-muted-foreground">({pct}%)</span>
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-[var(--bone)] rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.8, ease: "easeOut" }}
                                      className={cn("h-full rounded-full", colors[key] ?? "bg-gray-500")}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          {result.capitalStack.notes && (
                            <p className="text-xs text-gray-500 mt-2">{result.capitalStack.notes}</p>
                          )}
                        </div>
                      </DossierSection>
                    </CardContent>
                  </Card>
                )}

                {/* Investor Pitch */}
                {result.investorPitch && (
                  <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-5">
                      <DossierSection title={`Message for ${selectedProfile.label}`} icon={Users} color="text-purple-400">
                        <p className="text-sm text-gray-300 leading-relaxed">{result.investorPitch}</p>
                      </DossierSection>
                    </CardContent>
                  </Card>
                )}

                {/* Risk & Mitigations */}
                {(result.riskFactors?.length > 0 || result.mitigations?.length > 0) && (
                  <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-5 space-y-4">
                      {result.riskFactors?.length > 0 && (
                        <DossierSection title="Risk Factors" icon={AlertCircle} color="text-[var(--amber)]">
                          <div className="space-y-2">
                            {result.riskFactors.map((r: string, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                                <AlertCircle className="w-3.5 h-3.5 text-[var(--amber)] shrink-0 mt-0.5" />
                                {r}
                              </div>
                            ))}
                          </div>
                        </DossierSection>
                      )}
                      {result.mitigations?.length > 0 && (
                        <DossierSection title="Mitigations" icon={Shield} color="text-[var(--sage)]">
                          <div className="space-y-2">
                            {result.mitigations.map((m: string, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sage)] shrink-0 mt-0.5" />
                                {m}
                              </div>
                            ))}
                          </div>
                        </DossierSection>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Closing Agent Commentary */}
              {result.closingMessage && (
                <AgentCommentary message={result.closingMessage} color="emerald" />
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  onClick={() => setReceiptOpen(true)}
                  className="gap-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0"
                >
                  <FileText className="w-4 h-4" />
                  Open Investor Receipt
                </Button>
                <Button variant="outline" className="gap-2 border-[var(--rule)]">
                  <Download className="w-4 h-4" />
                  Export PDF
                </Button>
                <Button variant="outline" className="gap-2 border-[var(--rule)]">
                  <Share2 className="w-4 h-4" />
                  Share Link
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved Dossiers */}
        {savedDossiers.length > 0 && step === "intake" && (
          <div className="space-y-3">
            <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Recent Dossiers</p>
            <div className="grid gap-3 md:grid-cols-3">
              {savedDossiers.slice(0, 3).map((d: any) => (
                <Card key={d.id} className="bg-card/50 border-[var(--rule)] hover:border-[var(--rule)] transition-all cursor-pointer" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-4 space-y-2">
                    <div className="text-sm font-semibold text-white truncate">{d.dealName}</div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/20">{d.dealType}</Badge>
                      <span className="text-xs text-muted-foreground">{d.investorProfile}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Investor Receipt Drawer */}
      <AnimatePresence>
        {receiptOpen && result && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setReceiptOpen(false)}
            />
            <InvestorReceiptDrawer dossier={result} onClose={() => setReceiptOpen(false)} />
          </>
        )}
      </AnimatePresence>
    </EditorialTopNav>
  );
}
