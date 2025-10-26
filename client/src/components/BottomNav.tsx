import { Link, useLocation } from "wouter";
import { Home, ShoppingBag, Trophy, Star, User } from "lucide-react";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { icon: Home, label: "Mine", path: "/", testId: "nav-mining" },
    { icon: ShoppingBag, label: "Shop", path: "/shop", testId: "nav-shop" },
    { icon: Trophy, label: "Ranks", path: "/leaderboard", testId: "nav-leaderboard" },
    { icon: Star, label: "Pass", path: "/season-pass", testId: "nav-season-pass" },
    { icon: User, label: "Profile", path: "/profile", testId: "nav-profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16">
        {navItems.map(({ icon: Icon, label, path, testId }) => {
          const isActive = location === path;
          return (
            <Link key={path} href={path}>
              <div
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors cursor-pointer ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover-elevate"
                }`}
                data-testid={testId}
              >
                <Icon className={`w-5 h-5 ${isActive ? "animate-pulse-glow" : ""}`} />
                <span className="text-xs font-medium">{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
