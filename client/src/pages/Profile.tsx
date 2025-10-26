import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BottomNav } from "@/components/BottomNav";
import { User as UserIcon, Trophy, Zap, TrendingUp, LogOut, Copy, Check, Lock, ShoppingCart, Package, Grid3x3, Crown, Coins, BadgeDollarSign, Star, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE, formatUSD, mereToUSD } from "@/lib/constants";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface AchievementWithProgress {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  rewardMere: string;
  progress: number;
  isUnlocked: boolean;
  unlockedAt: Date | null;
  criteria: {
    type: string;
    value: number;
  };
}

const iconMap: Record<string, any> = {
  ShoppingCart,
  Package,
  Zap,
  Grid3x3,
  TrendingUp,
  Crown,
  Coins,
  BadgeDollarSign,
  Star,
  Users,
  Trophy,
};

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copiedReferral, setCopiedReferral] = useState(false);

  const { data: achievements } = useQuery<AchievementWithProgress[]>({
    queryKey: ["/api/achievements"],
  });

  const { data: referralStats } = useQuery<{
    totalReferrals: number;
    totalReferralEarnings: number;
    referrals: Array<{
      id: string;
      name: string;
      totalMined: number;
      joinedAt: Date | null;
    }>;
    recentBonuses: Array<{
      id: string;
      amount: number;
      description: string | null;
      createdAt: Date | null;
    }>;
  }>({
    queryKey: ["/api/referrals"],
  });

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
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-display font-bold text-xl" data-testid="text-user-name">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.firstName || user?.email?.split("@")[0] || "Miner"}
                </h2>
                <span className="text-xs text-muted-foreground">(Name from Replit)</span>
              </div>
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
              ≈ {mereToUSD(totalMined).toFixed(2)} USDT
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
              ≈ {mereToUSD(mereBalance).toFixed(2)} USDT
            </div>
          </Card>
        </div>

        {/* Referral Card */}
        {user?.referralCode && (
          <Card className="p-6 bg-gradient-to-br from-card to-primary/10 border-primary/30">
            <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Referral Program
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share your referral link and earn 10% of your friends' mining rewards!
            </p>
            <div className="flex gap-2 mb-4">
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

            {referralStats && (
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-primary/20">
                <div className="text-center">
                  <div className="text-2xl font-display font-bold text-primary" data-testid="text-total-referrals">
                    {referralStats.totalReferrals}
                  </div>
                  <div className="text-xs text-muted-foreground">Friends Referred</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-display font-bold text-primary" data-testid="text-referral-earnings">
                    {formatMERE(referralStats.totalReferralEarnings)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Earned</div>
                </div>
              </div>
            )}

            {referralStats && referralStats.referrals && referralStats.referrals.length > 0 && (
              <div className="mt-4 pt-4 border-t border-primary/20">
                <h4 className="font-semibold text-sm mb-2">Your Referrals</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {referralStats.referrals.map((referral) => (
                    <div
                      key={referral.id}
                      className="flex items-center justify-between p-2 rounded-md bg-accent/50"
                      data-testid={`referral-${referral.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{referral.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Mined: {formatMERE(referral.totalMined)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Achievements Section */}
        <Card className="p-6 border-card-border">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Achievements
          </h3>
          {achievements && achievements.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {achievements.map((achievement) => {
                const Icon = iconMap[achievement.icon] || Trophy;
                const progressPercent = achievement.criteria 
                  ? Math.min(100, (achievement.progress / achievement.criteria.value) * 100)
                  : 0;

                return (
                  <div
                    key={achievement.id}
                    className={`p-3 rounded-lg border ${
                      achievement.isUnlocked
                        ? "bg-primary/5 border-primary/30"
                        : "bg-muted/30 border-border opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        achievement.isUnlocked
                          ? "bg-primary/20"
                          : "bg-muted"
                      }`}>
                        {achievement.isUnlocked ? (
                          <Icon className="w-5 h-5 text-primary" />
                        ) : (
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-sm truncate">{achievement.name}</div>
                          {achievement.isUnlocked && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {achievement.tier}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {achievement.description}
                        </div>
                        {!achievement.isUnlocked && achievement.criteria && (
                          <div className="space-y-1">
                            <Progress value={progressPercent} className="h-1.5" />
                            <div className="text-xs text-muted-foreground">
                              {achievement.progress} / {achievement.criteria.value}
                            </div>
                          </div>
                        )}
                        {achievement.isUnlocked && achievement.rewardMere && parseFloat(achievement.rewardMere) > 0 && (
                          <div className="text-xs text-primary font-semibold">
                            +{formatMERE(parseFloat(achievement.rewardMere))} reward claimed
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No achievements available yet</p>
            </div>
          )}
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
