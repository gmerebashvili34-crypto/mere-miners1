import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
// import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import SignUp from "@/pages/SignUp";
import SignIn from "@/pages/SignIn";
import MiningRoom from "@/pages/MiningRoom";
import Shop from "@/pages/Shop";
import Wallet from "@/pages/Wallet";
import Leaderboard from "@/pages/Leaderboard";
import SeasonPass from "@/pages/SeasonPass";
import Profile from "@/pages/Profile";
// import Games from "@/pages/Games";
import AdminSweeps from "@/pages/AdminSweeps";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  function RedirectTo({ to }: { to: string }) {
    const [, setLocation] = useLocation();
    useEffect(() => {
      setLocation(to);
    }, [to, setLocation]);
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-primary font-semibold">Loading MereMiners...</div>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          {/* Public auth pages first to avoid any matching ambiguity */}
          <Route path="/signup" component={SignUp} />
          <Route path="/signin" component={SignIn} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          {/* If unauthenticated user visits /home, send them to Sign In */}
          <Route path="/home" component={SignIn} />
          {/* Landing at root */}
          <Route path="/" component={Landing} />
        </>
      ) : (
        <>
          {/* App home after authentication */}
          <Route path="/home" component={MiningRoom} />
          {/* If an authenticated user hits /signin or /signup, send them to /home */}
          <Route path="/signin" component={() => <RedirectTo to="/home" />} />
          <Route path="/signup" component={() => <RedirectTo to="/home" />} />
          {/* Keep password routes accessible even when logged in */}
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/shop" component={Shop} />
          <Route path="/wallet" component={Wallet} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/season-pass" component={SeasonPass} />
          {/* <Route path="/games" component={Games} /> */}
          <Route path="/profile" component={Profile} />
          <Route path="/admin/sweeps" component={AdminSweeps} />
          {/* Keep landing available even when logged in */}
          <Route path="/" component={Landing} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
