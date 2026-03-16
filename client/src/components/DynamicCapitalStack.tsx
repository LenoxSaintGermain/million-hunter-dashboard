import React, { useState, useMemo } from 'react';
import { TrendingUp, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface Levers {
  revenueNote: boolean;
  greenStack: boolean;
  grantLayer: boolean;
  sellerEarnOut: boolean;
  employeePool: boolean;
  impactFund: boolean;
}

interface LeverData {
  id: keyof Levers;
  title: string;
  color: string;
  impact: string;
}

interface DynamicCapitalStackProps {
  purchasePrice: number;
  cashFlow: number;
}

const DynamicCapitalStack: React.FC<DynamicCapitalStackProps> = ({ purchasePrice, cashFlow }) => {
  const initialLevers: Levers = {
    revenueNote: false,
    greenStack: false,
    grantLayer: false,
    sellerEarnOut: false,
    employeePool: false,
    impactFund: false,
  };

  const [activeLevers, setActiveLevers] = useState<Levers>(initialLevers);

  const toggleLever = (lever: keyof Levers) => {
    setActiveLevers(prev => ({ ...prev, [lever]: !prev[lever] }));
  };

  const capitalStack = useMemo(() => {
    let sources: Record<string, number> = {};
    
    let uses = {
      purchasePrice: purchasePrice,
      dueDiligenceClosing: 135000,
      workingCapital: 15000,
    };

    let totalUses = Object.values(uses).reduce((acc, val) => acc + val, 0);
    let remainingNeed = totalUses;

    // Apply levers
    if (activeLevers.grantLayer) {
      const grantAmount = 25000;
      sources.grant = grantAmount;
      remainingNeed -= grantAmount;
    }

    if (activeLevers.greenStack) {
      const greenCapEx = 250000;
      sources.greenFinancing = greenCapEx;
      remainingNeed -= greenCapEx;
    }

    if (activeLevers.sellerEarnOut) {
      const sellerNote = purchasePrice * 0.20; // 20% seller note
      sources.sellerNote = sellerNote;
      remainingNeed -= sellerNote;
    } else {
      const sellerNote = purchasePrice * 0.10; // Original 10%
      sources.sellerNote = sellerNote;
      remainingNeed -= sellerNote;
    }

    if (activeLevers.revenueNote) {
      const revenueNoteAmount = 500000;
      sources.revenueNote = revenueNoteAmount;
      remainingNeed -= revenueNoteAmount;
    }

    if (activeLevers.impactFund) {
      const impactEquity = 250000;
      sources.impactEquity = impactEquity;
      remainingNeed -= impactEquity;
    }
    
    if (activeLevers.employeePool) {
      const payrollDeferral = 100000;
      sources.employeeCoInvest = payrollDeferral;
      remainingNeed -= payrollDeferral;
    }
    
    // SBA Loan (Max 90% LTV usually, but let's fill the gap)
    // Assume minimum 10% equity injection required on total project cost
    const minEquity = totalUses * 0.10;
    const maxSba = totalUses - minEquity;
    
    // Calculate SBA portion
    // If remaining need is greater than max SBA, we take max SBA and rest is buyer equity
    // If remaining need is less than max SBA, we take remaining need as SBA (which means >10% equity is already covered by other sources? No, SBA requires *buyer* equity usually, but let's simplify)
    
    // Simplified: SBA fills the gap up to the last dollar needed, minus buyer equity plug
    // Let's assume SBA covers whatever is left, but we force a 10% buyer equity if not covered by other "equity-like" sources (grants, impact fund)
    
    // Equity-like sources: Grant, Impact Fund, Employee Pool
    const equityLike = (sources.grant || 0) + (sources.impactEquity || 0) + (sources.employeeCoInvest || 0);
    const requiredBuyerEquity = Math.max(0, minEquity - equityLike);
    
    const sbaLoan = remainingNeed - requiredBuyerEquity;
    sources.sba7a = Math.max(0, sbaLoan);
    sources.buyerEquity = requiredBuyerEquity;

    // Recalculate totals
    const finalSourcesTotal = Object.values(sources).reduce((acc, val) => acc + (val || 0), 0);
    
    // DSCR Calculation
    // Simplified Debt Service
    const sbaService = (sources.sba7a || 0) * 0.115; // 11.5% interest only approx for simplicity
    const sellerService = (sources.sellerNote || 0) * 0.06;
    const greenService = (sources.greenFinancing || 0) * 0.05;
    const revenueService = (sources.revenueNote || 0) * 0.15;
    
    const totalDebtService = sbaService + sellerService + greenService + revenueService;
    const dscr = totalDebtService > 0 ? cashFlow / totalDebtService : 99.9;

    return { sources, uses, finalSourcesTotal, dscr };
  }, [activeLevers, purchasePrice, cashFlow]);
  
  const leversData: LeverData[] = [
    { id: 'sellerEarnOut', title: '1. Seller "Performance-Earn-Out"', color: 'blue', impact: 'Reduces day-one cash by 20%; aligns seller.' },
    { id: 'revenueNote', title: '2. Certification-Backed Revenue Note', color: 'indigo', impact: 'Substitutes $500k of debt with non-dilutive capital.' },
    { id: 'impactFund', title: '3. Veteran/Minority Impact Fund Slice', color: 'purple', impact: 'Replaces home-equity with strategic pref equity.' },
    { id: 'greenStack', title: '4. Energy-Efficiency "Green Stack"', color: 'green', impact: 'Removes ≈$250k of cap-ex from uses table.' },
    { id: 'employeePool', title: '5. Employee Co-Invest Pool', color: 'yellow', impact: 'Converts $100k wage cash into equity-like capital.' },
    { id: 'grantLayer', title: '6. Local Grant Layer', color: 'red', impact: 'Adds $25k grant as "equity-like" capital.' },
  ];

  const getDSCRStatus = (dscr: number) => {
    if (dscr >= 1.5) return { color: 'text-emerald-600', bg: 'bg-emerald-50', status: 'Excellent' };
    if (dscr >= 1.25) return { color: 'text-amber-600', bg: 'bg-amber-50', status: 'Good' };
    return { color: 'text-rose-600', bg: 'bg-rose-50', status: 'Risk' };
  };

  const dscrStatus = getDSCRStatus(capitalStack.dscr);

  const getColorClasses = (color: string, isActive: boolean) => {
    const colorMap: Record<string, any> = {
      blue: { border: isActive ? 'border-l-blue-500' : 'border-l-gray-300', bg: isActive ? 'bg-blue-50/50' : '' },
      indigo: { border: isActive ? 'border-l-indigo-500' : 'border-l-gray-300', bg: isActive ? 'bg-indigo-50/50' : '' },
      purple: { border: isActive ? 'border-l-purple-500' : 'border-l-gray-300', bg: isActive ? 'bg-purple-50/50' : '' },
      green: { border: isActive ? 'border-l-emerald-500' : 'border-l-gray-300', bg: isActive ? 'bg-emerald-50/50' : '' },
      yellow: { border: isActive ? 'border-l-amber-500' : 'border-l-gray-300', bg: isActive ? 'bg-amber-50/50' : '' },
      red: { border: isActive ? 'border-l-rose-500' : 'border-l-gray-300', bg: isActive ? 'bg-rose-50/50' : '' }
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="space-y-8">
      {/* Levers Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-purple-500" />
          Capital Structure Levers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leversData.map(lever => {
            const isActive = activeLevers[lever.id];
            const colors = getColorClasses(lever.color, isActive);
            
            return (
              <Card 
                key={lever.id} 
                className={cn(
                  "cursor-pointer transition-all duration-300 hover:shadow-md border-l-4",
                  colors.border,
                  colors.bg
                )}
                onClick={() => toggleLever(lever.id)}
              >
                <CardHeader className="pb-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-bold flex-1 leading-tight">
                      {lever.title}
                    </CardTitle>
                    <Checkbox
                      checked={isActive}
                      onCheckedChange={() => toggleLever(lever.id)}
                      className="mt-0.5 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">{lever.impact}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Capital Stack Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sources of Capital</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(capitalStack.sources).map(([key, value]) => (
                value > 0 && (
                  <div key={key} className="flex justify-between py-2 border-b border-border last:border-0">
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-mono font-semibold">{formatCurrency(value)}</span>
                  </div>
                )
              ))}
              <div className="flex justify-between py-2 pt-4 font-bold border-t border-border mt-2">
                <span>Total Sources</span>
                <span>{formatCurrency(capitalStack.finalSourcesTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deal Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">DSCR (Debt Service Coverage)</span>
                <span className={cn("px-2 py-1 rounded text-xs font-bold", dscrStatus.bg, dscrStatus.color)}>
                  {dscrStatus.status}
                </span>
              </div>
              <div className="text-3xl font-bold">{capitalStack.dscr.toFixed(2)}x</div>
              <p className="text-xs text-muted-foreground">Target: &gt;1.25x</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Buyer Equity Required</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {formatCurrency(capitalStack.sources.buyerEquity || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {((capitalStack.sources.buyerEquity || 0) / purchasePrice * 100).toFixed(1)}% of Purchase Price
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DynamicCapitalStack;
