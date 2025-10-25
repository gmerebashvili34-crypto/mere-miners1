import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { Trophy, Medal, Crown, Zap, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE } from "@/lib/constants";
import type { LeaderboardEntry, User } from "@shared/schema";

interface LeaderboardEntryWithUser extends LeaderboardEntry {
  user: User;
}

export default function Leaderboard() {
  const { user: currentUser } = useAuth();

  // Fetch leaderboard
  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntryWithUser[]>({
    queryKey: ["/api/leaderboard"],
  });

  // Fetch current season
  const { data: season } = useQuery<{ id: string; name: string; endAt: string }>({
    queryKey: ["/api/leaderboard/season"],
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-gold-DEFAULT" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-700" />;
      default:
        return null;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-gold-gradient text-black font-bold">1st</Badge>;
      case 2:
        return <Badge className="bg-gradient-to-r from-gray-300 to-gray-500 text-white font-bold">2nd</Badge>;
      case 3:
        return <Badge className="bg-gradient-to-r from-amber-600 to-amber-800 text-white font-bold">3rd</Badge>;
      default:
        return <Badge variant="secondary">{rank}th</Badge>;
    }
  };

  const daysLeft = season?.endAt ? Math.ceil((new Date(season.endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="animate-pulse text-primary">Loading leaderboard...</div>
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
              <Trophy className="w-6 h-6 text-primary" />
              Leaderboard
            </h1>
            {season && (
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground">{season.name}</div>
                <div className="text-xs text-muted-foreground">{daysLeft} days left</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 items-end mb-6">
            {/* 2nd Place */}
            <div className="text-center">
              <Card className="p-4 bg-gradient-to-br from-card to-gray-500/10 border-gray-400/30">
                <div className="flex justify-center mb-2">
                  <Medal className="w-8 h-8 text-gray-400" />
                </div>
                <Avatar className="w-16 h-16 mx-auto mb-2 border-2 border-gray-400">
                  <AvatarImage src={leaderboard[1]?.user.profileImageUrl || ""} />
                  <AvatarFallback className="bg-gray-500 text-white">
                    {leaderboard[1]?.user.firstName?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="font-semibold text-sm truncate">
                  {leaderboard[1]?.user.firstName || "User"}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {formatMERE(leaderboard[1]?.totalMined || "0")} MERE
                </div>
                <Badge className="bg-gradient-to-r from-gray-300 to-gray-500 text-white text-xs">2nd</Badge>
              </Card>
            </div>

            {/* 1st Place */}
            <div className="text-center">
              <Card className="p-4 bg-gradient-to-br from-card to-primary/20 border-primary/50 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-gold-gradient w-12 h-12 rounded-full flex items-center justify-center animate-pulse-glow">
                    <Crown className="w-6 h-6 text-black" />
                  </div>
                </div>
                <div className="mt-2" />
                <Avatar className="w-20 h-20 mx-auto mb-2 border-4 border-primary">
                  <AvatarImage src={leaderboard[0]?.user.profileImageUrl || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {leaderboard[0]?.user.firstName?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="font-bold text-base truncate">
                  {leaderboard[0]?.user.firstName || "User"}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {formatMERE(leaderboard[0]?.totalMined || "0")} MERE
                </div>
                <Badge className="bg-gold-gradient text-black font-bold">1st</Badge>
              </Card>
            </div>

            {/* 3rd Place */}
            <div className="text-center">
              <Card className="p-4 bg-gradient-to-br from-card to-amber-700/10 border-amber-700/30">
                <div className="flex justify-center mb-2">
                  <Medal className="w-8 h-8 text-amber-700" />
                </div>
                <Avatar className="w-16 h-16 mx-auto mb-2 border-2 border-amber-700">
                  <AvatarImage src={leaderboard[2]?.user.profileImageUrl || ""} />
                  <AvatarFallback className="bg-amber-700 text-white">
                    {leaderboard[2]?.user.firstName?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="font-semibold text-sm truncate">
                  {leaderboard[2]?.user.firstName || "User"}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {formatMERE(leaderboard[2]?.totalMined || "0")} MERE
                </div>
                <Badge className="bg-gradient-to-r from-amber-600 to-amber-800 text-white text-xs">3rd</Badge>
              </Card>
            </div>
          </div>
        )}

        {/* Full Rankings */}
        <div>
          <h2 className="font-display font-bold text-lg mb-4">Rankings</h2>
          
          {leaderboard.length === 0 ? (
            <Card className="p-12 text-center border-card-border">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No rankings yet. Start mining to appear on the leaderboard!</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => {
                const isCurrentUser = entry.userId === currentUser?.id;
                return (
                  <Card
                    key={entry.id}
                    className={`p-4 border-card-border hover-elevate ${
                      isCurrentUser ? "border-primary/50 bg-primary/5" : ""
                    }`}
                    data-testid={`leaderboard-entry-${index + 1}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12">
                        {getRankIcon(entry.rank || index + 1) || (
                          <div className="text-2xl font-display font-bold text-muted-foreground">
                            {entry.rank || index + 1}
                          </div>
                        )}
                      </div>

                      <Avatar className="w-12 h-12">
                        <AvatarImage src={entry.user.profileImageUrl || ""} />
                        <AvatarFallback className="bg-accent text-foreground">
                          {entry.user.firstName?.[0] || entry.user.email?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {entry.user.firstName || entry.user.email?.split("@")[0] || "Anonymous"}
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>{formatMERE(entry.totalMined)} MERE</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>{entry.totalHashrate.toFixed(2)} TH/s</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {getRankBadge(entry.rank || index + 1)}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Season Rewards Info */}
        <Card className="p-6 bg-gradient-to-br from-card to-primary/10 border-primary/30">
          <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Season Rewards
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">1st Place:</span>
              <span className="font-semibold text-primary">1000 MERE + Legendary Miner</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">2nd Place:</span>
              <span className="font-semibold">500 MERE + Epic Miner</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">3rd Place:</span>
              <span className="font-semibold">250 MERE + Rare Miner</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Top 10:</span>
              <span className="font-semibold">100 MERE</span>
            </div>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
