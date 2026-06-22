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
import CapitalStack from "./pages/CapitalStack";
import AdminPanel from "./pages/AdminPanel";
import OperatorRegistry from "./pages/OperatorRegistry";
import OperatorIdentity from "./pages/OperatorIdentity";
import InviteAccept from "./pages/InviteAccept";
import DealShare from "./pages/DealShare";
import Lobby from "./pages/Lobby";
import ICReview from "./pages/ICReview";
import BehavioralProfile from "./pages/BehavioralProfile";
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
import { useAuth } from "./_core/hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import PublicSearch from "./pages/PublicSearch";
import DemoScenario from "./pages/DemoScenario";
import DemoTour from "./pages/DemoTour";
import RippleEffect from "./pages/RippleEffect";
import { getLoginUrl } from "./const";

// ─── Protected Route ─────────────────────────────────────────────────────────
// Redirects unauthenticated users to the landing page.
// Shows nothing while auth state is loading to prevent flash.
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null; // silent while resolving
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }
  return <Component />;
}

// ─── Root Route ───────────────────────────────────────────────────────────────
// Authenticated users → Command Center. Unauth → Marketing Landing Page.
function RootRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <LandingPage />;
  return <Home />;
}

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

  // Investor DNA check — staleTime intentionally NOT set to Infinity so cache invalidation
  // after quiz completion triggers a fresh fetch and clears the onboarding redirect.
  const { data: dnaStatus } = trpc.investor.getDnaStatus.useQuery(undefined, {
    enabled: !!authData && userRole === "investor" && !isPublicPage,
    staleTime: 0,
  });

  useEffect(() => {
    if (!authData) return;

    // Role-based redirect: investor landing on operator root → send to investor portal
    if (userRole === "investor" && (location === "/" || location === "")) {
      navigate("/investor");
      return;
    }

    // Investor DNA onboarding: if quiz not complete, redirect to onboarding.
    // Belt-and-suspenders: also check authData.onboardingCompleted as a bypass —
    // if the DB record says complete, never redirect even if the dnaStatus cache is stale.
    const onboardingCompletedInDb = !!(authData as any)?.onboardingCompleted;
    if (
      userRole === "investor" &&
      !onboardingCompletedInDb &&
      dnaStatus !== undefined &&
      dnaStatus.quizCompleted === false &&
      location !== "/investor/onboarding"
    ) {
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

        {/* ── Public routes (no auth required) ── */}
        <Route path="/explore" component={PublicSearch} />
        <Route path="/demo" component={DemoScenario} />
        <Route path="/demo-tour" component={DemoTour} />

        {/* ── Root: Landing for unauth, Command Center for auth ── */}
        <Route path="/" component={RootRoute} />

        {/* ── Operator routes — all protected ── */}
        <Route path="/scan">{() => <ProtectedRoute component={Scan} />}</Route>
        <Route path="/thesis">{() => <ProtectedRoute component={ThesisEngine} />}</Route>
        <Route path="/deal/:id">{() => <ProtectedRoute component={DealDetail} />}</Route>
        <Route path="/ic-review/:id">{() => <ProtectedRoute component={ICReview} />}</Route>
        <Route path="/behavioral/:id">{() => <ProtectedRoute component={BehavioralProfile} />}</Route>
        <Route path="/memos">{() => <ProtectedRoute component={Memos} />}</Route>
        <Route path="/outreach">{() => <ProtectedRoute component={Outreach} />}</Route>
        <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
        <Route path="/freedom-map">{() => <ProtectedRoute component={FreedomMap} />}</Route>
        <Route path="/strategy-blender">{() => <ProtectedRoute component={StrategyBlender} />}</Route>
        <Route path="/opportunity-radar">{() => <ProtectedRoute component={OpportunityRadar} />}</Route>
        <Route path="/investor-dossier">{() => <ProtectedRoute component={InvestorDossier} />}</Route>
        <Route path="/scout">{() => <ProtectedRoute component={Scout} />}</Route>
        <Route path="/tide">{() => <ProtectedRoute component={TIDEPage} />}</Route>
        <Route path="/insurance-prospector">{() => <ProtectedRoute component={InsuranceProspector} />}</Route>
        <Route path="/stack">{() => <ProtectedRoute component={CapitalStack} />}</Route>
        <Route path="/ripple">{() => <ProtectedRoute component={RippleEffect} />}</Route>
        <Route path="/admin">{() => <ProtectedRoute component={AdminPanel} />}</Route>
        <Route path="/operator-registry">{() => <ProtectedRoute component={OperatorRegistry} />}</Route>
        <Route path="/profile">{() => <ProtectedRoute component={OperatorIdentity} />}</Route>

        {/* Invite accept — role assignment on first login */}
        <Route path="/invite/:token" component={InviteAccept} />

        {/* Public deal share — no auth required */}
        <Route path="/deal-share/:token" component={DealShare} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster theme="light" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
