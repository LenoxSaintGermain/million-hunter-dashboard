import { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  MapPin,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { cn } from "@/lib/utils";

// Mock data for scan results
const scanResults = [
  {
    id: "SBA-GA-001",
    name: "Metro Commercial Cleaning - Atlanta",
    revenue: 1850000,
    cashFlow: 720000,
    asking: 2100000,
    score: 0.907,
    platform: "BizBuySell",
    location: "Atlanta, GA",
    industry: "Facilities Services",
    redFlags: []
  },
  {
    id: "SBA-GA-002",
    name: "Peach State Commercial Cleaning Georgia",
    revenue: 3500000,
    cashFlow: 1100000,
    asking: 4000000,
    score: 0.786,
    platform: "DealStream",
    location: "Atlanta, GA",
    industry: "Facilities Services",
    redFlags: []
  },
  {
    id: "SBA-NC-003",
    name: "Logistics & Delivery Service Charlotte",
    revenue: 6500000,
    cashFlow: 1900000,
    asking: 7600000,
    score: 0.759,
    platform: "Flippa",
    location: "Charlotte, NC",
    industry: "Logistics",
    redFlags: []
  },
  {
    id: "SBA-TX-004",
    name: "TX Government Logistics & Delivery",
    revenue: 6200000,
    cashFlow: 1800000,
    asking: 6500000,
    score: 0.705,
    platform: "BizQuest",
    location: "Dallas, TX",
    industry: "Logistics",
    redFlags: []
  },
  {
    id: "SBA-GA-005",
    name: "Route-Based Pest Control Service Atlanta",
    revenue: 1500000,
    cashFlow: 650000,
    asking: 2270000,
    score: 0.670,
    platform: "BizBuySell",
    location: "Atlanta, GA",
    industry: "Pest Control",
    redFlags: []
  },
  {
    id: "SBA-TX-006",
    name: "Texas Waste Management Solutions",
    revenue: 7200000,
    cashFlow: 1800000,
    asking: 7200000,
    score: 0.656,
    platform: "BusinessesForSale",
    location: "Houston, TX",
    industry: "Waste Management",
    redFlags: ["Customer Concentration"]
  },
  {
    id: "SBA-AZ-007",
    name: "Desert Route Pest Control, AZ",
    revenue: 1200000,
    cashFlow: 450000,
    asking: 1600000,
    score: 0.620,
    platform: "BizQuest",
    location: "Phoenix, AZ",
    industry: "Pest Control",
    redFlags: []
  },
  {
    id: "SBA-FL-008",
    name: "Florida Route-Based Delivery",
    revenue: 2500000,
    cashFlow: 950000,
    asking: 2850000,
    score: 0.607,
    platform: "Sunbelt",
    location: "Miami, FL",
    industry: "Logistics",
    redFlags: ["Declining Revenue"]
  }
];

export default function Scan() {
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  const filteredResults = scanResults.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = platformFilter === "all" || item.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Market Scan</h1>
            <p className="text-muted-foreground">
              Real-time feed from 11 connected marketplaces. Last updated: 12:41 PM
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button>
              <RefreshCw className="mr-2 h-4 w-4" />
              Run New Scan
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, location, or industry..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="BizBuySell">BizBuySell</SelectItem>
              <SelectItem value="BizQuest">BizQuest</SelectItem>
              <SelectItem value="DealStream">DealStream</SelectItem>
              <SelectItem value="Flippa">Flippa</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Results Table */}
        <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[300px]">Business</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Financials</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((item) => (
                <TableRow key={item.id} className="group hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{item.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                        <span className="mx-1">•</span>
                        {item.industry}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {item.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex justify-between w-32">
                        <span className="text-muted-foreground">Rev:</span>
                        <span className="font-medium">${(item.revenue / 1000000).toFixed(2)}M</span>
                      </div>
                      <div className="flex justify-between w-32">
                        <span className="text-muted-foreground">CF:</span>
                        <span className="font-medium text-emerald-600">${(item.cashFlow / 1000).toFixed(0)}k</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm border-2",
                        item.score >= 0.8 ? "border-emerald-500 text-emerald-600 bg-emerald-50" :
                        item.score >= 0.7 ? "border-amber-500 text-amber-600 bg-amber-50" :
                        "border-muted text-muted-foreground bg-muted/20"
                      )}>
                        {(item.score * 100).toFixed(0)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.redFlags.length > 0 ? (
                      <div className="flex items-center gap-1 text-rose-500 text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {item.redFlags[0]}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Clean
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="secondary">
                      Analyze
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
