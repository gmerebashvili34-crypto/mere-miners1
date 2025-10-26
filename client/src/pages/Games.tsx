import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Trophy, Sparkles, Gift, Gem, Grid3x3 } from "lucide-react";
import { useState, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";

interface GameStatus {
  canPlay: boolean;
  lastPlayedAt: string | null;
  nextPlayAt: string | null;
  lastReward?: string;
  lastRarity?: string;
  isFirstPlay?: boolean;
}

interface Card {
  id: number;
  minerType: string;
  flipped: boolean;
  matched: boolean;
}

const rarityColors = {
  common: "from-gray-400 to-gray-500",
  rare: "from-blue-400 to-blue-600",
  epic: "from-purple-400 to-purple-600",
  legendary: "from-yellow-400 to-yellow-600",
};

const rarityText = {
  common: "text-gray-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-yellow-400",
};

export default function Games() {
  const { toast } = useToast();
  
  // Daily Spin state
  const [spinning, setSpinning] = useState(false);
  const [showSpinReward, setShowSpinReward] = useState(false);
  const [spinRewardAmount, setSpinRewardAmount] = useState<string | null>(null);
  const [spinTimeLeft, setSpinTimeLeft] = useState<string>("");

  // Lucky Draw state
  const [drawing, setDrawing] = useState(false);
  const [showDrawReward, setShowDrawReward] = useState(false);
  const [drawRewardAmount, setDrawRewardAmount] = useState<string | null>(null);
  const [drawRarity, setDrawRarity] = useState<string | null>(null);
  const [drawTimeLeft, setDrawTimeLeft] = useState<string>("");

  // Miner Match state
  const [matchCards, setMatchCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [matchMoves, setMatchMoves] = useState<number>(0);
  const [matchGameActive, setMatchGameActive] = useState(false);
  const [matchTimeLeft, setMatchTimeLeft] = useState<string>("");

  // Queries
  const { data: spinStatus, isLoading: spinLoading } = useQuery<GameStatus>({
    queryKey: ["/api/games/daily-spin/status"],
  });

  const { data: drawStatus, isLoading: drawLoading } = useQuery<GameStatus>({
    queryKey: ["/api/games/lucky-draw/status"],
  });

  const { data: matchStatus, isLoading: matchLoading } = useQuery<GameStatus>({
    queryKey: ["/api/games/miner-match/status"],
  });

  // Mutations
  const spinMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/games/daily-spin/play", {});
    },
    onSuccess: (data: any) => {
      setSpinRewardAmount(data.reward);
      setShowSpinReward(true);
      
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

  const drawMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/games/lucky-draw/play", {});
    },
    onSuccess: (data: any) => {
      setDrawRewardAmount(data.reward);
      setDrawRarity(data.rarity);
      setShowDrawReward(true);
      
      const rarityLabel = data.rarity.charAt(0).toUpperCase() + data.rarity.slice(1);
      
      toast({
        title: `✨ ${rarityLabel} Gem!`,
        description: `You won ${data.reward} MERE!`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/games/lucky-draw/status"] });
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

  const matchMutation = useMutation({
    mutationFn: async (moves: number) => {
      return await apiRequest("POST", "/api/games/miner-match/play", { moves });
    },
    onSuccess: (data: any) => {
      toast({
        title: "🎉 Game Complete!",
        description: `You won ${data.reward} MERE in ${matchMoves} moves!`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/games/miner-match/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to complete game",
      });
    },
  });

  // Handlers
  const handleSpin = async () => {
    if (spinning || spinMutation.isPending) return;
    
    setSpinning(true);
    setShowSpinReward(false);
    
    setTimeout(async () => {
      try {
        await spinMutation.mutateAsync();
      } catch (error) {
        // Error already handled
      } finally {
        setSpinning(false);
      }
    }, 2000);
  };

  const handleDraw = async () => {
    if (drawing || drawMutation.isPending) return;
    
    setDrawing(true);
    setShowDrawReward(false);
    
    setTimeout(async () => {
      try {
        await drawMutation.mutateAsync();
      } catch (error) {
        // Error already handled
      } finally {
        setDrawing(false);
      }
    }, 2000);
  };

  const initMatchGame = () => {
    const minerTypes = ["CPU", "GPU", "ASIC", "FPGA", "Cloud", "Quantum"];
    const cardPairs = [...minerTypes, ...minerTypes];
    const shuffled = cardPairs.sort(() => Math.random() - 0.5);
    
    setMatchCards(
      shuffled.map((type, idx) => ({
        id: idx,
        minerType: type,
        flipped: false,
        matched: false,
      }))
    );
    setFlippedCards([]);
    setMatchedPairs(0);
    setMatchMoves(0);
    setMatchGameActive(true);
  };

  const handleCardClick = (cardId: number) => {
    if (!matchGameActive || flippedCards.length >= 2) return;
    if (matchCards[cardId].flipped || matchCards[cardId].matched) return;
    
    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);
    
    const newCards = [...matchCards];
    newCards[cardId].flipped = true;
    setMatchCards(newCards);
    
    if (newFlipped.length === 2) {
      setMatchMoves(matchMoves + 1);
      
      const [first, second] = newFlipped;
      if (matchCards[first].minerType === matchCards[second].minerType) {
        // Match found
        setTimeout(() => {
          const updatedCards = [...matchCards];
          updatedCards[first].matched = true;
          updatedCards[second].matched = true;
          setMatchCards(updatedCards);
          setFlippedCards([]);
          
          const newMatchedPairs = matchedPairs + 1;
          setMatchedPairs(newMatchedPairs);
          
          // Check if game complete
          if (newMatchedPairs === 6) {
            setMatchGameActive(false);
            matchMutation.mutate(matchMoves + 1);
          }
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          const updatedCards = [...matchCards];
          updatedCards[first].flipped = false;
          updatedCards[second].flipped = false;
          setMatchCards(updatedCards);
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  // Countdown timers
  useEffect(() => {
    if (!spinStatus?.nextPlayAt) return;
    
    const updateTimer = () => {
      const now = new Date();
      const next = new Date(spinStatus.nextPlayAt!);
      const diff = next.getTime() - now.getTime();
      
      if (diff <= 0) {
        setSpinTimeLeft("Ready to play!");
        queryClient.invalidateQueries({ queryKey: ["/api/games/daily-spin/status"] });
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setSpinTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [spinStatus]);

  useEffect(() => {
    if (!drawStatus?.nextPlayAt) return;
    
    const updateTimer = () => {
      const now = new Date();
      const next = new Date(drawStatus.nextPlayAt!);
      const diff = next.getTime() - now.getTime();
      
      if (diff <= 0) {
        setDrawTimeLeft("Ready to play!");
        queryClient.invalidateQueries({ queryKey: ["/api/games/lucky-draw/status"] });
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setDrawTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [drawStatus]);

  useEffect(() => {
    if (!matchStatus?.nextPlayAt) return;
    
    const updateTimer = () => {
      const now = new Date();
      const next = new Date(matchStatus.nextPlayAt!);
      const diff = next.getTime() - now.getTime();
      
      if (diff <= 0) {
        setMatchTimeLeft("Ready to play!");
        queryClient.invalidateQueries({ queryKey: ["/api/games/miner-match/status"] });
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setMatchTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [matchStatus]);

  if (spinLoading || drawLoading || matchLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-games" />
      </div>
    );
  }

  return (
    <>
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
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
            Spin the wheel once per day to win MERE tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div 
              className={`relative w-48 h-48 rounded-full border-8 border-primary/30 bg-gradient-to-br from-primary/10 to-background flex items-center justify-center ${
                spinning ? 'animate-spin' : ''
              }`}
              data-testid="spinner-wheel"
            >
              <div className="absolute inset-0 rounded-full border-8 border-transparent border-t-primary"></div>
              <div className="relative z-10">
                {showSpinReward && spinRewardAmount ? (
                  <div className="text-center animate-bounce" data-testid="text-spin-reward">
                    <Gift className="w-16 h-16 mx-auto text-primary mb-2" />
                    <p className="text-3xl font-bold text-primary">{spinRewardAmount}</p>
                    <p className="text-sm text-muted-foreground">MERE</p>
                  </div>
                ) : (
                  <Sparkles className="w-16 h-16 text-primary" />
                )}
              </div>
            </div>
          </div>

          <div className="text-center space-y-4">
            {spinStatus?.canPlay ? (
              <div className="space-y-2">
                <p className="text-green-500 font-semibold" data-testid="text-spin-ready">
                  ✨ Ready to spin!
                </p>
                <Button
                  onClick={handleSpin}
                  disabled={spinning || spinMutation.isPending}
                  size="lg"
                  className="w-full max-w-xs"
                  data-testid="button-play-spin"
                >
                  {spinning || spinMutation.isPending ? (
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
                <p className="text-muted-foreground font-semibold" data-testid="text-spin-played">
                  You've already spun today!
                </p>
                {spinStatus?.lastReward && (
                  <p className="text-sm text-muted-foreground" data-testid="text-spin-last-reward">
                    Last reward: <span className="text-primary font-semibold">{spinStatus.lastReward} MERE</span>
                  </p>
                )}
                <div className="mt-4 p-4 rounded-lg bg-card/50 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Next spin in:</p>
                  <p className="text-2xl font-bold text-primary font-mono" data-testid="text-spin-countdown">
                    {spinTimeLeft}
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

      {/* Lucky Draw Game */}
      <Card className="border-primary/20" data-testid="card-lucky-draw">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Gem className="w-6 h-6 text-primary" />
            Lucky Draw
          </CardTitle>
          <CardDescription>
            Draw a gem once per day for rarity-based MERE rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div 
              className={`relative w-48 h-48 rounded-lg border-4 border-primary/30 bg-gradient-to-br from-background to-card flex items-center justify-center ${
                drawing ? 'animate-pulse' : ''
              }`}
              data-testid="draw-gem-container"
            >
              {showDrawReward && drawRewardAmount && drawRarity ? (
                <div className="text-center" data-testid="text-draw-reward">
                  <div className={`w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br ${rarityColors[drawRarity as keyof typeof rarityColors]} animate-pulse flex items-center justify-center`}>
                    <Gem className="w-16 h-16 text-white" />
                  </div>
                  <p className={`text-xl font-bold mb-1 ${rarityText[drawRarity as keyof typeof rarityText]}`}>
                    {drawRarity.charAt(0).toUpperCase() + drawRarity.slice(1)} Gem
                  </p>
                  <p className="text-3xl font-bold text-primary">{drawRewardAmount}</p>
                  <p className="text-sm text-muted-foreground">MERE</p>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                  <Gem className="w-16 h-16 text-white" />
                </div>
              )}
            </div>
          </div>

          <div className="text-center space-y-4">
            {drawStatus?.canPlay ? (
              <div className="space-y-2">
                {drawStatus.isFirstPlay && (
                  <p className="text-xs text-muted-foreground" data-testid="text-draw-first">
                    🎁 First draw guaranteed!
                  </p>
                )}
                <p className="text-green-500 font-semibold" data-testid="text-draw-ready">
                  ✨ Ready to draw!
                </p>
                <Button
                  onClick={handleDraw}
                  disabled={drawing || drawMutation.isPending}
                  size="lg"
                  className="w-full max-w-xs"
                  data-testid="button-play-draw"
                >
                  {drawing || drawMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Drawing...
                    </>
                  ) : (
                    <>
                      <Gem className="w-4 h-4 mr-2" />
                      Draw Now!
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground font-semibold" data-testid="text-draw-played">
                  You've already drawn today!
                </p>
                {drawStatus?.lastReward && drawStatus?.lastRarity && (
                  <p className="text-sm text-muted-foreground" data-testid="text-draw-last-reward">
                    Last draw: <span className={`font-semibold ${rarityText[drawStatus.lastRarity as keyof typeof rarityText]}`}>
                      {drawStatus.lastRarity.charAt(0).toUpperCase() + drawStatus.lastRarity.slice(1)}
                    </span> - <span className="text-primary font-semibold">{drawStatus.lastReward} MERE</span>
                  </p>
                )}
                <div className="mt-4 p-4 rounded-lg bg-card/50 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Next draw in:</p>
                  <p className="text-2xl font-bold text-primary font-mono" data-testid="text-draw-countdown">
                    {drawTimeLeft}
                  </p>
                </div>
                <Button
                  disabled
                  size="lg"
                  variant="outline"
                  className="w-full max-w-xs"
                  data-testid="button-play-draw-disabled"
                >
                  Come Back Tomorrow
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Miner Match Game */}
      <Card className="border-primary/20" data-testid="card-miner-match">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Grid3x3 className="w-6 h-6 text-primary" />
            Miner Match
          </CardTitle>
          <CardDescription>
            Match pairs of miners to earn MERE
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {matchGameActive ? (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Moves: <span className="text-primary font-bold">{matchMoves}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Pairs: <span className="text-primary font-bold">{matchedPairs}/6</span>
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto" data-testid="match-grid">
                {matchCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => handleCardClick(card.id)}
                    disabled={card.matched || card.flipped}
                    className={`aspect-square rounded-lg border-2 transition-all ${
                      card.matched
                        ? 'bg-primary/20 border-primary cursor-not-allowed'
                        : card.flipped
                        ? 'bg-primary/30 border-primary'
                        : 'bg-card border-primary/20 hover-elevate active-elevate-2'
                    }`}
                    data-testid={`match-card-${card.id}`}
                  >
                    <div className="flex items-center justify-center h-full">
                      {(card.flipped || card.matched) ? (
                        <span className="text-lg font-bold text-primary">{card.minerType}</span>
                      ) : (
                        <Grid3x3 className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              {matchStatus?.canPlay ? (
                <div className="space-y-2">
                  <p className="text-green-500 font-semibold" data-testid="text-match-ready">
                    ✨ Ready to play!
                  </p>
                  <Button
                    onClick={initMatchGame}
                    size="lg"
                    className="w-full max-w-xs"
                    data-testid="button-play-match"
                  >
                    <Grid3x3 className="w-4 h-4 mr-2" />
                    Start Game
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground font-semibold" data-testid="text-match-played">
                    You've already played today!
                  </p>
                  {matchStatus?.lastReward && (
                    <p className="text-sm text-muted-foreground" data-testid="text-match-last-reward">
                      Last reward: <span className="text-primary font-semibold">{matchStatus.lastReward} MERE</span>
                    </p>
                  )}
                  <div className="mt-4 p-4 rounded-lg bg-card/50 border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">Next game in:</p>
                    <p className="text-2xl font-bold text-primary font-mono" data-testid="text-match-countdown">
                      {matchTimeLeft}
                    </p>
                  </div>
                  <Button
                    disabled
                    size="lg"
                    variant="outline"
                    className="w-full max-w-xs"
                    data-testid="button-play-match-disabled"
                  >
                    Come Back Tomorrow
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="h-20"></div>
    </div>
    <BottomNav />
  </>
  );
}
