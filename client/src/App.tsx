import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
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
import Scout from "./pages/Scout";
import DealShare from "./pages/DealShare";
import Lobby from "./pages/Lobby";
import InvestorDealRoom from "./pages/investor/DealRoom";
import InvestorDealDetail from "./pages/investor/InvestorDealDetail";
import MemoVault from "./pages/investor/MemoVault";
import MyPosition from "./pages/investor/MyPosition";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import CoPilot from "@/components/CoPilot";
import { useAuth } from "./_core/hooks/useAuth";

// ─── Onboarding Guard ─────────────────────────────────────────────────────────
// Checks if the authenticated user has completed onboarding.
// If not, redirects them to /lobby once. Runs silently in the background.
// Uses sessionStorage to avoid re-checking after the user has exited the lobby
// (since the mutation + hard reload ensures DB is updated before this runs again).
function OnboardingGuard() {
  const [location, navigate] = useLocation();
  const { data: authData } = trpc.auth.me.useQuery();

  // Skip the check entirely if the user just exited the lobby this session
  const alreadyChecked = typeof window !== "undefined" &&
    sessionStorage.getItem("onboarding_checked") === "done";

  const { data: onboarding } = trpc.user.onboardingStatus.useQuery(undefined, {
    // Only fetch when: authenticated, not on lobby/404, not investor portal, and not already cleared this session
    enabled: !!authData && location !== "/lobby" && location !== "/404" && !alreadyChecked && !location.startsWith("/investor"),
    staleTime: Infinity, // Only check once per session
  });

  useEffect(() => {
    if (alreadyChecked) return;
    // If authenticated, onboarding loaded, not completed, and not already on lobby → redirect
    if (
      authData &&
      onboarding !== undefined &&
      onboarding.completed === false &&
      location !== "/lobby"
    ) {
      navigate("/lobby");
    }
    // If completed, mark session so we never check again
    if (authData && onboarding?.completed === true) {
      sessionStorage.setItem("onboarding_checked", "done");
    }
  }, [authData, onboarding, location, navigate, alreadyChecked]);

  return null;
}

// Renders the Co-Pilot only for operator/admin users (not investors, not on lobby/deal-share)
function GlobalCoPilot() {
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();
  const isPublicPage = location.startsWith("/lobby") || location.startsWith("/deal-share");
  const isInvestorPage = location.startsWith("/investor");
  if (!isAuthenticated || isPublicPage || isInvestorPage) return null;
  // Hide Co-Pilot for investor role — they get a clean read-only experience
  if ((user as any)?.role === "investor") return null;
  return <CoPilot />;
}

function Router() {
  return (
    <>
      <OnboardingGuard />
      <Switch>
        {/* Lobby — cinematic first-login onboarding */}
        <Route path="/lobby" component={Lobby} />

        {/* ── Investor Portal — curated read-only view for capital allocators ── */}
        <Route path="/investor" component={InvestorDealRoom} />
        <Route path="/investor/deal/:id" component={InvestorDealDetail} />
        <Route path="/investor/memos" component={MemoVault} />
        <Route path="/investor/position" component={MyPosition} />

        {/* ── Operator routes ── */}
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
        <Route path="/scout" component={Scout} />

        {/* Public deal share — no auth required */}
        <Route path="/deal-share/:token" component={DealShare} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      <GlobalCoPilot />
    </>
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
