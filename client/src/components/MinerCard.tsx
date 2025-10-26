import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Clock } from "lucide-react";
import type { MinerType } from "@shared/schema";
import { formatMERE, formatUSD, mereToUSD } from "@/lib/constants";

interface MinerCardProps {
  miner: MinerType;
  onPurchase?: (miner: MinerType) => void;
  isPurchasing?: boolean;
  showPurchaseButton?: boolean;
}

export function MinerCard({ miner, onPurchase, isPurchasing, showPurchaseButton = true }: MinerCardProps) {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "bg-gold-gradient text-black";
      case "epic": return "bg-purple-600 text-white";
      case "rare": return "bg-blue-500 text-white";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  // Calculate rarity-based discount
  const getDiscountPercent = (rarity: string) => {
    if (rarity === "rare") return 4;
    if (rarity === "epic") return 5;
    if (rarity === "legendary") return 7;
    return 0;
  };

  const discountPercent = getDiscountPercent(miner.rarity);
  const basePrice = parseFloat(miner.basePriceMere);
  const finalPrice = discountPercent > 0 ? basePrice * (1 - discountPercent / 100) : basePrice;

  const rarityBadge = (
    <Badge className={`${getRarityColor(miner.rarity)} uppercase text-xs font-bold`}>
      {miner.rarity}
    </Badge>
  );

  return (
    <Card className="overflow-hidden border-card-border bg-card hover-elevate transition-all duration-300 group">
      <div className="relative aspect-square bg-gradient-to-br from-background to-accent/20 p-6">
        {rarityBadge && (
          <div className="absolute top-3 left-3 z-10">
            {rarityBadge}
          </div>
        )}
        <img
          src={miner.imageUrl}
          alt={miner.name}
          className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
          data-testid={`img-miner-${miner.id}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-display font-bold text-lg text-foreground" data-testid={`text-miner-name-${miner.id}`}>
            {miner.name}
          </h3>
          {miner.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {miner.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Hash Rate</div>
              <div className="font-semibold text-foreground">{miner.thRate} TH/s</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Daily Yield</div>
              <div className="font-semibold text-primary">
                {formatMERE(miner.dailyYieldMere)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-accent/50">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <span className="text-xs text-muted-foreground">ROI: </span>
            <span className="font-semibold text-foreground">{miner.roiDays} days</span>
            <span className="text-xs text-muted-foreground ml-2">
              (~{((365 / miner.roiDays) * 100).toFixed(0)}% APR)
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="flex items-baseline justify-between mb-3">
            <div className="flex-1">
              {discountPercent > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-display font-bold text-muted-foreground line-through">
                      {formatMERE(miner.basePriceMere)}
                    </div>
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      -{discountPercent}%
                    </Badge>
                  </div>
                  <div className="text-2xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent">
                    {formatMERE(finalPrice.toFixed(2))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ≈ {formatUSD(mereToUSD(finalPrice))}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent">
                    {formatMERE(miner.basePriceMere)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ≈ {formatUSD(mereToUSD(basePrice))}
                  </div>
                </>
              )}
            </div>
          </div>

          {showPurchaseButton && onPurchase && (
            <Button
              onClick={() => onPurchase(miner)}
              disabled={isPurchasing || !miner.isAvailable}
              className="w-full"
              size="lg"
              data-testid={`button-buy-miner-${miner.id}`}
            >
              {isPurchasing ? "Processing..." : miner.isAvailable ? "Buy Now" : "Sold Out"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
