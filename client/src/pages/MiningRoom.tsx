import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MiningSlot } from "@/components/MiningSlot";
import { BottomNav } from "@/components/BottomNav";
import { Wallet, Zap, TrendingUp, Clock, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE, formatUSD, mereToUSD, TH_DAILY_YIELD_MERE, DEFAULT_SLOTS, SLOT_EXPANSION_PRICE_MERE } from "@/lib/constants";
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

  // Fetch user's miners
  const { data: userMiners = [], isLoading: isLoadingMiners } = useQuery<(UserMiner & { minerType: MinerType })[]>({
    queryKey: ["/api/mining/room"],
  });

  // Fetch available slots info
  const { data: slotsInfo } = useQuery<{ totalSlots: number; unlockedSlots: number }>({
    queryKey: ["/api/mining/slots"],
  });

  const totalSlots = slotsInfo?.unlockedSlots || DEFAULT_SLOTS;

  // Get placed miners
  const placedMiners = userMiners.filter(m => m.slotPosition !== null);
  const unplacedMiners = userMiners.filter(m => m.slotPosition === null);

  // Calculate total stats
  const totalHashrate = placedMiners.reduce((sum, m) => sum + m.minerType.thRate * m.boostMultiplier, 0);
  const totalDailyEarnings = totalHashrate * TH_DAILY_YIELD_MERE;

  // Place miner mutation
  const placeMinerMutation = useMutation({
    mutationFn: async ({ minerId, slotPosition }: { minerId: string; slotPosition: number }) => {
      await apiRequest("POST", "/api/mining/place", { minerId, slotPosition });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/room"] });
      setShowMinerSelector(false);
      setSelectedSlot(null);
      toast({
        title: "Miner Placed",
        description: "Your miner is now actively mining MERE!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove miner mutation
  const removeMinerMutation = useMutation({
    mutationFn: async (minerId: string) => {
      await apiRequest("POST", "/api/mining/remove", { minerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/room"] });
      toast({
        title: "Miner Removed",
        description: "Miner removed from mining room",
      });
    },
  });

  // Unlock slot mutation
  const unlockSlotMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/mining/unlock-slot", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mining/slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Slot Unlocked",
        description: "New mining slot is now available!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddMinerToSlot = (slotNumber: number) => {
    if (unplacedMiners.length === 0) {
      toast({
        title: "No Miners Available",
        description: "Buy miners from the shop first!",
        variant: "destructive",
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
              onClick={() => window.location.href = "/wallet"}
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
                {placedMiners.length}/{totalSlots}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Mining Slots Grid */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: totalSlots }).map((_, index) => {
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
              />
            );
          })}
          
          {/* Locked slots */}
          {Array.from({ length: Math.max(0, 3 - (totalSlots - DEFAULT_SLOTS)) }).map((_, index) => (
            <MiningSlot
              key={`locked-${index}`}
              slotNumber={totalSlots + index + 1}
              isLocked
              onUnlock={() => unlockSlotMutation.mutate()}
            />
          ))}
        </div>

        {/* USD Equivalent */}
        <div className="text-center text-sm text-muted-foreground mb-6">
          Daily earnings: <span className="text-foreground font-semibold">{formatUSD(mereToUSD(totalDailyEarnings))}</span>
        </div>

        {/* Quick Actions */}
        {userMiners.length === 0 && (
          <Card className="p-6 border-card-border bg-gradient-to-br from-card to-accent/10 text-center">
            <h3 className="font-display font-bold text-lg mb-2">No Miners Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Visit the shop to buy your first miner and start earning MERE!
            </p>
            <Button
              onClick={() => window.location.href = "/shop"}
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
