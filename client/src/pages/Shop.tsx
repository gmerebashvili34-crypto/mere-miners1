import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { MinerCard } from "@/components/MinerCard";
import { BottomNav } from "@/components/BottomNav";
import { ShoppingBag, Wallet, Calculator, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE, formatUSD, mereToUSD, calculateDiscountedPrice, TH_BASE_PRICE_MERE } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MinerType } from "@shared/schema";
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
  const [purchaseAmount, setPurchaseAmount] = useState(1);
  const [showBulkCalculator, setShowBulkCalculator] = useState(false);
  const [bulkTH, setBulkTH] = useState(10);

  // Fetch available miners
  const { data: miners = [], isLoading } = useQuery<MinerType[]>({
    queryKey: ["/api/shop/miners"],
  });

  // Purchase miner mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ minerTypeId, quantity }: { minerTypeId: string; quantity: number }) => {
      await apiRequest("POST", "/api/shop/buy", { minerTypeId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/room"] });
      setSelectedMiner(null);
      setPurchaseAmount(1);
      toast({
        title: "Purchase Successful!",
        description: "Your miners have been added to your inventory",
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
      quantity: purchaseAmount,
    });
  };

  const getTotalCost = () => {
    if (!selectedMiner) return { originalPrice: 0, finalPrice: 0, discountPercent: 0 };
    const totalTH = selectedMiner.thRate * purchaseAmount;
    const pricePerTH = parseFloat(selectedMiner.basePriceMere) / selectedMiner.thRate;
    const calculatedPrice = calculateDiscountedPrice(totalTH);
    
    return {
      originalPrice: totalTH * pricePerTH,
      finalPrice: calculatedPrice.finalPrice,
      discountPercent: calculatedPrice.discountPercent,
    };
  };

  const cost = getTotalCost();
  const canAfford = user && parseFloat(user.mereBalance) >= cost.finalPrice;

  const bulkCalculation = calculateDiscountedPrice(bulkTH);

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
                variant="outline"
                size="sm"
                onClick={() => setShowBulkCalculator(true)}
                className="gap-2"
                data-testid="button-bulk-calculator"
              >
                <Calculator className="w-4 h-4" />
                Bulk
              </Button>
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
            <div>
              <label className="text-sm font-medium mb-2 block">Quantity</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(Math.max(1, parseInt(e.target.value) || 1))}
                data-testid="input-purchase-quantity"
              />
            </div>

            {selectedMiner && (
              <div className="space-y-3">
                <Card className="p-4 bg-accent/20">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Total Hash Rate:</div>
                    <div className="font-semibold text-right">{(selectedMiner.thRate * purchaseAmount).toFixed(2)} TH/s</div>
                    
                    <div className="text-muted-foreground">Daily Yield:</div>
                    <div className="font-semibold text-right text-primary">
                      {formatMERE(parseFloat(selectedMiner.dailyYieldMere) * purchaseAmount)} MERE
                    </div>
                  </div>
                </Card>

                {cost.discountPercent > 0 && (
                  <Card className="p-4 bg-primary/10 border-primary/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-primary">Bulk Discount Applied!</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Original Price:</div>
                      <div className="text-right line-through">{formatMERE(cost.originalPrice)} MERE</div>
                      
                      <div className="text-muted-foreground">Discount ({cost.discountPercent.toFixed(1)}%):</div>
                      <div className="text-right text-primary">-{formatMERE(cost.originalPrice - cost.finalPrice)} MERE</div>
                    </div>
                  </Card>
                )}

                <Card className="p-4 bg-card border-primary/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Final Price:</span>
                    <div className="text-right">
                      <div className="text-2xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent">
                        {formatMERE(cost.finalPrice)} MERE
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ≈ {formatUSD(mereToUSD(cost.finalPrice))}
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
              disabled={!canAfford || purchaseMutation.isPending}
              className="bg-gold-gradient text-black font-bold"
              data-testid="button-confirm-purchase"
            >
              {purchaseMutation.isPending ? "Processing..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Calculator Dialog */}
      <Dialog open={showBulkCalculator} onOpenChange={setShowBulkCalculator}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Purchase Calculator</DialogTitle>
            <DialogDescription>
              See how much you save with bulk orders
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">Total Hash Rate (TH/s)</label>
                <span className="font-bold text-primary">{bulkTH} TH/s</span>
              </div>
              <Slider
                value={[bulkTH]}
                onValueChange={([value]) => setBulkTH(value)}
                min={1}
                max={100}
                step={1}
                className="mb-4"
              />
            </div>

            <Card className="p-4 space-y-3 bg-accent/20">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Base Price:</div>
                <div className="text-right">{formatMERE(bulkCalculation.originalPrice)} MERE</div>
                
                <div className="text-muted-foreground">Discount:</div>
                <div className="text-right text-primary font-semibold">
                  {bulkCalculation.discountPercent.toFixed(2)}% (-{formatMERE(bulkCalculation.discount)} MERE)
                </div>
                
                <div className="text-muted-foreground font-semibold pt-2 border-t border-border">Final Price:</div>
                <div className="text-right font-bold text-lg bg-gold-gradient bg-clip-text text-transparent pt-2 border-t border-border">
                  {formatMERE(bulkCalculation.finalPrice)} MERE
                </div>
              </div>
            </Card>

            <div className="text-xs text-muted-foreground text-center">
              Formula: Discount = min(20%, 5% × log₁₀(TH + 1))
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
