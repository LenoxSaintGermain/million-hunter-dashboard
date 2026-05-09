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
import ThesisEngine from "./pages/ThesisEngine";
import TIDEPage from "./pages/TIDE";
import InsuranceProspector from "./pages/InsuranceProspector";
import AdminPanel from "./pages/AdminPanel";
import InviteAccept from "./pages/InviteAccept";
import DealShare from "./pages/DealShare";
import Lobby from "./pages/Lobby";
import InvestorDealRoom from "./pages/investor/DealRoom";
import InvestorDealDetail from "./pages/investor/InvestorDealDetail";
import MemoVault from "./pages/investor/MemoVault";
import MyPosition from "./pages/investor/MyPosition";
import InvestorOnboarding from "./pages/investor/InvestorOnboarding";
import InvestorScan from "./pages/investor/InvestorScan";
import InvestorScout from "./pages/investor/InvestorScout";
import InvestorDNAProfile from "./pages/investor/InvestorDNAProfile";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import CoPilot from "@/components/CoPilot";
import { useAuth } from "./_core/hooks/useAuth";

// ─── Onboarding Guard ─────────────────────────────────────────────────────────
// Handles two flows:
// 1. Operator: checks onboarding_completed → redirects to /lobby if not done
// 2. Investor: checks investor DNA quiz → redirects to /investor/onboarding if not done
// 3. Role-based redirect: investor role users land on /investor, not /
function OnboardingGuard() {
  const [location, navigate] = useLocation();
  const { data: authData } = trpc.auth.me.useQuery();
  const userRole = (authData as any)?.role as string | undefined;

  const alreadyChecked = typeof window !== "undefined" &&
    sessionStorage.getItem("onboarding_checked") === "done";

  const isPublicPage = location === "/lobby" || location === "/404" || location.startsWith("/deal-share") || location.startsWith("/invite");
  const isInvestorArea = location.startsWith("/investor");

  // Operator onboarding check
  const { data: onboarding } = trpc.user.onboardingStatus.useQuery(undefined, {
    enabled: !!authData && !isPublicPage && !alreadyChecked && !isInvestorArea && userRole !== "investor",
    staleTime: Infinity,
  });

  // Investor DNA check
  const { data: dnaStatus } = trpc.investor.getDnaStatus.useQuery(undefined, {
    enabled: !!authData && userRole === "investor" && !isPublicPage,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!authData) return;

    // Role-based redirect: investor landing on operator root → send to investor portal
    if (userRole === "investor" && (location === "/" || location === "")) {
      navigate("/investor");
      return;
    }

    // Investor DNA onboarding: if quiz not complete, redirect to onboarding
    if (userRole === "investor" && dnaStatus !== undefined && !dnaStatus.quizCompleted && location !== "/investor/onboarding") {
      navigate("/investor/onboarding");
      return;
    }

    // Operator onboarding check
    if (alreadyChecked) return;
    if (
      userRole !== "investor" &&
      onboarding !== undefined &&
      onboarding.completed === false &&
      location !== "/lobby"
    ) {
      navigate("/lobby");
    }
    if (userRole !== "investor" && onboarding?.completed === true) {
      sessionStorage.setItem("onboarding_checked", "done");
    }
  }, [authData, onboarding, dnaStatus, userRole, location, navigate, alreadyChecked]);

  return null;
}

// Renders the Co-Pilot only for operator/admin users (not investors, not on lobby/deal-share)
function GlobalCoPilot() {
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();
  const isPublicPage = location.startsWith("/lobby") || location.startsWith("/deal-share") || location.startsWith("/invite");
  const isInvestorPage = location.startsWith("/investor");
  if (!isAuthenticated || isPublicPage || isInvestorPage) return null;
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

        {/* ── Investor Portal — curated experience for capital allocators ── */}
        <Route path="/investor/onboarding" component={InvestorOnboarding} />
        <Route path="/investor" component={InvestorDealRoom} />
        <Route path="/investor/deal/:id" component={InvestorDealDetail} />
        <Route path="/investor/memos" component={MemoVault} />
        <Route path="/investor/position" component={MyPosition} />
        <Route path="/investor/scan" component={InvestorScan} />
        <Route path="/investor/scout" component={InvestorScout} />
        <Route path="/investor/dna" component={InvestorDNAProfile} />

        {/* ── Operator routes ── */}
        <Route path="/" component={Home} />
        <Route path="/scan" component={Scan} />
        <Route path="/thesis" component={ThesisEngine} />
        <Route path="/deal/:id" component={DealDetail} />
        <Route path="/memos" component={Memos} />
        <Route path="/outreach" component={Outreach} />
        <Route path="/settings" component={Settings} />
        <Route path="/freedom-map" component={FreedomMap} />
        <Route path="/strategy-blender" component={StrategyBlender} />
        <Route path="/opportunity-radar" component={OpportunityRadar} />
        <Route path="/investor-dossier" component={InvestorDossier} />
        <Route path="/scout" component={Scout} />
        <Route path="/tide" component={TIDEPage} />
        <Route path="/insurance-prospector" component={InsuranceProspector} />
        <Route path="/admin" component={AdminPanel} />

        {/* Invite accept — role assignment on first login */}
        <Route path="/invite/:token" component={InviteAccept} />

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
