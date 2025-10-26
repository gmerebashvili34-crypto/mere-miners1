import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap, TrendingUp, Trophy, Star } from "lucide-react";
import minerImage1 from "@assets/generated_images/Gold_accent_mining_rig_f7e3dcd1.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/10">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        
        <div className="relative container mx-auto px-4 py-12 sm:py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="font-display font-bold text-5xl sm:text-7xl mb-6">
              <span className="bg-gold-gradient bg-clip-text text-transparent">
                MereMiners
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground mb-4">
              Premium Crypto Mining Game
            </p>
            <p className="text-base sm:text-lg text-foreground/80 mb-8 px-4">
              Buy toy-like miners with MERE tokens, place them in your mining room, and watch your earnings grow in real-time
            </p>
            
            <div className="flex flex-col gap-4 justify-center items-center mb-12">
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto text-lg px-8 py-6 bg-gold-gradient hover:opacity-90 text-black font-bold"
                  onClick={() => window.location.href = "/signup"}
                  data-testid="button-signup"
                >
                  Sign Up
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-lg px-8 py-6"
                  onClick={() => window.location.href = "/signin"}
                  data-testid="button-signin"
                >
                  Sign In
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                1 MERE = $0.50 USD
              </div>
            </div>

            <div className="relative w-full max-w-md mx-auto mb-12">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl" />
              <img
                src={minerImage1}
                alt="Premium Mining Rig"
                className="relative w-full h-auto animate-float"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-center mb-12">
          How It <span className="bg-gold-gradient bg-clip-text text-transparent">Works</span>
        </h2>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <Card className="p-6 border-card-border bg-card hover-elevate">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Deposit USDT</h3>
            <p className="text-sm text-muted-foreground">
              Convert USDT (TRC-20) to MERE tokens at a fixed rate of $0.50 per MERE
            </p>
          </Card>

          <Card className="p-6 border-card-border bg-card hover-elevate">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <ShoppingBag className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Buy Miners</h3>
            <p className="text-sm text-muted-foreground">
              Purchase premium toy-like miners with MERE. Get bulk discounts on larger orders
            </p>
          </Card>

          <Card className="p-6 border-card-border bg-card hover-elevate">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Mine MERE</h3>
            <p className="text-sm text-muted-foreground">
              Place miners in your mining room and earn MERE every minute. 1 TH/s = 0.16 MERE/day
            </p>
          </Card>

          <Card className="p-6 border-card-border bg-card hover-elevate">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Compete & Earn</h3>
            <p className="text-sm text-muted-foreground">
              Climb seasonal leaderboards and unlock exclusive rewards through the Season Pass
            </p>
          </Card>
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="p-8 sm:p-12 border-card-border bg-gradient-to-br from-card to-accent/20 max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl sm:text-5xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent mb-2">
                ~175
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide">
                Days to ROI
              </div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent mb-2">
                0.16
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide">
                MERE per TH/s Daily
              </div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent mb-2">
                20%
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide">
                Max Bulk Discount
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16 pb-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-6">
            Ready to Start <span className="bg-gold-gradient bg-clip-text text-transparent">Mining</span>?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of miners earning MERE tokens every day
          </p>
          <Button
            size="lg"
            className="text-lg px-8 py-6 bg-gold-gradient hover:opacity-90 text-black font-bold"
            onClick={() => window.location.href = "/signup"}
            data-testid="button-login-cta"
          >
            Get Started Now
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShoppingBag({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
