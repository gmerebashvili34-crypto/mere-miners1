import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MiningSlot } from "@/components/MiningSlot";
import { BottomNav } from "@/components/BottomNav";
import { Wallet, Zap, TrendingUp, Clock, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE, formatUSD, mereToUSD, TH_DAILY_YIELD_MERE, DEFAULT_SLOTS, SLOT_EXPANSION_PRICE_MERE, MAX_SLOTS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserMiner, MinerType } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MinerCard } from "@/components/MinerCard";

export default function MiningRoom() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showMinerSelector, setShowMinerSelector] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const [showTrialBanner, setShowTrialBanner] = useState(false);

  // Fetch user's miners
  const { data: userMiners = [], isLoading: isLoadingMiners } = useQuery<(UserMiner & { minerType: MinerType })[]>({
    queryKey: ["/api/mining/room"],
  });

  // Fetch available slots info
  const { data: slotsInfo } = useQuery<{ totalSlots: number; unlockedSlots: number }>({
    queryKey: ["/api/mining/slots"],
  });
  // Number of currently usable slots (unlocked). The grid still renders up to MAX_SLOTS with locked tiles.
  const unlockedSlots = slotsInfo?.unlockedSlots ?? DEFAULT_SLOTS;

  // Get placed miners
  const placedMiners = userMiners.filter(m => m.slotPosition !== null);
  const unplacedMiners = userMiners.filter(m => m.slotPosition === null);
  const hasTrialMiner = userMiners.some(m => m.isTemporary);

  // Show one-time banner for trial miner; persist dismissal per user
  useEffect(() => {
    if (!user?.id) return;
    const key = `trialBannerDismissed:${user.id}`;
    const dismissed = localStorage.getItem(key) === '1';
    if (hasTrialMiner && !dismissed) {
      setShowTrialBanner(true);
    }
  }, [user?.id, hasTrialMiner]);

  // Calculate total stats (including upgrade multipliers)
  const totalHashrate = placedMiners.reduce((sum, m) => {
    const upgradeMultiplier = 1.0 + (m.upgradeLevel * 0.2);
    return sum + m.minerType.thRate * m.boostMultiplier * upgradeMultiplier;
  }, 0);
  const totalDailyEarnings = totalHashrate * TH_DAILY_YIELD_MERE;
  const canAffordUnlock = (() => {
    const bal = parseFloat(String(user?.mereBalance ?? '0'));
    return bal >= SLOT_EXPANSION_PRICE_MERE;
  })();

  // Place miner mutation
  const placeMinerMutation = useMutation({
    mutationFn: async ({ minerId, slotPosition }: { minerId: string; slotPosition: number }) => {
      await apiRequest("POST", "/api/mining/place", { minerId, slotPosition });
    },
    onMutate: async (vars: { minerId: string; slotPosition: number }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/mining/room"] });
      const previous = queryClient.getQueryData<(UserMiner & { minerType: MinerType })[]>(["/api/mining/room"]);
      if (previous) {
        const optimistic = previous.map((m) =>
          m.id === vars.minerId ? { ...m, slotPosition: vars.slotPosition } : m
        );
        queryClient.setQueryData(["/api/mining/room"], optimistic);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["/api/mining/room"], ctx.previous);
      toast({
        title: "Couldn’t place miner",
        description: "Please try again.",
      });
    },
    onSuccess: () => {
      setShowMinerSelector(false);
      setSelectedSlot(null);
      toast({
        title: "Miner placed",
        description: "Now mining MERE.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/room"] });
    },
  });

  // Remove miner mutation
  const removeMinerMutation = useMutation({
    mutationFn: async (minerId: string) => {
      await apiRequest("POST", "/api/mining/remove", { minerId });
    },
    onMutate: async (minerId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/mining/room"] });
      const previous = queryClient.getQueryData<(UserMiner & { minerType: MinerType })[]>(["/api/mining/room"]);
      if (previous) {
        const optimistic = previous.map((m) =>
          m.id === minerId ? { ...m, slotPosition: null } : m
        );
        queryClient.setQueryData(["/api/mining/room"], optimistic);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["/api/mining/room"], ctx.previous);
      toast({ title: "Couldn’t remove miner", description: "Please retry." });
    },
    // No success toast needed
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/room"] });
    },
  });

  // Upgrade miner mutation
  const upgradeMinerMutation = useMutation<{ newLevel: number; cost: number }, Error, string>({
    mutationFn: async (minerId: string) => {
      const response = await apiRequest("POST", "/api/mining/upgrade", { minerId });
      return response as unknown as { newLevel: number; cost: number };
    },
    onSuccess: (data: { newLevel: number; cost: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/room"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Miner Upgraded!",
        description: `Upgraded to level ${data.newLevel} for ${data.cost} MERE`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade failed",
        description: error.message,
      });
    },
  });

  // Unlock slot mutation
  const unlockSlotMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/mining/unlock-slot", {});
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/mining/slots"] });
      const previous = queryClient.getQueryData<{ totalSlots: number; unlockedSlots: number }>(["/api/mining/slots"]);
      if (previous) {
        queryClient.setQueryData(["/api/mining/slots"], {
          ...previous,
          unlockedSlots: Math.min(previous.unlockedSlots + 1, MAX_SLOTS),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["/api/mining/slots"], ctx.previous);
      toast({ title: "Couldn’t unlock slot", description: "Check balance and try again." });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Slot unlocked", description: "You can place another miner." });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/slots"] });
    },
  });

  const handleAddMinerToSlot = (slotNumber: number) => {
    if (unplacedMiners.length === 0) {
      toast({
        title: "No miners available",
        description: "Go to Shop to buy one first.",
      });
      return;
    }
    setSelectedSlot(slotNumber);
    setShowMinerSelector(true);
  };

  const handleSelectMiner = (miner: UserMiner & { minerType: MinerType }) => {
    if (selectedSlot !== null) {
      placeMinerMutation.mutate({
        minerId: miner.id,
        slotPosition: selectedSlot,
      });
    }
  };

  const getMinerInSlot = (slotNumber: number) => {
    return placedMiners.find(m => m.slotPosition === slotNumber);
  };

  if (isLoadingMiners) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading mining room...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 pb-20">
      {/* Header Stats */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display font-bold text-2xl bg-gold-gradient bg-clip-text text-transparent">
              Mining Room
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/wallet")}
              className="gap-2"
              data-testid="button-wallet"
            >
              <Wallet className="w-4 h-4" />
              <span className="font-bold text-primary">{formatMERE(user?.mereBalance || 0)}</span>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 border-card-border bg-card/50">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Hash</span>
              </div>
              <div className="font-display font-bold text-lg text-foreground" data-testid="text-total-hashrate">
                {totalHashrate.toFixed(2)} TH/s
              </div>
            </Card>

            <Card className="p-3 border-card-border bg-card/50">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Daily</span>
              </div>
              <div className="font-display font-bold text-lg text-primary" data-testid="text-daily-earnings">
                {formatMERE(totalDailyEarnings)}
              </div>
            </Card>

            <Card className="p-3 border-card-border bg-card/50">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <div className="font-display font-bold text-lg text-foreground" data-testid="text-active-miners">
                {placedMiners.length}/{unlockedSlots}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Mining Slots Grid */}
      <div className="container mx-auto px-4 py-6">
        {showTrialBanner && (
          <Card className="p-4 mb-4 border-primary/30 bg-gradient-to-br from-card to-accent/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-foreground">Your 1‑Week Starter Trial Miner is active</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  We auto-placed a 1 TH/s trial miner in your mining room for 7 days. Trial miners cannot be upgraded.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (user?.id) {
                    localStorage.setItem(`trialBannerDismissed:${user.id}`, '1');
                  }
                  setShowTrialBanner(false);
                }}
              >
                Got it
              </Button>
            </div>
          </Card>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          {Array.from({ length: unlockedSlots }).map((_, index) => {
            const slotNumber = index + 1;
            const miner = getMinerInSlot(slotNumber);
            return (
              <MiningSlot
                key={slotNumber}
                slotNumber={slotNumber}
                miner={miner}
                isEmpty={!miner}
                onAddMiner={() => handleAddMinerToSlot(slotNumber)}
                onRemoveMiner={(minerId) => removeMinerMutation.mutate(minerId)}
                onUpgradeMiner={(minerId) => upgradeMinerMutation.mutate(minerId)}
              />
            );
          })}
          
          {/* Locked slots: show remaining purchasable slots up to MAX_SLOTS */}
          {Array.from({ length: Math.max(0, MAX_SLOTS - unlockedSlots) }).map((_, index) => (
            <MiningSlot
              key={`locked-${index}`}
              slotNumber={unlockedSlots + index + 1}
              isLocked
              onUnlock={() => {
                if (!canAffordUnlock) {
                  toast({ title: `Need ${SLOT_EXPANSION_PRICE_MERE} MERE`, description: 'Deposit or earn more to unlock a slot.' });
                  return;
                }
                if (!unlockSlotMutation.isPending) {
                  unlockSlotMutation.mutate();
                }
              }}
              unlockDisabled={unlockSlotMutation.isPending || !canAffordUnlock}
            />
          ))}
        </div>

        {/* USDT Equivalent */}
        <div className="text-center text-sm text-muted-foreground mb-6">
          Daily earnings: <span className="text-foreground font-semibold">{mereToUSD(totalDailyEarnings).toFixed(2)} USDT</span>
        </div>

        {/* Quick Actions */}
        {userMiners.length === 0 && (
          <Card className="p-6 border-card-border bg-gradient-to-br from-card to-accent/10 text-center">
            <h3 className="font-display font-bold text-lg mb-2">No Miners Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Visit the shop to buy your first miner and start earning MERE!
            </p>
            <Button
              onClick={() => setLocation("/shop")}
              className="bg-gold-gradient text-black font-bold"
              data-testid="button-goto-shop"
            >
              <Plus className="w-4 h-4 mr-2" />
              Go to Shop
            </Button>
          </Card>
        )}
      </div>

      {/* Miner Selector Dialog */}
      <Dialog open={showMinerSelector} onOpenChange={setShowMinerSelector}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Miner to Place</DialogTitle>
            <DialogDescription>
              Choose from your available miners
            </DialogDescription>
          </DialogHeader>
          
          {unplacedMiners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No available miners. All your miners are already placed!
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              {unplacedMiners.map((miner) => (
                <div key={miner.id} className="cursor-pointer" onClick={() => handleSelectMiner(miner)}>
                  <MinerCard
                    miner={miner.minerType}
                    showPurchaseButton={false}
                  />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
