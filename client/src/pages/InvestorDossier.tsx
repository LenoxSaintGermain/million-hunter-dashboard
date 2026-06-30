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

function AgentCommentary({ message }: { message: string; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border p-5"
      style={{ background: "var(--sh-primary-10)", borderColor: "var(--sh-border-1)" }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
          <Sparkles className="w-4 h-4" style={{ color: "var(--sh-signal)" }} />
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: "var(--sh-signal)" }}>Co-Analyst</div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>{message}</p>
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
          <span className="text-sm font-bold" style={{ color: "var(--sh-text-primary)" }}>{title}</span>
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
      className="fixed inset-y-0 right-0 w-full md:w-[480px] border-l z-50 overflow-y-auto"
      style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border-1)" }}
    >
      <div className="sticky top-0 backdrop-blur border-b p-4 flex items-center justify-between" style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border-1)" }}>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--sh-signal)" }}>Investor Receipt</div>
          <div className="text-sm font-semibold mt-0.5" style={{ color: "var(--sh-text-primary)" }}>{dossier.dealName}</div>
        </div>
        <button onClick={onClose} className="transition-colors" style={{ color: "var(--sh-fg-muted)" }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Deal Snapshot */}
        <div className="space-y-3">
          <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Deal Snapshot</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Asking Price", value: formatCurrency(dossier.askingPrice ?? 0), color: "var(--sh-text-primary)" },
              { label: "Down Payment", value: formatCurrency(dossier.downPayment ?? 0), color: "var(--sh-primary)" },
              { label: "Monthly Cash Flow", value: formatCurrency(dossier.monthlyCashFlow ?? 0), color: "var(--sage)" },
              { label: "Annual Return", value: `${dossier.annualReturn ?? 0}%`, color: "var(--sh-signal)" },
            ].map((row) => (
              <div key={row.label} className="rounded-xl p-3" style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border-1)" }}>
                <div className="text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>{row.label}</div>
                <div className="text-lg font-bold mt-0.5" style={{ color: row.color }}>{row.value}</div>
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
            <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>{dossier.whyThisDeal}</p>
          </div>
        )}

        {/* Risk Factors */}
        {dossier.riskFactors && dossier.riskFactors.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Risk Factors</div>
            <div className="space-y-2">
              {dossier.riskFactors.map((risk: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
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
                <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sage)] shrink-0 mt-0.5" />
                  {m}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="pt-4 border-t border-[var(--rule)] space-y-3">
          <Button className="w-full gap-2 border-0" style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}>
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
          className="relative overflow-hidden rounded-2xl border p-6 md:p-8"
          style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border-1)" }}
        >

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--sh-primary-10)", border: "1px solid var(--sh-border-1)" }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "var(--sh-signal)" }} />
                </div>
                <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: "var(--sh-signal)" }}>Investor Dossier</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
                The analysis is{" "}
                <span style={{ color: "var(--sh-signal)" }}>
                  tailored to them.
                </span>
              </h1>
              <p className="text-sm max-w-xl" style={{ color: "var(--sh-text-secondary)" }}>
                Bespoke investor pitch decks engineered for your specific audience. 
                Not a template — a tailored narrative that speaks their language.
              </p>
            </div>
            {savedDossiers.length > 0 && (
              <Badge className="self-start md:self-center" style={{ background: "var(--sh-primary-10)", color: "var(--sh-signal)", borderColor: "var(--sh-border-1)" }}>
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
                          className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-2)", color: "var(--sh-text-primary)" }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Deal Type</label>
                          <select
                            value={form.dealType}
                            onChange={(e) => setForm((f) => ({ ...f, dealType: e.target.value }))}
                            className="w-full h-10 rounded-md text-sm px-3 border"
                            style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}
                          >
                            {DEAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Location</label>
                          <div className="flex items-center gap-2 rounded-md px-3 h-10 border" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)" }}>
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <Input
                              value={form.location}
                              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                              className="bg-transparent border-0 text-sm px-0 h-auto focus-visible:ring-0" style={{ color: "var(--sh-text-primary)" }}
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
                          <div className="flex items-center gap-2 rounded-md px-3 h-10 border" style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)" }}>
                            <DollarSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <Input
                              type="number"
                              value={(form as any)[field.key]}
                              onChange={(e) => setForm((f) => ({ ...f, [field.key]: Number(e.target.value) }))}
                              className="bg-transparent border-0 text-sm px-0 h-auto focus-visible:ring-0" style={{ color: "var(--sh-text-primary)" }}
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
                      className="w-full rounded-md text-sm px-3 py-2 resize-none focus:outline-none border"
                      style={{ background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)", color: "var(--sh-text-primary)" }}
                    />
                  </CardContent>
                </Card>

                <Button
                  onClick={handleGenerate}
                  size="lg"
                  className="w-full h-14 text-base font-bold border-0 rounded-xl"
                  style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
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
                          className="w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left"
                          style={form.investorProfile === profile.id
                            ? { background: "var(--sh-primary-10)", borderColor: "var(--sh-signal)" }
                            : { background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)" }
                          }
                        >
                          <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: form.investorProfile === profile.id ? "var(--sh-signal)" : "var(--sh-fg-muted)" }} />
                          <div>
                            <div className="text-xs font-semibold" style={{ color: form.investorProfile === profile.id ? "var(--sh-text-primary)" : "var(--sh-text-secondary)" }}>
                              {profile.label}
                            </div>
                            <div className="text-[10px] mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>{profile.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Card className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-2)" }}>
                  <CardContent className="p-5">
                    <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--sh-signal)" }}>What you get</div>
                    <div className="space-y-2">
                      {[
                        "Narrative tailored to investor psychology",
                        "Bespoke risk/return framing",
                        "Capital stack recommendation",
                        "Agent commentary throughout",
                        "Exportable PDF dossier",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                          <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: "var(--sh-signal)" }} />
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
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <FileText className="w-8 h-8" style={{ color: "var(--sh-signal)" }} />
                  </motion.div>
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>Crafting your dossier...</h3>
                <p className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                  Tailoring narrative for {selectedProfile.label} profile
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}>
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
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--sh-signal)" }} />
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
                  <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "var(--sh-signal)" }}>Investor Dossier</div>
                  <h2 className="text-2xl font-bold" style={{ color: "var(--sh-text-primary)" }}>{result.dealName}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge style={{ background: "var(--sh-primary-10)", color: "var(--sh-signal)", borderColor: "var(--sh-border-1)" }}>{result.dealType}</Badge>
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
                    className="gap-2 border-0"
                  style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
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
                        <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>{result.investmentThesis}</p>
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
                              const colors: Record<string, string> = { sba7a: "bg-blue-500", sellerNote: "bg-[var(--sh-primary)]", equity: "bg-emerald-500", impactFund: "bg-[var(--sh-signal)]" };
                              return (
                                <div key={key}>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span style={{ color: "var(--sh-text-secondary)" }}>{labels[key] ?? key}</span>
                                    <span className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>
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
                            <p className="text-xs mt-2" style={{ color: "var(--sh-fg-muted)" }}>{result.capitalStack.notes}</p>
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
                      <DossierSection title={`Message for ${selectedProfile.label}`} icon={Users} color="text-[var(--sh-primary)]">
                        <p className="text-sm leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>{result.investorPitch}</p>
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
                              <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
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
                              <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
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
                  className="gap-2 border-0"
                  style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
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
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--sh-text-primary)" }}>{d.dealName}</div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]" style={{ color: "var(--sh-signal)", borderColor: "var(--sh-border-1)" }}>{d.dealType}</Badge>
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
              className="fixed inset-0 backdrop-blur-sm z-40" style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setReceiptOpen(false)}
            />
            <InvestorReceiptDrawer dossier={result} onClose={() => setReceiptOpen(false)} />
          </>
        )}
      </AnimatePresence>
    </EditorialTopNav>
  );
}
