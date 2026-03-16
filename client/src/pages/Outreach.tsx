import { useState } from "react";
import { 
  Send, 
  Mail, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DashboardLayout from "@/components/DashboardLayout";
import { cn } from "@/lib/utils";

const outreachData = [
  {
    id: "OUT-001",
    contact: "Georgia Business Brokers",
    role: "Broker",
    business: "Metro Commercial Cleaning - Atlanta",
    status: "Sent",
    lastAction: "Initial Email",
    date: "Today, 10:30 AM",
    nextStep: "Follow up in 3 days",
    score: 0.907,
    avatar: "GB"
  },
  {
    id: "OUT-002",
    contact: "Maria Rodriguez",
    role: "Broker",
    business: "Peach State Commercial Cleaning Georgia",
    status: "Scheduled",
    lastAction: "Drafted",
    date: "Tomorrow, 9:00 AM",
    nextStep: "Send Initial Email",
    score: 0.786,
    avatar: "MR"
  },
  {
    id: "OUT-003",
    contact: "Emily White",
    role: "Broker",
    business: "Logistics & Delivery Service Charlotte",
    status: "Replied",
    lastAction: "Received Reply",
    date: "Yesterday, 4:15 PM",
    nextStep: "Schedule Call",
    score: 0.759,
    avatar: "EW"
  },
  {
    id: "OUT-004",
    contact: "Lone Star Business Brokers",
    role: "Broker",
    business: "TX Government Logistics & Delivery",
    status: "Pending",
    lastAction: "Drafted",
    date: "Today, 2:00 PM",
    nextStep: "Review Draft",
    score: 0.705,
    avatar: "LS"
  }
];

export default function Outreach() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Outreach Pipeline</h1>
            <p className="text-muted-foreground">
              Track communications with brokers and sellers.
            </p>
          </div>
          <Button>
            <Send className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>

        {/* Pipeline Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">28</div>
              <p className="text-xs text-muted-foreground">+12% from last week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">64%</div>
              <p className="text-xs text-muted-foreground">+4% from last week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18%</div>
              <p className="text-xs text-muted-foreground">-2% from last week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">+1 this week</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Conversations */}
        <Card>
          <CardHeader>
            <CardTitle>Active Conversations</CardTitle>
            <CardDescription>Recent activity across all channels.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Contact</TableHead>
                  <TableHead>Business Opportunity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Next Step</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outreachData.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {item.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{item.contact}</span>
                          <span className="text-xs text-muted-foreground">{item.role}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col max-w-[200px]">
                        <span className="truncate font-medium">{item.business}</span>
                        <span className={cn(
                          "text-xs font-bold",
                          item.score >= 0.8 ? "text-emerald-600" : "text-amber-600"
                        )}>
                          Score: {item.score.toFixed(3)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        item.status === "Replied" ? "default" :
                        item.status === "Sent" ? "secondary" : "outline"
                      }>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-medium">{item.lastAction}</span>
                        <span className="text-xs text-muted-foreground">{item.date}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {item.nextStep}
                      </div>
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
      </div>
    </DashboardLayout>
  );
}
