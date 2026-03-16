import { useState } from "react";
import { 
  Save, 
  Sliders, 
  Database, 
  Bell, 
  Shield, 
  CreditCard,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";

export default function Settings() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
            <p className="text-muted-foreground">
              Configure your acquisition criteria, notifications, and integrations.
            </p>
          </div>
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="criteria" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="criteria">Acquisition Criteria</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>
          
          <TabsContent value="criteria" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial Thresholds</CardTitle>
                <CardDescription>
                  Set the minimum financial requirements for opportunities to be flagged.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-revenue">Minimum Revenue</Label>
                    <Input id="min-revenue" defaultValue="$1,000,000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-revenue">Maximum Revenue</Label>
                    <Input id="max-revenue" defaultValue="$10,000,000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min-cashflow">Minimum Cash Flow (SDE)</Label>
                    <Input id="min-cashflow" defaultValue="$400,000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-multiple">Maximum Multiple (SDE)</Label>
                    <Input id="max-multiple" defaultValue="4.5x" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Scoring Weights</CardTitle>
                <CardDescription>
                  Adjust the importance of different factors in the AI scoring algorithm.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="financial-weight" className="flex-1">Financial Performance</Label>
                    <span className="text-sm font-medium w-12 text-right">55%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[55%]" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="strategic-weight" className="flex-1">Strategic Fit (AI/Govt)</Label>
                    <span className="text-sm font-medium w-12 text-right">30%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[30%]" />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="deal-weight" className="flex-1">Deal Structure</Label>
                    <span className="text-sm font-medium w-12 text-right">15%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-[15%]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Alert Preferences</CardTitle>
                <CardDescription>
                  Choose how and when you want to be notified about new opportunities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="email-alerts" className="flex flex-col space-y-1">
                    <span>Email Alerts</span>
                    <span className="font-normal text-xs text-muted-foreground">Receive daily summaries via email.</span>
                  </Label>
                  <Switch id="email-alerts" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="sms-alerts" className="flex flex-col space-y-1">
                    <span>SMS Alerts (High Priority Only)</span>
                    <span className="font-normal text-xs text-muted-foreground">Get text messages for opportunities scoring &gt; 0.90.</span>
                  </Label>
                  <Switch id="sms-alerts" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="browser-notifications" className="flex flex-col space-y-1">
                    <span>Browser Notifications</span>
                    <span className="font-normal text-xs text-muted-foreground">Show desktop notifications when scan completes.</span>
                  </Label>
                  <Switch id="browser-notifications" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
