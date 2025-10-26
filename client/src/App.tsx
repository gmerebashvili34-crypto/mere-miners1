import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import Admin from "@/pages/Admin";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

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
          <Route path="/" component={Landing} />
          <Route path="/signup" component={SignUp} />
          <Route path="/signin" component={SignIn} />
        </>
      ) : (
        <>
          <Route path="/" component={MiningRoom} />
          <Route path="/shop" component={Shop} />
          <Route path="/wallet" component={Wallet} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/season-pass" component={SeasonPass} />
          <Route path="/profile" component={Profile} />
          <Route path="/admin" component={Admin} />
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
