import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  ExternalLink,
  MapPin,
  Building2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import DashboardLayout from "@/components/DashboardLayout";
import SignalDetail from "@/components/SignalDetail";
import { cn } from "@/lib/utils";

// Mock data for a single deal (would be fetched by ID)
const dealData = {
  id: "SBA-GA-001",
  name: "Metro Commercial Cleaning - Atlanta",
  description: "Established commercial cleaning service with 30+ recurring contracts. Owner retiring after 30 years. Strong reputation in medical and office sectors. No website, manual dispatch system.",
  asking_price: 2100000,
  cash_flow: 720000,
  revenue: 1850000,
  multiple: 2.92,
  location: "Atlanta, GA",
  industry: "Facilities Services",
  listing_date: "2026-03-10",
  broker: "Georgia Business Brokers",
  score: 0.907,
  status: "High Priority",
  signals: {
    psychology: {
      distress_score: 0.2,
      retirement_readiness: 0.9,
      negotiation_style: "emotional",
      leverage_points: ["Retirement Motivation: retiring, legacy"],
      strategy_recommendation: "Emphasize legacy preservation and taking care of employees. Propose a smooth transition period."
    },
    audit: {
      digital_maturity_score: 0.2,
      tech_debt_level: "High (Significant Investment Needed)",
      growth_reality_check: "Consistent: Growth Aligns with Digital Footprint",
      red_flags: ["Operational Opportunity: no website", "Operational Opportunity: manual processes"]
    },
    red_team: {
      kill_probability: 0.1,
      primary_deal_breaker: "None",
      devils_advocate_points: ["Key Man Risk: Owner heavily involved in daily ops."]
    },
    capital: {
      feasibility: "High (SBA Eligible)",
      cash_on_cash_return: 0.42,
      dscr: 1.85,
      optimal_stack: {
        "SBA Loan (80%)": 1680000,
        "Seller Note (10%)": 210000,
        "Equity Injection (10%)": 210000
      }
    }
  }
};

export default function DealDetail() {
  const [match, params] = useRoute("/deal/:id");
  const id = params?.id;

  // In a real app, fetch deal data based on ID
  // const { data: deal, isLoading } = useQuery(['deal', id], () => fetchDeal(id));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header / Nav */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{dealData.name}</h1>
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                Score: {dealData.score}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {dealData.location}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {dealData.industry}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Listed: {dealData.listing_date}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Export Memo
            </Button>
          </div>
        </div>

        {/* Key Financials */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Asking Price</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(dealData.asking_price / 1000000).toFixed(2)}M</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash Flow (SDE)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">${(dealData.cash_flow / 1000).toFixed(0)}k</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(dealData.revenue / 1000000).toFixed(2)}M</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Multiple</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{dealData.multiple}x</div>
            </CardContent>
          </Card>
        </div>

        {/* Third Signal Analysis */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Third Signal Analysis</h2>
          <SignalDetail signals={dealData.signals} />
        </div>

        {/* Description & Broker Info */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Business Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {dealData.description}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Broker Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{dealData.broker}</p>
                  <p className="text-xs text-muted-foreground">Listing Agent</p>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Original Listing
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
