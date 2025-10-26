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
  const { data: userPass } = useQuery<UserSeasonPass & { 
    rewards: SeasonPassReward[];
    seasonName: string;
  }>({
    queryKey: ["/api/season-pass"],
  });

  // Upgrade to premium mutation
  const upgradeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/season-pass/upgrade", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/season-pass"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Premium Unlocked!",
        description: "You now have access to premium rewards",
      });
    },
    onError: (error: Error) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/season-pass"] });
      toast({
        title: "Reward Claimed!",
        description: "The reward has been added to your account",
      });
    },
    onError: (error: Error) => {
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

  const freeRewards = userPass?.rewards.filter(r => !r.isPremium) || [];
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
  
  const upgradeCost = 200;
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
        {/* Progress Overview */}
        <Card className="p-6 bg-gradient-to-br from-card to-primary/10 border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold text-xl">{userPass?.seasonName || "Current Season"}</h2>
              <p className="text-sm text-muted-foreground">
                {hasPremium ? "Premium Pass Active" : "Free Pass"}
              </p>
            </div>
            {!hasPremium && (
              <Button
                onClick={() => upgradeMutation.mutate()}
                disabled={!canAffordUpgrade || upgradeMutation.isPending}
                className="bg-gold-gradient text-black font-bold"
                data-testid="button-upgrade-premium"
              >
                {canAffordUpgrade ? "Upgrade (200 MERE)" : "Insufficient Balance"}
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

        {/* Rewards Track */}
        <div className="space-y-4">
          <h2 className="font-display font-bold text-lg">Rewards</h2>

          {/* Free Lane */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary">Free</Badge>
              <span className="text-sm text-muted-foreground">Available to all players</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {freeRewards.map((reward) => {
                const claimed = isClaimed(reward.id);
                const unlocked = canClaim(reward.tier);
                
                return (
                  <Card
                    key={reward.id}
                    className={`p-4 text-center border-2 ${
                      claimed
                        ? "border-status-online bg-status-online/10"
                        : unlocked
                        ? "border-primary bg-primary/5"
                        : "border-border opacity-50"
                    }`}
                  >
                    <div className="text-xs font-semibold text-muted-foreground mb-2">
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
                    <div className="text-sm font-semibold mb-2">
                      {getRewardLabel(reward)}
                    </div>
                    {unlocked && !claimed && (
                      <Button
                        size="sm"
                        onClick={() => claimMutation.mutate(reward.id)}
                        disabled={claimMutation.isPending}
                        className="w-full"
                        data-testid={`button-claim-free-${reward.tier}`}
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

          {/* Premium Lane */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-gold-gradient text-black font-bold">Premium</Badge>
              <span className="text-sm text-muted-foreground">
                {hasPremium ? "You have access" : "Upgrade to unlock"}
              </span>
            </div>
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
                  >
                    <div className="text-xs font-semibold text-muted-foreground mb-2">
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
                    <div className="text-sm font-semibold mb-2">
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
              Premium Pass Benefits
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Access to exclusive premium rewards</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>2x rewards at every tier</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Legendary miners and rare skins</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>Extra MERE bonus rewards</span>
              </li>
            </ul>
            <Button
              onClick={() => upgradeMutation.mutate()}
              disabled={!canAffordUpgrade || upgradeMutation.isPending}
              className="w-full mt-4 bg-gold-gradient text-black font-bold"
              size="lg"
              data-testid="button-upgrade-premium-cta"
            >
              {canAffordUpgrade ? "Upgrade Now (200 MERE)" : "Insufficient Balance (Need 200 MERE)"}
            </Button>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
