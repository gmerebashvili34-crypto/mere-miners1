import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MinerCard } from "@/components/MinerCard";
import { BottomNav } from "@/components/BottomNav";
import { ShoppingBag, Wallet, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE, formatUSD, mereToUSD, TH_BASE_PRICE_MERE } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MinerType, UserMiner } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Shop() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedMiner, setSelectedMiner] = useState<MinerType | null>(null);
  
  // Fetch user's owned miners to check what they already have
  const { data: ownedMiners = [] } = useQuery<(UserMiner & { minerType: MinerType })[]>({
    queryKey: ["/api/mining/room"],
  });

  // Fetch available miners
  const { data: miners = [], isLoading } = useQuery<MinerType[]>({
    queryKey: ["/api/shop/miners"],
  });

  // Purchase miner mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ minerTypeId }: { minerTypeId: string }) => {
      await apiRequest("POST", "/api/shop/buy", { minerTypeId, quantity: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/room"] });
      setSelectedMiner(null);
      toast({
        title: "Purchase Successful!",
        description: "Miner added to your inventory",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePurchase = (miner: MinerType) => {
    setSelectedMiner(miner);
  };

  const confirmPurchase = () => {
    if (!selectedMiner) return;
    
    purchaseMutation.mutate({
      minerTypeId: selectedMiner.id,
    });
  };
  
  // Check if user already owns this miner type
  const ownsSelectedMiner = selectedMiner ? ownedMiners.some(m => m.minerType.id === selectedMiner.id) : false;

  const getTotalCost = () => {
    if (!selectedMiner) return { originalPrice: 0, finalPrice: 0, discountPercent: 0 };
    
    // Calculate rarity-based discount
    let discountPercent = 0;
    if (selectedMiner.rarity === "rare") discountPercent = 4;
    else if (selectedMiner.rarity === "epic") discountPercent = 5;
    else if (selectedMiner.rarity === "legendary") discountPercent = 7;
    
    const originalPrice = parseFloat(selectedMiner.basePriceMere);
    const finalPrice = originalPrice * (1 - discountPercent / 100);
    
    return {
      originalPrice,
      finalPrice,
      discountPercent,
    };
  };

  const cost = getTotalCost();
  const canAfford = user && parseFloat(user.mereBalance) >= cost.finalPrice;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="animate-pulse text-primary">Loading shop...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display font-bold text-2xl bg-gold-gradient bg-clip-text text-transparent flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" />
              Miner Shop
            </h1>
            <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>

      {/* Shop Grid */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {miners.map((miner) => (
            <MinerCard
              key={miner.id}
              miner={miner}
              onPurchase={handlePurchase}
              isPurchasing={purchaseMutation.isPending && selectedMiner?.id === miner.id}
            />
          ))}
        </div>

        {miners.length === 0 && (
          <Card className="p-12 text-center border-card-border">
            <p className="text-muted-foreground">No miners available at the moment</p>
          </Card>
        )}
      </div>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={!!selectedMiner} onOpenChange={() => setSelectedMiner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase {selectedMiner?.name}</DialogTitle>
            <DialogDescription>
              Configure your purchase
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {ownsSelectedMiner && (
              <Card className="p-4 bg-destructive/10 border-destructive/30">
                <div className="text-sm text-destructive text-center font-semibold">
                  You already own this miner type. Each miner can only be purchased once.
                </div>
              </Card>
            )}

            {selectedMiner && (
              <div className="space-y-3">
                <Card className="p-4 bg-accent/20">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Hash Rate:</div>
                    <div className="font-semibold text-right">{selectedMiner.thRate.toFixed(2)} TH/s</div>
                    
                    <div className="text-muted-foreground">Daily Yield:</div>
                    <div className="font-semibold text-right text-primary">
                      {formatMERE(parseFloat(selectedMiner.dailyYieldMere))}
                    </div>
                    
                    <div className="text-muted-foreground">Rarity:</div>
                    <div className="font-semibold text-right capitalize">{selectedMiner.rarity}</div>
                  </div>
                </Card>

                <Card className="p-4 bg-card border-primary/50">
                  <div className="space-y-2">
                    {cost.discountPercent > 0 && (
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Original Price:</span>
                        <span className="text-sm line-through text-muted-foreground">{formatMERE(cost.originalPrice)}</span>
                      </div>
                    )}
                    {cost.discountPercent > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Discount:</span>
                        <span className="text-sm font-semibold text-primary">-{cost.discountPercent}%</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="font-semibold">Final Price:</span>
                      <div className="text-right">
                        <div className="text-2xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent">
                          {formatMERE(cost.finalPrice.toFixed(2))}
                        </div>
                        <div className="text-xs text-muted-foreground font-semibold">
                          MERE
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {!canAfford && (
                  <div className="text-sm text-destructive text-center">
                    Insufficient MERE balance. Deposit more to continue.
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMiner(null)} data-testid="button-cancel-purchase">
              Cancel
            </Button>
            <Button
              onClick={confirmPurchase}
              disabled={!canAfford || purchaseMutation.isPending || ownsSelectedMiner}
              className="bg-gold-gradient text-black font-bold"
              data-testid="button-confirm-purchase"
            >
              {purchaseMutation.isPending ? "Processing..." : ownsSelectedMiner ? "Already Owned" : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <BottomNav />
    </div>
  );
}
