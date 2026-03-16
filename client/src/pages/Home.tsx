import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  MoreHorizontal
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/DashboardLayout";
import { cn } from "@/lib/utils";

// Mock data for initial render (will be replaced by real data fetch)
const opportunities = [
  {
    id: "SBA-GA-001",
    name: "Metro Commercial Cleaning - Atlanta",
    revenue: 1850000,
    cashFlow: 720000,
    asking: 2100000,
    score: 0.907,
    status: "High Priority",
    trend: "up",
    location: "Atlanta, GA"
  },
  {
    id: "SBA-GA-002",
    name: "Peach State Commercial Cleaning Georgia",
    revenue: 3500000,
    cashFlow: 1100000,
    asking: 4000000,
    score: 0.786,
    status: "Qualified",
    trend: "stable",
    location: "Atlanta, GA"
  },
  {
    id: "SBA-NC-003",
    name: "Logistics & Delivery Service Charlotte",
    revenue: 6500000,
    cashFlow: 1900000,
    asking: 7600000,
    score: 0.759,
    status: "Qualified",
    trend: "up",
    location: "Charlotte, NC"
  },
  {
    id: "SBA-TX-004",
    name: "TX Government Logistics & Delivery",
    revenue: 6200000,
    cashFlow: 1800000,
    asking: 6500000,
    score: 0.705,
    status: "Qualified",
    trend: "down",
    location: "Dallas, TX"
  },
  {
    id: "SBA-GA-005",
    name: "Route-Based Pest Control Service Atlanta",
    revenue: 1500000,
    cashFlow: 650000,
    asking: 2270000,
    score: 0.670,
    status: "Review",
    trend: "stable",
    location: "Atlanta, GA"
  }
];

export default function Home() {
  return (
    <DashboardLayout>
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/90 to-primary text-primary-foreground p-8 shadow-lg">
        <div className="absolute inset-0 opacity-20 bg-[url('https://d2xsxph8kpxj0f.cloudfront.net/87291783/GeCPeFFiEBRZFpk6xckkAz/hero-background-QfT7XBwYK438J3BgUvLss9.webp')] bg-cover bg-center mix-blend-overlay" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">Good Morning, Lenox</h2>
            <p className="text-primary-foreground/80 max-w-xl">
              Market scan complete. 55 new listings analyzed across 11 platforms. 
              4 high-potential opportunities identified for immediate review.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="shadow-sm">
              <Activity className="mr-2 h-4 w-4" />
              View Report
            </Button>
            <Button className="bg-white text-primary hover:bg-white/90 shadow-sm">
              <TrendingUp className="mr-2 h-4 w-4" />
              Start Outreach
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pipeline Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12.4M</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
              <span className="text-emerald-500 font-medium">+15%</span> from last week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Opportunities
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <span className="text-emerald-500 font-medium">4 new</span> today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outreach Sent
            </CardTitle>
            <SendIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
              <span className="text-emerald-500 font-medium">+8</span> this week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Deal Score
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0.74</div>
            <div className="w-full bg-secondary h-1.5 mt-3 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: '74%' }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Opportunities Table */}
        <Card className="md:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Top Opportunities</CardTitle>
              <CardDescription>
                Ranked by AI scoring algorithm based on financials, strategic fit, and deal structure.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="mr-2 h-3 w-3" />
              Filter
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Business Name</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Cash Flow</TableHead>
                  <TableHead>Asking</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map((opp) => (
                  <TableRow key={opp.id} className="group cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => window.location.href = `/deal/${opp.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-foreground group-hover:text-primary transition-colors">
                          {opp.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{opp.location}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-bold",
                          opp.score >= 0.8 ? "text-emerald-600" : 
                          opp.score >= 0.7 ? "text-amber-600" : "text-muted-foreground"
                        )}>
                          {opp.score.toFixed(3)}
                        </span>
                        {opp.trend === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                        {opp.trend === 'down' && <ArrowDownRight className="h-3 w-3 text-rose-500" />}
                      </div>
                    </TableCell>
                    <TableCell>${(opp.cashFlow / 1000).toFixed(0)}k</TableCell>
                    <TableCell>${(opp.asking / 1000000).toFixed(2)}M</TableCell>
                    <TableCell>
                      <Badge variant={
                        opp.status === "High Priority" ? "default" : 
                        opp.status === "Qualified" ? "secondary" : "outline"
                      }>
                        {opp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Side Panel - Recent Activity */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Live Feed</CardTitle>
            <CardDescription>Real-time system updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { time: "10m ago", text: "New listing found in Atlanta (HVAC)", type: "scan" },
                { time: "25m ago", text: "Outreach email sent to Broker: Georgia Business Brokers", type: "email" },
                { time: "1h ago", text: "Investment Memo generated for SBA-GA-001", type: "doc" },
                { time: "2h ago", text: "Market scan completed: 55 listings processed", type: "system" },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={cn(
                    "w-2 h-2 mt-2 rounded-full shrink-0",
                    item.type === 'scan' ? "bg-blue-500" :
                    item.type === 'email' ? "bg-purple-500" :
                    item.type === 'doc' ? "bg-amber-500" : "bg-emerald-500"
                  )} />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{item.text}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-border">
              <h4 className="text-sm font-medium mb-4">System Status</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Scraper Engine</span>
                  <span className="text-emerald-500 font-medium">Operational</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Scoring Model</span>
                  <span className="text-emerald-500 font-medium">v2.1 Active</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">API Quota</span>
                  <span className="text-primary font-medium">85% Remaining</span>
                </div>
                <Progress value={15} className="h-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function SendIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}
