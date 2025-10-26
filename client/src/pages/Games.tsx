import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Trophy, Sparkles, Gift } from "lucide-react";
import { useState, useEffect } from "react";

interface SpinStatus {
  canPlay: boolean;
  lastPlayedAt: string | null;
  nextPlayAt: string | null;
  lastReward?: string;
}

export default function Games() {
  const { toast } = useToast();
  const [spinning, setSpinning] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [rewardAmount, setRewardAmount] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  const { data: status, isLoading } = useQuery<SpinStatus>({
    queryKey: ["/api/games/daily-spin/status"],
  });

  const playMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/games/daily-spin/play", {});
    },
    onSuccess: (data: any) => {
      setRewardAmount(data.reward);
      setShowReward(true);
      
      toast({
        title: "🎉 Congratulations!",
        description: `You won ${data.reward} MERE!`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/games/daily-spin/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to play game",
      });
    },
  });

  const handleSpin = async () => {
    setSpinning(true);
    setShowReward(false);
    
    // Simulate spinning animation for 2 seconds
    setTimeout(async () => {
      await playMutation.mutateAsync();
      setSpinning(false);
    }, 2000);
  };

  // Update countdown timer
  useEffect(() => {
    if (!status?.nextPlayAt) return;
    
    const updateTimer = () => {
      const now = new Date();
      const next = new Date(status.nextPlayAt!);
      const diff = next.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft("Ready to play!");
        queryClient.invalidateQueries({ queryKey: ["/api/games/daily-spin/status"] });
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [status]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-games" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-primary flex items-center justify-center gap-2" data-testid="text-games-title">
          <Trophy className="w-10 h-10" />
          Mini Games
        </h1>
        <p className="text-muted-foreground" data-testid="text-games-description">
          Play daily mini-games to earn bonus MERE tokens
        </p>
      </div>

      {/* Daily Spin Game */}
      <Card className="border-primary/20" data-testid="card-daily-spin">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-primary" />
            Daily Spin
          </CardTitle>
          <CardDescription>
            Spin once per day for a chance to win 5-50 MERE tokens!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Spinning Wheel Visual */}
          <div className="flex justify-center">
            <div 
              className={`relative w-48 h-48 rounded-full border-8 border-primary/30 bg-gradient-to-br from-primary/10 to-background flex items-center justify-center ${
                spinning ? 'animate-spin' : ''
              }`}
              data-testid="spinner-wheel"
            >
              <div className="absolute inset-0 rounded-full border-8 border-transparent border-t-primary"></div>
              <div className="relative z-10">
                {showReward && rewardAmount ? (
                  <div className="text-center animate-bounce" data-testid="text-reward-display">
                    <Gift className="w-16 h-16 mx-auto text-primary mb-2" />
                    <p className="text-3xl font-bold text-primary">{rewardAmount}</p>
                    <p className="text-sm text-muted-foreground">MERE</p>
                  </div>
                ) : (
                  <Sparkles className="w-16 h-16 text-primary" />
                )}
              </div>
            </div>
          </div>

          {/* Status and Actions */}
          <div className="text-center space-y-4">
            {status?.canPlay ? (
              <div className="space-y-2">
                <p className="text-green-500 font-semibold" data-testid="text-status-ready">
                  ✨ Ready to spin!
                </p>
                <Button
                  onClick={handleSpin}
                  disabled={spinning || playMutation.isPending}
                  size="lg"
                  className="w-full max-w-xs"
                  data-testid="button-play-spin"
                >
                  {spinning || playMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Spinning...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Spin Now!
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground font-semibold" data-testid="text-status-played">
                  You've already spun today!
                </p>
                {status?.lastReward && (
                  <p className="text-sm text-muted-foreground" data-testid="text-last-reward">
                    Last reward: <span className="text-primary font-semibold">{status.lastReward} MERE</span>
                  </p>
                )}
                <div className="mt-4 p-4 rounded-lg bg-card/50 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Next spin in:</p>
                  <p className="text-2xl font-bold text-primary font-mono" data-testid="text-countdown">
                    {timeLeft}
                  </p>
                </div>
                <Button
                  disabled
                  size="lg"
                  variant="outline"
                  className="w-full max-w-xs"
                  data-testid="button-play-spin-disabled"
                >
                  Come Back Tomorrow
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon */}
      <Card className="border-primary/10 opacity-60" data-testid="card-coming-soon">
        <CardHeader>
          <CardTitle className="text-xl text-muted-foreground">More Games Coming Soon!</CardTitle>
          <CardDescription>
            Stay tuned for Hash Hunter, Miner Match, and more exciting mini-games!
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
