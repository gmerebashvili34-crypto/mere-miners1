import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp } from "lucide-react";
import type { MinerType } from "@shared/schema";
import { formatMERE } from "@/lib/constants";

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
    <Badge className={`${getRarityColor(miner.rarity)} uppercase text-[10px] font-bold`}>
      {miner.rarity}
    </Badge>
  );

  return (
    <Card className="overflow-hidden border-card-border bg-card hover-elevate transition-all duration-300 group h-full flex flex-col">
      <div className="relative aspect-square bg-gradient-to-br from-background to-accent/20 p-3">
        {rarityBadge && (
          <div className="absolute top-3 left-3 z-10">
            {rarityBadge}
          </div>
        )}
        <img
          src={miner.imageUrl}
          alt={miner.name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          data-testid={`img-miner-${miner.id}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <div className="p-3 space-y-2.5 flex-1 flex flex-col">
        <div className="min-h-[56px]">
          <h3 className="font-display font-bold text-base text-foreground" data-testid={`text-miner-name-${miner.id}`}>
            {miner.name}
          </h3>
          {miner.description && (
            <p className="text-xs text-muted-foreground mt-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {miner.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 min-h-[44px]">
          <div className="flex items-center gap-1.5 text-xs">
            <Zap className="w-3 h-3 text-primary" />
            <div>
              <div className="text-[10px] text-muted-foreground">Hash Rate</div>
              <div className="font-semibold text-foreground text-sm">{miner.thRate} TH/s</div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs">
            <TrendingUp className="w-3 h-3 text-primary" />
            <div>
              <div className="text-[10px] text-muted-foreground">Daily Yield</div>
              <div className="font-semibold text-primary text-sm">
                {formatMERE(miner.dailyYieldMere)}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border mt-auto">
          <div className="flex items-baseline justify-between mb-2.5 h-[76px]">
            <div className="flex-1 flex flex-col justify-end min-w-0">
              {discountPercent > 0 ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-base font-display font-bold text-muted-foreground line-through whitespace-nowrap">
                      {formatMERE(miner.basePriceMere)}
                    </div>
                    <Badge className="bg-primary text-primary-foreground text-[10px] shrink-0">
                      -{discountPercent}%
                    </Badge>
                  </div>
                  <div className="text-xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent whitespace-nowrap">
                    {formatMERE(finalPrice.toFixed(2))}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent whitespace-nowrap">
                    {formatMERE(miner.basePriceMere)}
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
              size="sm"
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
