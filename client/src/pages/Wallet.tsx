import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Copy, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE, formatUSD, mereToUSD, usdToMERE, MERE_TO_USD_RATE } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Transaction } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Wallet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositAddress, setDepositAddress] = useState("");
  const [copied, setCopied] = useState(false);

  // Fetch transactions
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  // Generate deposit address
  const generateDepositMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/wallet/deposit/generate", {});
      return response;
    },
    onSuccess: (data: any) => {
      setDepositAddress(data.address);
    },
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async (amount: string) => {
      await apiRequest("POST", "/api/wallet/withdraw", { amountMere: amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      setShowWithdraw(false);
      setWithdrawAmount("");
      toast({
        title: "Withdrawal Initiated",
        description: "Your withdrawal is being processed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  const handleDeposit = () => {
    setShowDeposit(true);
    if (!depositAddress) {
      generateDepositMutation.mutate();
    }
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    withdrawMutation.mutate(withdrawAmount);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownToLine className="w-4 h-4 text-status-online" />;
      case "withdrawal":
        return <ArrowUpFromLine className="w-4 h-4 text-status-busy" />;
      case "purchase":
        return <WalletIcon className="w-4 h-4 text-primary" />;
      case "earnings":
        return <TrendingUp className="w-4 h-4 text-primary" />;
      default:
        return <WalletIcon className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "deposit":
      case "earnings":
      case "reward":
        return "text-status-online";
      case "withdrawal":
      case "purchase":
        return "text-status-busy";
      default:
        return "text-foreground";
    }
  };

  const mereBalance = parseFloat(user?.mereBalance || "0");
  const usdBalance = mereToUSD(mereBalance);
  const withdrawAmountMere = parseFloat(withdrawAmount) || 0;
  const withdrawFee = withdrawAmountMere * 0.02; // 2% fee
  const withdrawTotal = withdrawAmountMere - withdrawFee;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <h1 className="font-display font-bold text-2xl bg-gold-gradient bg-clip-text text-transparent flex items-center gap-2">
            <WalletIcon className="w-6 h-6 text-primary" />
            Wallet
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Balance Card */}
        <Card className="p-6 border-primary/30 bg-gradient-to-br from-card to-accent/20">
          <div className="text-center space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-2">MERE Balance</div>
              <div className="text-5xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent" data-testid="text-mere-balance">
                {formatMERE(mereBalance)}
              </div>
              <div className="text-muted-foreground mt-2">
                ≈ {formatUSD(usdBalance)} (1 MERE = {formatUSD(MERE_TO_USD_RATE)})
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleDeposit}
                className="flex-1 max-w-[200px] bg-gold-gradient text-black font-bold"
                data-testid="button-deposit"
              >
                <ArrowDownToLine className="w-4 h-4 mr-2" />
                Deposit
              </Button>
              <Button
                onClick={() => setShowWithdraw(true)}
                variant="outline"
                className="flex-1 max-w-[200px]"
                data-testid="button-withdraw"
              >
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </div>
          </div>
        </Card>

        {/* Transaction History */}
        <div>
          <h2 className="font-display font-bold text-lg mb-4">Transaction History</h2>
          
          {transactions.length === 0 ? (
            <Card className="p-12 text-center border-card-border">
              <p className="text-muted-foreground">No transactions yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <Card key={tx.id} className="p-4 border-card-border hover-elevate">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                      {getTransactionIcon(tx.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground capitalize">
                        {tx.description || tx.type}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(tx.createdAt!).toLocaleString()}
                      </div>
                      {tx.txHash && (
                        <div className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-1">
                          {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className={`font-bold ${getTransactionColor(tx.type)}`}>
                        {tx.type === "withdrawal" || tx.type === "purchase" ? "-" : "+"}
                        {formatMERE(tx.amountMere)} MERE
                      </div>
                      {tx.amountUsd && (
                        <div className="text-sm text-muted-foreground">
                          {formatUSD(tx.amountUsd)}
                        </div>
                      )}
                      <div className="text-xs">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          tx.status === "completed" ? "bg-status-online/20 text-status-online" :
                          tx.status === "pending" ? "bg-status-away/20 text-status-away" :
                          "bg-status-busy/20 text-status-busy"
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deposit Dialog */}
      <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deposit USDT (TRC-20)</DialogTitle>
            <DialogDescription>
              Send USDT to this address to add funds to your wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Card className="p-4 bg-accent/20">
              <div className="text-sm text-muted-foreground mb-2">
                <strong>Important:</strong> Only send USDT (TRC-20) to this address. Other tokens will be lost.
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Exchange Rate:</strong> 1 USDT = 2 MERE (1 MERE = $0.50)
              </div>
            </Card>

            {depositAddress ? (
              <>
                <div className="bg-white p-4 rounded-lg">
                  <div className="w-full aspect-square bg-white rounded-lg flex items-center justify-center">
                    <div className="text-xs font-mono break-all text-center p-4 text-black">
                      {depositAddress}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">TRON Address (TRC-20)</div>
                  <div className="flex gap-2">
                    <Input
                      value={depositAddress}
                      readOnly
                      className="font-mono text-sm"
                      data-testid="input-deposit-address"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyAddress}
                      data-testid="button-copy-address"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Card className="p-4 bg-primary/10">
                  <div className="text-sm">
                    <div className="font-semibold mb-2">Next Steps:</div>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Copy the address above</li>
                      <li>Send USDT (TRC-20) from your wallet</li>
                      <li>Wait for blockchain confirmations (usually 1-2 minutes)</li>
                      <li>Your MERE balance will be updated automatically</li>
                    </ol>
                  </div>
                </Card>
              </>
            ) : (
              <div className="text-center py-8">
                <Button
                  onClick={() => generateDepositMutation.mutate()}
                  disabled={generateDepositMutation.isPending}
                  data-testid="button-generate-deposit"
                >
                  {generateDepositMutation.isPending ? "Generating..." : "Generate Deposit Address"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw USDT (TRC-20)</DialogTitle>
            <DialogDescription>
              Convert MERE to USDT and withdraw to your wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Amount (MERE)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                data-testid="input-withdraw-amount"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Available: {formatMERE(mereBalance)} MERE
              </div>
            </div>

            {withdrawAmountMere > 0 && (
              <Card className="p-4 space-y-2 bg-accent/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span>{formatMERE(withdrawAmountMere)} MERE</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee (2%):</span>
                  <span className="text-status-busy">-{formatMERE(withdrawFee)} MERE</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="font-semibold">You will receive:</span>
                  <div className="text-right">
                    <div className="font-bold">{formatMERE(withdrawTotal)} MERE</div>
                    <div className="text-xs text-muted-foreground">
                      ≈ {formatUSD(mereToUSD(withdrawTotal))} USDT
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-4 bg-primary/10">
              <div className="text-sm text-muted-foreground">
                <strong>Note:</strong> This is a demo. In production, you would need to provide a TRC-20 wallet address for withdrawal.
              </div>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdraw(false)} data-testid="button-cancel-withdraw">
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawAmountMere <= 0 || withdrawAmountMere > mereBalance || withdrawMutation.isPending}
              className="bg-gold-gradient text-black font-bold"
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending ? "Processing..." : "Confirm Withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

function TrendingUp({ className }: { className?: string }) {
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
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
