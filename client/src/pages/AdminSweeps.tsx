import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface SweepWallet {
  userId: string;
  address: string;
  usdt: number;
  trx: number;
  sweepable: boolean;
}

export default function AdminSweeps() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<{
    platform: { address: string | null; trx: number | null; usdt: number | null };
    sweepEnabled: boolean;
    thresholdUSDT: number;
    recent: Array<{ id: string; action: string; details: any; created_at: string }>;
    wallets: SweepWallet[];
  }>({
    queryKey: ["/api/admin/sweeps"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isAuthenticated && !!user?.isAdmin,
    refetchInterval: 15000,
  });

  if (!isAuthenticated) {
    setLocation("/signin");
    return null;
  }
  if (!user?.isAdmin) {
    setLocation("/home");
    return null;
  }

  const sweepable = (data?.wallets || []).filter(w => w.sweepable && w.usdt > 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 pb-20">
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <h1 className="font-display font-bold text-2xl bg-gold-gradient bg-clip-text text-transparent">Admin • Sweeps</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Platform wallet</div>
              <div className="font-mono text-xs break-all">{data?.platform.address || "(not set)"}</div>
            </div>
            <div className="text-right">
              <div className="text-sm">TRX: {data?.platform.trx?.toFixed(4) ?? "-"}</div>
              <div className="text-sm">USDT: {data?.platform.usdt?.toFixed(2) ?? "-"}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Sweeper: {data?.sweepEnabled ? "enabled" : "disabled"} • threshold {data?.thresholdUSDT} USDT
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Sweepable wallets</h2>
            <div className="text-sm text-muted-foreground">{sweepable.length} of {data?.wallets.length || 0}</div>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {isLoading && <div className="text-sm">Loading...</div>}
            {error && <div className="text-sm text-destructive">{String((error as any)?.message || error)}</div>}
            {sweepable.map(w => (
              <div key={w.address} className="flex items-center justify-between p-3 rounded-md bg-accent/40">
                <div>
                  <div className="font-mono text-xs break-all">{w.address}</div>
                  <div className="text-xs text-muted-foreground">User: {w.userId}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">USDT: {w.usdt.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">TRX: {w.trx.toFixed(4)}</div>
                </div>
              </div>
            ))}
            {sweepable.length === 0 && !isLoading && (
              <div className="text-sm text-muted-foreground">No wallets at or above threshold.</div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-3">Recent sweep actions</h2>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {(data?.recent || []).map(r => (
              <div key={r.id} className="p-3 rounded-md bg-muted/40">
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                <div className="text-sm font-mono break-all">{JSON.stringify(r.details)}</div>
              </div>
            ))}
            {(data?.recent || []).length === 0 && (
              <div className="text-sm text-muted-foreground">No sweeps recorded yet.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
