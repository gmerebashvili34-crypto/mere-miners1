import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Zap, TrendingUp, X } from "lucide-react";
import type { UserMiner, MinerType } from "@shared/schema";
import { formatMERE, formatUSD, mereToUSD, TH_DAILY_YIELD_MERE } from "@/lib/constants";

interface MiningSlotProps {
  slotNumber: number;
  miner?: UserMiner & { minerType: MinerType };
  onAddMiner?: () => void;
  onRemoveMiner?: (minerId: string) => void;
  isEmpty?: boolean;
  isLocked?: boolean;
  onUnlock?: () => void;
}

export function MiningSlot({ 
  slotNumber, 
  miner, 
  onAddMiner, 
  onRemoveMiner, 
  isEmpty = true,
  isLocked = false,
  onUnlock 
}: MiningSlotProps) {
  if (isLocked) {
    return (
      <Card className="relative aspect-[4/5] border-2 border-dashed border-border bg-accent/20 hover-elevate">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Plus className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-2">Slot Locked</p>
          <p className="text-xs text-muted-foreground mb-4">Unlock to place more miners</p>
          {onUnlock && (
            <Button 
              size="sm" 
              onClick={onUnlock}
              data-testid={`button-unlock-slot-${slotNumber}`}
            >
              Unlock (50 MERE)
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (isEmpty || !miner) {
    return (
      <Card className="relative aspect-[4/5] border-2 border-dashed border-primary/30 bg-accent/10 hover-elevate cursor-pointer group">
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center p-4"
          onClick={onAddMiner}
          data-testid={`slot-empty-${slotNumber}`}
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
            <Plus className="w-8 h-8 text-primary animate-pulse-glow" />
          </div>
          <p className="text-sm font-medium text-primary">Add Miner</p>
          <p className="text-xs text-muted-foreground mt-1">Slot {slotNumber}</p>
        </div>
      </Card>
    );
  }

  const dailyYield = miner.minerType.thRate * TH_DAILY_YIELD_MERE * miner.boostMultiplier;
  const isActive = miner.isActive;

  return (
    <Card className="relative aspect-[4/5] overflow-hidden border-card-border bg-gradient-to-br from-card to-accent/10 hover-elevate group">
      {onRemoveMiner && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/50 hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onRemoveMiner(miner.id)}
          data-testid={`button-remove-miner-${miner.id}`}
        >
          <X className="w-3 h-3 text-white" />
        </Button>
      )}

      {isActive && (
        <div className="absolute top-2 left-2 z-10">
          <Badge className="bg-status-online text-white text-xs animate-pulse-glow">
            Active
          </Badge>
        </div>
      )}

      {miner.boostMultiplier > 1 && (
        <div className="absolute top-2 left-2 z-10 mt-7">
          <Badge className="bg-primary text-primary-foreground text-xs">
            {miner.boostMultiplier}x Boost
          </Badge>
        </div>
      )}

      <div className="relative h-2/3 bg-gradient-to-br from-background/50 to-accent/30 p-4 flex items-center justify-center">
        <img
          src={miner.minerType.imageUrl}
          alt={miner.minerType.name}
          className="w-full h-full object-contain animate-float"
          data-testid={`img-placed-miner-${miner.id}`}
        />
        
        {isActive && (
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/10 rounded-full blur-2xl animate-pulse-glow" />
            </div>
            {/* Particle effects */}
            <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-primary rounded-full animate-sparkle" style={{ animationDelay: '0ms' }} />
            <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-primary rounded-full animate-sparkle" style={{ animationDelay: '500ms' }} />
            <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-primary rounded-full animate-sparkle" style={{ animationDelay: '1000ms' }} />
          </>
        )}
      </div>

      <div className="p-3 space-y-2">
        <h4 className="font-semibold text-sm text-foreground truncate" data-testid={`text-placed-miner-name-${miner.id}`}>
          {miner.minerType.name}
        </h4>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-muted-foreground">{miner.minerType.thRate} TH/s</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="font-semibold text-primary">{formatMERE(dailyYield)}/day</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          ≈ {formatUSD(mereToUSD(dailyYield))}/day
        </div>
      </div>
    </Card>
  );
}
