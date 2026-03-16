import { useState } from "react";
import { 
  FileText, 
  Download, 
  Share2, 
  Eye, 
  Calendar,
  Clock,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import DashboardLayout from "@/components/DashboardLayout";

const memos = [
  {
    id: "MEMO-001",
    title: "Investment Memo: Metro Commercial Cleaning",
    date: "Mar 16, 2026",
    score: 0.907,
    status: "Ready",
    type: "Full Report",
    size: "2.4 MB"
  },
  {
    id: "MEMO-002",
    title: "Investment Memo: Peach State Commercial Cleaning",
    date: "Mar 16, 2026",
    score: 0.786,
    status: "Ready",
    type: "Summary",
    size: "1.1 MB"
  },
  {
    id: "MEMO-003",
    title: "Investment Memo: Logistics & Delivery Service Charlotte",
    date: "Mar 15, 2026",
    score: 0.759,
    status: "Draft",
    type: "Preliminary",
    size: "0.8 MB"
  }
];

export default function Memos() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Investment Memos</h1>
            <p className="text-muted-foreground">
              AI-generated deep dive reports for qualified opportunities.
            </p>
          </div>
          <Button>
            <FileText className="mr-2 h-4 w-4" />
            Generate New Memo
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {memos.map((memo) => (
            <Card key={memo.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="mt-4 text-lg leading-tight">
                  {memo.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Calendar className="h-3 w-3" />
                  {memo.date}
                  <span className="mx-1">•</span>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {memo.type}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Score</span>
                    <span className="font-bold text-emerald-600 text-lg">{memo.score.toFixed(3)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Size</span>
                    <span className="font-medium">{memo.size}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 flex gap-2">
                <Button variant="outline" className="flex-1">
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </CardFooter>
            </Card>
          ))}
          
          {/* Empty State / Add New */}
          <button className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-muted rounded-xl p-8 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground h-full min-h-[280px]">
            <div className="p-4 bg-muted rounded-full">
              <FileText className="h-8 w-8 opacity-50" />
            </div>
            <div className="text-center">
              <h3 className="font-medium">Generate New Report</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Select an opportunity to analyze
              </p>
            </div>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
