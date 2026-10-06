import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Compass, DollarSign, HelpCircle, Shield, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MicroTooltip } from "./MicroTooltip";

interface GuidedThesisWizardProps {
  onComplete: (data: {
    name: string;
    rawText: string;
    symbol: string;
    capitalCents: number;
    maxLossCents: number;
    horizon: string;
  }) => void;
  onCancel?: () => void;
}

const POPULAR_ASSETS = [
  { symbol: "NVDA", name: "Nvidia", category: "AI & Compute" },
  { symbol: "AAPL", name: "Apple", category: "Hardware & Ecosystem" },
  { symbol: "MSFT", name: "Microsoft", category: "Enterprise Cloud" },
  { symbol: "TSLA", name: "Tesla", category: "EV & Autonomous" },
  { symbol: "AMZN", name: "Amazon", category: "Cloud & E-Comm" },
  { symbol: "SPY", name: "S&P 500 ETF", category: "Broad Index" },
];

const PRESET_EXPECTATIONS = [
  {
    title: "Earnings Beat Catalyst",
    timeframe: "1–2 weeks",
    text: "I think earnings will beat expectations over the next 2 weeks, driven by enterprise compute demand exceeding consensus estimates.",
    tag: "Catalyst",
  },
  {
    title: "Oversold Rebound",
    timeframe: "2–4 weeks",
    text: "The stock is oversold on broad macro interest-rate fear, but core free cash flow remains rock-solid and it should rebound to recent highs.",
    tag: "Value / Rebound",
  },
  {
    title: "Structural Multi-Quarter Cycle",
    timeframe: "3–6 months",
    text: "Demand for power and data center infrastructure is a multi-quarter tailwind that will continue surprising to the upside through the fiscal year.",
    tag: "Trend / Secular",
  },
];

const RISK_PRESETS = [
  { label: "Cautious ($75 max loss)", capital: 500, maxLoss: 75, pct: "15% downside cap" },
  { label: "Balanced ($150 max loss)", capital: 1000, maxLoss: 150, pct: "15% downside cap" },
  { label: "High Conviction ($300 max loss)", capital: 2000, maxLoss: 300, pct: "15% downside cap" },
];

export function GuidedThesisWizard({ onComplete, onCancel }: GuidedThesisWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Asset
  const [symbol, setSymbol] = useState("NVDA");
  const [customSymbol, setCustomSymbol] = useState("");

  // Step 2: Expectation
  const [expectation, setExpectation] = useState(PRESET_EXPECTATIONS[0].text);
  const [timeframe, setTimeframe] = useState(PRESET_EXPECTATIONS[0].timeframe);

  // Step 3: Capital & Risk
  const [capital, setCapital] = useState(1000);
  const [maxLoss, setMaxLoss] = useState(150);

  const activeSymbol = customSymbol.trim() ? customSymbol.trim().toUpperCase() : symbol;

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as 2 | 3);
    } else {
      // Build clean thesis text
      const name = `${activeSymbol} — ${timeframe} Catalyst Thesis`;
      const rawText = `Thesis for ${activeSymbol}:
Expectation: ${expectation.trim()}
Target Horizon: ${timeframe}
Capital Mandate: $${capital.toLocaleString()} deployable capital
Enforced Risk Ceiling: $${maxLoss.toLocaleString()} maximum planned loss (strict stop-loss bound)
Invalidation Condition: Premise invalid if catalyst misses or price drops below stop limit prior to deadline.`;

      onComplete({
        name,
        rawText,
        symbol: activeSymbol,
        capitalCents: capital * 100,
        maxLossCents: maxLoss * 100,
        horizon: timeframe,
      });
    }
  };

  return (
    <Card className="border border-rule shadow-sm bg-surface overflow-hidden">
      {/* Wizard Header Progress */}
      <div className="border-b border-rule bg-surface-2 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
                {step}
              </span>
              <h3 className="text-sm font-semibold text-ink">
                {step === 1 && "Step 1 of 3: Which company or asset are you watching?"}
                {step === 2 && "Step 2 of 3: What is your expectation?"}
                {step === 3 && "Step 3 of 3: How much risk are you willing to allocate?"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-7">
              {step === 1 && "Pick a ticker you want to research or test on paper"}
              {step === 2 && "State your premise clearly so the engine knows what to stress-test"}
              {step === 3 && "Define your downside limit before taking any paper risk"}
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs font-mono">
            <span className={step >= 1 ? "text-amber font-semibold" : "text-muted-foreground"}>1. Asset</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className={step >= 2 ? "text-amber font-semibold" : "text-muted-foreground"}>2. Premise</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className={step === 3 ? "text-amber font-semibold" : "text-muted-foreground"}>3. Risk Limit</span>
          </div>
        </div>
      </div>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Step 1: Asset Selector */}
        {step === 1 && (
          <div className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Choose an asset or enter any ticker symbol:
            </Label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {POPULAR_ASSETS.map((asset) => {
                const isSelected = activeSymbol === asset.symbol && !customSymbol;
                return (
                  <button
                    key={asset.symbol}
                    type="button"
                    onClick={() => {
                      setSymbol(asset.symbol);
                      setCustomSymbol("");
                    }}
                    className={`flex flex-col text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-amber bg-amber/10 shadow-xs ring-1 ring-amber"
                        : "border-rule bg-surface hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-ink">{asset.symbol}</span>
                      {isSelected && <Check className="h-4 w-4 text-amber" />}
                    </div>
                    <span className="text-xs text-ink/80 mt-0.5">{asset.name}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">{asset.category}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <Label htmlFor="custom-ticker" className="text-xs text-muted-foreground">
                Or type any other ticker (e.g. AMD, PLTR, COIN):
              </Label>
              <div className="mt-1.5 flex gap-2 max-w-xs">
                <Input
                  id="custom-ticker"
                  placeholder="e.g. AMD"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                  className="font-mono text-sm uppercase"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Expectation & Horizon */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select an expectation template or write your own:
              </Label>
              <div className="mt-2 space-y-2">
                {PRESET_EXPECTATIONS.map((preset, idx) => {
                  const isSelected = expectation === preset.text;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setExpectation(preset.text);
                        setTimeframe(preset.timeframe);
                      }}
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${
                        isSelected
                          ? "border-amber bg-amber/10 shadow-xs ring-1 ring-amber"
                          : "border-rule bg-surface hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-ink">{preset.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {preset.timeframe}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{preset.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-xs font-semibold text-muted-foreground">Customize your statement:</Label>
              <Textarea
                rows={3}
                value={expectation}
                onChange={(e) => setExpectation(e.target.value)}
                placeholder="What do you believe will happen?"
                className="mt-1.5 text-xs leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* Step 3: Risk Allocation */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Choose your risk budget for {activeSymbol}:
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Capital Aperture calculates strict loss boundaries before you test any paper trade.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {RISK_PRESETS.map((preset, idx) => {
                  const isSelected = capital === preset.capital && maxLoss === preset.maxLoss;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCapital(preset.capital);
                        setMaxLoss(preset.maxLoss);
                      }}
                      className={`flex flex-col text-left p-3.5 rounded-lg border transition-all ${
                        isSelected
                          ? "border-amber bg-amber/10 shadow-xs ring-1 ring-amber"
                          : "border-rule bg-surface hover:bg-surface-2"
                      }`}
                    >
                      <span className="font-semibold text-xs text-ink">{preset.label}</span>
                      <span className="text-sm font-mono font-bold text-ink mt-1">
                        ${preset.capital.toLocaleString()} capital
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        {preset.pct} · max loss ${preset.maxLoss}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Downside Protection Summary Card */}
            <div className="rounded-lg border border-sage/50 bg-sage/5 p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 text-ink font-semibold">
                <Shield className="h-4 w-4 text-sage" />
                <span>Bounded Downside Guarantee</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                If {activeSymbol} drops by <strong>15%</strong> (loss of <strong>${maxLoss}</strong>), the trade is automatically marked invalidated. You will never lose more than your pre-set risk boundary.
              </p>
              <div className="pt-2 border-t border-rule/50 flex flex-wrap items-center gap-4 text-[11px] font-mono text-muted-foreground">
                <span>Account Share: ~{(capital / 1000).toFixed(1)}%</span>
                <span>Max Drawdown: -${maxLoss}</span>
                <span>Safety Cap: Compliant</span>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-rule">
          {step > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((step - 1) as 1 | 2)}
              className="text-xs"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back
            </Button>
          ) : (
            onCancel ? (
              <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
                Cancel
              </Button>
            ) : <div />
          )}

          <Button
            size="sm"
            onClick={handleNext}
            className="text-xs font-semibold bg-amber text-black hover:bg-amber-400"
          >
            {step < 3 ? (
              <>
                Next Step
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate Guided Thesis
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
