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
import InvestorBrief from "./pages/InvestorBrief";
import Walkthrough from "./pages/Walkthrough";
import Pricing from "./pages/Pricing";
import Wingate from "./pages/Wingate";
import AssetDossier from "./pages/AssetDossier";
import AssetShare from "./pages/AssetShare";
import VerificationQueue from "./pages/VerificationQueue";
import ThesisStudio from "./pages/ThesisStudio";
import CsvImport from "./pages/CsvImport";
import SourcingSchedules from "./pages/SourcingSchedules";
import OffMarketDiscovery from "./pages/OffMarketDiscovery";
import ApertureHome from "./pages/aperture/ApertureHome";
import ThesisGraphEditor from "./pages/aperture/ThesisGraphEditor";
import ExposureMap from "./pages/aperture/ExposureMap";
import CandidateBoard from "./pages/aperture/CandidateBoard";
import StrategyCompare from "./pages/aperture/StrategyCompare";
import MemoDrawer from "./pages/aperture/MemoDrawer";
import ApertureExecute from "./pages/aperture/ApertureExecute";
import ApertureAccounts from "./pages/aperture/ApertureAccounts";
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

  const isPublicPage = location === "/lobby" || location === "/404" || location.startsWith("/deal-share") || location.startsWith("/asset-share") || location.startsWith("/invite") || location === "/brief" || location === "/explore" || location === "/demo" || location === "/demo-tour" || location === "/walkthrough" || location === "/pricing";
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

    // Role-based redirect: a client landing on the operator root goes to THEIR
    // THESIS, not the business Deal Room. Signal Hunter is thesis-driven — for a
    // bespoke property mandate the operating-company pipeline is the wrong first
    // screen. The Deal Room stays one click away in the client nav.
    if ((userRole === "investor" || userRole === "insurance") && (location === "/" || location === "")) {
      navigate("/wingate");
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
        <Route path="/brief" component={InvestorBrief} />
        <Route path="/walkthrough" component={Walkthrough} />
        <Route path="/pricing" component={Pricing} />

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
        <Route path="/wingate">{() => <ProtectedRoute component={Wingate} />}</Route>
        {/* Full-page asset dossier — the property-class equivalent of /deal/:id.
            Linked from Command Center, Scout, and the Wingate preview modal. */}
        {/* Operator research queue — unverified critical fields across the pipeline. */}
        {/* Criteria dials — operators AND clients (scoped to their own theses). */}
        <Route path="/theses">{() => <ProtectedRoute component={ThesisStudio} />}</Route>
        <Route path="/off-market">{() => <ProtectedRoute component={OffMarketDiscovery} />}</Route>
        <Route path="/schedules">{() => <ProtectedRoute component={SourcingSchedules} />}</Route>
        <Route path="/import">{() => <ProtectedRoute component={CsvImport} />}</Route>
        <Route path="/verify">{() => <ProtectedRoute component={VerificationQueue} />}</Route>
        <Route path="/wingate/asset/:id">{() => <ProtectedRoute component={AssetDossier} />}</Route>

        {/* ── Capital Aperture — liquid securities engine ── */}
        <Route path="/aperture">{() => <ProtectedRoute component={ApertureHome} />}</Route>
        <Route path="/aperture/thesis/new">{() => <ProtectedRoute component={ThesisGraphEditor} />}</Route>
        <Route path="/aperture/thesis/:id">{() => <ProtectedRoute component={ThesisGraphEditor} />}</Route>
        <Route path="/aperture/run/:id">{() => <ProtectedRoute component={CandidateBoard} />}</Route>
        <Route path="/aperture/run/:id/exposure">{() => <ProtectedRoute component={ExposureMap} />}</Route>
        <Route path="/aperture/run/:id/strategies">{() => <ProtectedRoute component={StrategyCompare} />}</Route>
        <Route path="/aperture/run/:runId/memo/:candidateId">{() => <ProtectedRoute component={MemoDrawer} />}</Route>
        <Route path="/aperture/run/:id/execute">{() => <ProtectedRoute component={ApertureExecute} />}</Route>
        <Route path="/aperture/accounts">{() => <ProtectedRoute component={ApertureAccounts} />}</Route>

        {/* Invite accept — role assignment on first login */}
        <Route path="/invite/:token" component={InviteAccept} />

        {/* Public deal share — no auth required */}
        <Route path="/deal-share/:token" component={DealShare} />
        {/* Public highlight card for a property dossier — no auth required. */}
        <Route path="/asset-share/:token" component={AssetShare} />
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
