import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BottomNav } from "@/components/BottomNav";
import { Star, Lock, Check, Gift, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserSeasonPass, SeasonPassReward } from "@shared/schema";

export default function SeasonPass() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch season pass data
  const { data: userPass, isLoading: isLoadingPass } = useQuery<UserSeasonPass & { 
    rewards: SeasonPassReward[];
    seasonName: string;
  }>({
    queryKey: ["/api/season-pass"],
    // Keep current data visible during refetches so the grid doesn't disappear
    placeholderData: (prev) => prev as any,
  });

  // Upgrade to premium mutation
  const upgradeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/season-pass/upgrade", {});
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/season-pass"] });
      const prev = queryClient.getQueryData<UserSeasonPass & { rewards: SeasonPassReward[]; seasonName: string }>(["/api/season-pass"]);
      if (prev && !prev.hasPremium) {
        queryClient.setQueryData(["/api/season-pass"], { ...prev, hasPremium: true });
      }
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/season-pass"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Premium Unlocked!",
        description: "You now have access to premium rewards",
      });
    },
    onError: (error: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/season-pass"], ctx.prev);
      toast({
        title: "Upgrade Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Claim reward mutation
  const claimMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      await apiRequest("POST", "/api/season-pass/claim", { rewardId });
    },
    onMutate: async (rewardId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/season-pass"] });
      const prev = queryClient.getQueryData<UserSeasonPass & { rewards: SeasonPassReward[]; seasonName: string }>(["/api/season-pass"]);
      if (prev) {
        const claimed = Array.isArray(prev.claimedRewards) ? [...(prev.claimedRewards as any)] : [];
        if (!claimed.includes(rewardId)) claimed.push(rewardId);
        queryClient.setQueryData(["/api/season-pass"], { ...prev, claimedRewards: claimed });
      }
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/season-pass"] });
      toast({
        title: "Reward Claimed!",
        description: "The reward has been added to your account",
      });
    },
    onError: (error: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/season-pass"], ctx.prev);
      toast({
        title: "Claim Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentTier = userPass?.currentTier || 0;
  const hasPremium = userPass?.hasPremium || false;
  const claimedRewards = (userPass?.claimedRewards as string[]) || [];
  const maxTier = 20;
  const progressPercent = (currentTier / maxTier) * 100;

  const premiumRewards = userPass?.rewards.filter(r => r.isPremium) || [];

  const getRewardIcon = (type: string) => {
    switch (type) {
      case "mere":
        return <Star className="w-5 h-5 text-primary" />;
      case "miner":
        return <Gift className="w-5 h-5 text-primary" />;
      case "booster":
        return <Crown className="w-5 h-5 text-primary" />;
      default:
        return <Gift className="w-5 h-5 text-primary" />;
    }
  };

  const getRewardLabel = (reward: SeasonPassReward) => {
    switch (reward.rewardType) {
      case "mere":
        return `${formatMERE(reward.rewardValue || "0")} MERE`;
      case "miner":
        return `${(reward.rewardMetadata as any)?.name || "Miner"}`;
      case "booster":
        return `${(reward.rewardMetadata as any)?.name || "Booster"}`;
      default:
        return "Reward";
    }
  };

  const canClaim = (tier: number) => currentTier >= tier;
  const isClaimed = (rewardId: string) => claimedRewards.includes(rewardId);
  
  const upgradeCost = 999;
  const canAffordUpgrade = user && parseFloat(user.mereBalance) >= upgradeCost;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <h1 className="font-display font-bold text-2xl bg-gold-gradient bg-clip-text text-transparent flex items-center gap-2">
            <Star className="w-6 h-6 text-primary" />
            Season Pass
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {isLoadingPass && (
          <Card className="p-6 mb-4">
            <div className="animate-pulse space-y-3">
              <div className="h-6 w-44 bg-muted rounded" />
              <div className="h-3 w-full bg-muted rounded" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-28 bg-muted rounded" />
                ))}
              </div>
            </div>
          </Card>
        )}
        {/* Progress Overview */}
        <Card className="p-6 bg-gradient-to-br from-card to-primary/10 border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold text-xl">{userPass?.seasonName || "Current Season"}</h2>
              <p className="text-sm text-muted-foreground">
                {hasPremium ? "Premium Pass Active" : "Activate Premium to unlock all rewards"}
              </p>
            </div>
            {!hasPremium && (
              <Button
                onClick={() => upgradeMutation.mutate()}
                disabled={!canAffordUpgrade || upgradeMutation.isPending}
                className="bg-gold-gradient text-black font-bold"
                data-testid="button-upgrade-premium"
              >
                {canAffordUpgrade ? "Upgrade (999 MERE)" : "Insufficient Balance"}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">Tier {currentTier} / {maxTier}</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground">
              Mine MERE to progress through tiers and unlock exclusive rewards
            </p>
          </div>
        </Card>

        {/* Rewards Track - Premium Only */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Premium Rewards
            </h2>
            {!hasPremium && (
              <Button
                onClick={() => upgradeMutation.mutate()}
                disabled={!canAffordUpgrade || upgradeMutation.isPending}
                className="bg-gold-gradient text-black font-bold"
                size="sm"
              >
                Activate Premium
              </Button>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">
                {hasPremium ? "Claim your exclusive rewards" : "Unlock premium to access all rewards"}
              </span>
            </div>
            {premiumRewards.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No premium rewards available. Please refresh the page.</p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {premiumRewards.map((reward) => {
                const claimed = isClaimed(reward.id);
                const unlocked = hasPremium && canClaim(reward.tier);
                
                return (
                  <Card
                    key={reward.id}
                    className={`p-4 text-center border-2 ${
                      claimed
                        ? "border-status-online bg-status-online/10"
                        : unlocked
                        ? "border-primary bg-gold-gradient/10"
                        : "border-border opacity-50"
                    }`}
                    data-testid={`reward-tier-${reward.tier}`}
                  >
                    <div className="text-xs font-semibold text-muted-foreground mb-2" data-testid={`text-tier-${reward.tier}`}>
                      Tier {reward.tier}
                    </div>
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-accent flex items-center justify-center">
                      {claimed ? (
                        <Check className="w-6 h-6 text-status-online" />
                      ) : unlocked ? (
                        getRewardIcon(reward.rewardType)
                      ) : (
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-sm font-semibold mb-2" data-testid={`text-reward-${reward.tier}`}>
                      {getRewardLabel(reward)}
                    </div>
                    {unlocked && !claimed && (
                      <Button
                        size="sm"
                        onClick={() => claimMutation.mutate(reward.id)}
                        disabled={claimMutation.isPending}
                        className="w-full bg-gold-gradient text-black"
                        data-testid={`button-claim-premium-${reward.tier}`}
                      >
                        Claim
                      </Button>
                    )}
                    {claimed && (
                      <Badge className="bg-status-online text-white text-xs">Claimed</Badge>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Premium Benefits */}
        {!hasPremium && (
          <Card className="p-6 bg-gradient-to-br from-card to-primary/20 border-primary/50">
            <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Activate Premium Pass
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>20 tiers of exclusive premium rewards</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Earn up to 1,290 MERE in rewards (30% profit)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Unlock +10 TH/s total hashrate boosts</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Progress automatically as you mine MERE</span>
              </li>
            </ul>
            <Button
              onClick={() => upgradeMutation.mutate()}
              disabled={!canAffordUpgrade || upgradeMutation.isPending}
              className="w-full mt-4 bg-gold-gradient text-black font-bold"
              size="lg"
              data-testid="button-upgrade-premium-cta"
            >
              {canAffordUpgrade ? "Activate Premium (999 MERE)" : "Insufficient Balance (Need 999 MERE)"}
            </Button>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
