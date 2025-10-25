import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { User as UserIcon, Trophy, Zap, TrendingUp, LogOut, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE, formatUSD, mereToUSD } from "@/lib/constants";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copiedReferral, setCopiedReferral] = useState(false);

  const handleCopyReferral = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(`https://mereminers.com/ref/${user.referralCode}`);
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
    }
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const mereBalance = parseFloat(user?.mereBalance || "0");
  const totalMined = parseFloat(user?.totalMined || "0");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <h1 className="font-display font-bold text-2xl bg-gold-gradient bg-clip-text text-transparent flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-primary" />
            Profile
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <Card className="p-6 bg-gradient-to-br from-card to-accent/20 border-card-border">
          <div className="flex items-start gap-4">
            <Avatar className="w-20 h-20 border-2 border-primary">
              <AvatarImage src={user?.profileImageUrl || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <h2 className="font-display font-bold text-xl mb-1" data-testid="text-user-name">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.firstName || user?.email?.split("@")[0] || "Miner"}
              </h2>
              {user?.email && (
                <p className="text-sm text-muted-foreground mb-3" data-testid="text-user-email">
                  {user.email}
                </p>
              )}
              <Badge className="bg-primary text-primary-foreground">Active Miner</Badge>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive"
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="p-6 border-card-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div className="text-sm text-muted-foreground">Total Mined</div>
            </div>
            <div className="font-display font-bold text-3xl bg-gold-gradient bg-clip-text text-transparent" data-testid="text-total-mined">
              {formatMERE(totalMined)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ≈ {formatUSD(mereToUSD(totalMined))}
            </div>
          </Card>

          <Card className="p-6 border-card-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="text-sm text-muted-foreground">Current Balance</div>
            </div>
            <div className="font-display font-bold text-3xl bg-gold-gradient bg-clip-text text-transparent" data-testid="text-current-balance">
              {formatMERE(mereBalance)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ≈ {formatUSD(mereToUSD(mereBalance))}
            </div>
          </Card>
        </div>

        {/* Referral Card */}
        {user?.referralCode && (
          <Card className="p-6 bg-gradient-to-br from-card to-primary/10 border-primary/30">
            <h3 className="font-display font-bold text-lg mb-3">Referral Program</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share your referral link and earn 10% of your friends' mining rewards!
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-accent rounded-md p-3 font-mono text-sm overflow-x-auto">
                mereminers.com/ref/{user.referralCode}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyReferral}
                data-testid="button-copy-referral"
              >
                {copiedReferral ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </Card>
        )}

        {/* Achievements Section */}
        <Card className="p-6 border-card-border">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Achievements
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">First Miner</div>
                <div className="text-xs text-muted-foreground">Purchase your first miner</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Getting Started</div>
                <div className="text-xs text-muted-foreground">Complete your first day of mining</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-50">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Trophy className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold text-sm">100 MERE Mined</div>
                <div className="text-xs text-muted-foreground">Mine 100 MERE tokens</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-50">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Trophy className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold text-sm">Top 10 Miner</div>
                <div className="text-xs text-muted-foreground">Reach top 10 on the leaderboard</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Actions */}
        <Card className="p-6 border-destructive/30">
          <h3 className="font-display font-bold text-lg mb-4">Account Actions</h3>
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-full"
            data-testid="button-logout-main"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
