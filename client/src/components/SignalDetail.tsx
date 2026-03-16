import { 
  ShieldAlert, 
  BrainCircuit, 
  SearchCheck, 
  Banknote,
  AlertTriangle,
  CheckCircle2,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SignalDetailProps {
  signals: {
    psychology: {
      distress_score: number;
      retirement_readiness: number;
      negotiation_style: string;
      leverage_points: string[];
      strategy_recommendation: string;
    };
    audit: {
      digital_maturity_score: number;
      tech_debt_level: string;
      growth_reality_check: string;
      red_flags: string[];
    };
    red_team: {
      kill_probability: number;
      primary_deal_breaker: string;
      devils_advocate_points: string[];
    };
    capital: {
      feasibility: string;
      cash_on_cash_return: number;
      dscr: number;
      optimal_stack: Record<string, number>;
    };
  };
}

export default function SignalDetail({ signals }: SignalDetailProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* 1. Owner Psychology (The Human Signal) */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-blue-500" />
              Owner Psychology
            </CardTitle>
            <Badge variant="outline" className="uppercase text-xs">
              {signals.psychology.negotiation_style} Style
            </Badge>
          </div>
          <CardDescription>Leverage points based on seller profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Distress Level</span>
              <span className="font-medium">{(signals.psychology.distress_score * 100).toFixed(0)}%</span>
            </div>
            <Progress value={signals.psychology.distress_score * 100} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Retirement Readiness</span>
              <span className="font-medium">{(signals.psychology.retirement_readiness * 100).toFixed(0)}%</span>
            </div>
            <Progress value={signals.psychology.retirement_readiness * 100} className="h-2" />
          </div>
          <div className="bg-muted/50 p-3 rounded-md text-sm border border-border">
            <span className="font-semibold text-blue-600 block mb-1">Strategy:</span>
            {signals.psychology.strategy_recommendation}
          </div>
        </CardContent>
      </Card>

      {/* 2. Digital Audit (The Truth Signal) */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <SearchCheck className="h-5 w-5 text-purple-500" />
              Digital Audit
            </CardTitle>
            <Badge variant={signals.audit.digital_maturity_score > 0.7 ? "default" : "secondary"}>
              Maturity: {(signals.audit.digital_maturity_score * 100).toFixed(0)}%
            </Badge>
          </div>
          <CardDescription>Tech stack and digital footprint verification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
            <span className="text-sm text-muted-foreground">Tech Debt Level</span>
            <span className={cn(
              "text-sm font-medium",
              signals.audit.tech_debt_level.includes("High") ? "text-rose-500" : "text-emerald-500"
            )}>
              {signals.audit.tech_debt_level}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
            <span className="text-sm text-muted-foreground">Growth Reality</span>
            <span className="text-sm font-medium truncate max-w-[200px]" title={signals.audit.growth_reality_check}>
              {signals.audit.growth_reality_check}
            </span>
          </div>
          {signals.audit.red_flags.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Red Flags</span>
              {signals.audit.red_flags.map((flag, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-rose-500">
                  <AlertTriangle className="h-3 w-3" />
                  {flag}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Red Team (The Risk Signal) */}
      <Card className="border-l-4 border-l-rose-500">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-500" />
              Red Team Analysis
            </CardTitle>
            <Badge variant="destructive">
              Kill Prob: {(signals.red_team.kill_probability * 100).toFixed(0)}%
            </Badge>
          </div>
          <CardDescription>Devil's Advocate assessment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {signals.red_team.primary_deal_breaker !== "None" && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Breaker: {signals.red_team.primary_deal_breaker}
            </div>
          )}
          <ul className="space-y-2">
            {signals.red_team.devils_advocate_points.map((point, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-rose-500 mt-1">•</span>
                {point}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 4. Capital Stack (The Leverage Signal) */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-500" />
              Capital Stack
            </CardTitle>
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
              {signals.capital.feasibility}
            </Badge>
          </div>
          <CardDescription>Optimal financing structure.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">Cash on Cash</span>
              <div className="text-2xl font-bold text-emerald-600">
                {(signals.capital.cash_on_cash_return * 100).toFixed(1)}%
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">DSCR</span>
              <div className={cn(
                "text-2xl font-bold",
                signals.capital.dscr >= 1.25 ? "text-emerald-600" : "text-amber-500"
              )}>
                {signals.capital.dscr.toFixed(2)}x
              </div>
            </div>
          </div>
          
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Optimal Structure</span>
            {Object.entries(signals.capital.optimal_stack).map(([source, amount]) => (
              <div key={source} className="flex justify-between text-sm">
                <span>{source}</span>
                <span className="font-medium">${(amount / 1000).toFixed(0)}k</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
