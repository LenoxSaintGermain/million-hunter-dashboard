import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Scan from "./pages/Scan";
import DealDetail from "./pages/DealDetail";
import Memos from "./pages/Memos";
import Outreach from "./pages/Outreach";
import Settings from "./pages/Settings";
import FreedomMap from "./pages/FreedomMap";
import StrategyBlender from "./pages/StrategyBlender";
import OpportunityRadar from "./pages/OpportunityRadar";
import InvestorDossier from "./pages/InvestorDossier";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/scan" component={Scan} />
      <Route path="/deal/:id" component={DealDetail} />
      <Route path="/memos" component={Memos} />
      <Route path="/outreach" component={Outreach} />
      <Route path="/settings" component={Settings} />
      <Route path="/freedom-map" component={FreedomMap} />
      <Route path="/strategy-blender" component={StrategyBlender} />
      <Route path="/opportunity-radar" component={OpportunityRadar} />
      <Route path="/investor-dossier" component={InvestorDossier} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
