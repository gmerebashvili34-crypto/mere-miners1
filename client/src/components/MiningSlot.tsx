import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Zap, TrendingUp, X, ArrowUp } from "lucide-react";
import type { UserMiner, MinerType } from "@shared/schema";
import { formatMERE, mereToUSD, TH_DAILY_YIELD_MERE } from "@/lib/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MiningSlotProps {
  slotNumber: number;
  miner?: UserMiner & { minerType: MinerType };
  onAddMiner?: () => void;
  onRemoveMiner?: (minerId: string) => void;
  onUpgradeMiner?: (minerId: string) => void;
  isEmpty?: boolean;
  isLocked?: boolean;
  onUnlock?: () => void;
}

export function MiningSlot({ 
  slotNumber, 
  miner, 
  onAddMiner, 
  onRemoveMiner,
  onUpgradeMiner,
  isEmpty = true,
  isLocked = false,
  onUnlock 
}: MiningSlotProps) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  if (isLocked) {
    return (
      <Card className="relative aspect-square border-2 border-dashed border-border bg-accent/20 hover-elevate">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <Plus className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-foreground mb-1">Slot Locked</p>
          <p className="text-[10px] text-muted-foreground mb-3">Unlock to place more miners</p>
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
      <Card className="relative aspect-square border-2 border-dashed border-primary/30 bg-accent/10 hover-elevate cursor-pointer group">
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center p-3"
          onClick={onAddMiner}
          data-testid={`slot-empty-${slotNumber}`}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
            <Plus className="w-6 h-6 text-primary animate-pulse-glow" />
          </div>
          <p className="text-xs font-medium text-primary">Add Miner</p>
          <p className="text-[10px] text-muted-foreground mt-1">Slot {slotNumber}</p>
        </div>
      </Card>
    );
  }

  // No upgrade multiplier - upgrades don't affect hashrate
  const dailyYield = miner.minerType.thRate * TH_DAILY_YIELD_MERE * miner.boostMultiplier;
  const isActive = miner.isActive;
  const upgradeLevel = miner.upgradeLevel || 0;
  // Flat upgrade cost: $12.99 USD = 25.98 MERE for all miners (unlimited upgrades)
  const upgradeCost = 25.98;

  return (
    <>
      <Card className="relative aspect-square overflow-hidden border-card-border bg-gradient-to-br from-card to-accent/10 hover-elevate group flex flex-col">
        {upgradeLevel > 0 && (
          <div className="absolute top-1 left-1 z-10">
            <Badge className="bg-gold-gradient text-black text-[10px] font-bold">
              Lv {upgradeLevel}
            </Badge>
          </div>
        )}

        {miner.boostMultiplier > 1 && (
          <div className="absolute top-1 left-1 z-10" style={{ marginTop: upgradeLevel > 0 ? '1.25rem' : '0.25rem' }}>
            <Badge className="bg-primary text-primary-foreground text-[10px]">
              {miner.boostMultiplier}x
            </Badge>
          </div>
        )}

        {onRemoveMiner && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowRemoveConfirm(true)}
            className="absolute top-1 right-1 z-20 h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
            data-testid={`button-remove-miner-${miner.id}`}
          >
            <X className="w-4 h-4" />
          </Button>
        )}

        <div className="relative h-[60%] bg-gradient-to-br from-background/50 to-accent/30 p-2 flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={miner.minerType.imageUrl}
              alt={miner.minerType.name}
              className="max-w-[85%] max-h-[85%] object-contain animate-float"
              data-testid={`img-placed-miner-${miner.id}`}
            />
          </div>
          
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

        <div className="flex-1 p-2 space-y-1">
          <h4 className="font-semibold text-xs text-foreground truncate" data-testid={`text-placed-miner-name-${miner.id}`}>
            {miner.minerType.name}
          </h4>
          
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div className="flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5 text-primary" />
              <span className="text-muted-foreground">
                {miner.minerType.thRate.toFixed(1)} TH/s
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5 text-primary" />
              <span className="font-semibold text-primary text-[9px]">{formatMERE(dailyYield)}/d</span>
            </div>
          </div>
        </div>

        <div className="p-2 pt-0 mt-auto">
          {onUpgradeMiner && (
            <Button
              onClick={() => onUpgradeMiner(miner.id)}
              className="w-full bg-gold-gradient text-black font-bold text-xs flex items-center justify-center gap-1.5"
              data-testid={`button-upgrade-miner-${miner.id}`}
            >
              <ArrowUp className="w-4 h-4" />
              <span>Upgrade ({upgradeCost} MERE)</span>
            </Button>
          )}
        </div>
      </Card>

    {/* Remove Confirmation Dialog */}
    {onRemoveMiner && (
      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Miner?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{miner?.minerType.name}</strong> from this slot? The miner will be moved to your inventory and stop earning MERE.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemoveMiner(miner.id);
                setShowRemoveConfirm(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-remove"
            >
              Remove Miner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )}
  </>
  );
}
