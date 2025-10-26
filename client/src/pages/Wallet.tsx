import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Copy, Check, ExternalLink, ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatMERE, mereToUSD, usdToMERE, MERE_TO_USD_RATE } from "@/lib/constants";
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
  const [showConvert, setShowConvert] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [convertDirection, setConvertDirection] = useState<"mere-to-usdt" | "usdt-to-mere">("mere-to-usdt");
  const [depositAddress, setDepositAddress] = useState("");
  const [copied, setCopied] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState("");

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
    mutationFn: async (data: { amountUsdt: string, address: string }) => {
      await apiRequest("POST", "/api/wallet/withdraw", { 
        amountMere: usdToMERE(parseFloat(data.amountUsdt)).toString(),
        address: data.address
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      setShowWithdraw(false);
      setWithdrawAmount("");
      setWithdrawAddress("");
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

  // Convert mutation
  const convertMutation = useMutation({
    mutationFn: async (data: { fromCurrency: string, toCurrency: string, amount: string }) => {
      await apiRequest("POST", "/api/wallet/convert", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      setShowConvert(false);
      setConvertAmount("");
      toast({
        title: "Conversion Successful",
        description: "Your funds have been converted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Conversion Failed",
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
    if (!withdrawAddress || withdrawAddress.length < 10) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid USDT(TRC-20) wallet address",
        variant: "destructive",
      });
      return;
    }
    withdrawMutation.mutate({ amountUsdt: withdrawAmount, address: withdrawAddress });
  };

  const handleConvert = () => {
    if (!convertAmount || parseFloat(convertAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    convertMutation.mutate({
      fromCurrency: convertDirection === "mere-to-usdt" ? "MERE" : "USDT",
      toCurrency: convertDirection === "mere-to-usdt" ? "USDT" : "MERE",
      amount: convertAmount
    });
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
      case "conversion":
        return <ArrowLeftRight className="w-4 h-4 text-primary" />;
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
      case "conversion":
        return "text-primary";
      default:
        return "text-foreground";
    }
  };

  const mereBalance = parseFloat(user?.mereBalance || "0");
  const usdtBalance = parseFloat(user?.usdtBalance || "0");
  const withdrawAmountUsdt = parseFloat(withdrawAmount) || 0;
  const withdrawFee = withdrawAmountUsdt * 0.02; // 2% fee
  const withdrawTotal = withdrawAmountUsdt - withdrawFee;

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
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MERE Balance Card */}
          <Card className="p-6 border-primary/30 bg-gradient-to-br from-card to-accent/20">
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">MERE Balance</div>
              <div className="text-4xl font-display font-bold bg-gold-gradient bg-clip-text text-transparent" data-testid="text-mere-balance">
                {formatMERE(mereBalance)}
              </div>
              <div className="text-xs text-muted-foreground">MERE</div>
            </div>
          </Card>

          {/* USDT Balance Card */}
          <Card className="p-6 border-primary/30 bg-gradient-to-br from-card to-accent/20">
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">USDT Balance</div>
              <div className="text-4xl font-display font-bold text-primary" data-testid="text-usdt-balance">
                {usdtBalance.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">USDT</div>
            </div>
          </Card>
        </div>

        {/* Exchange Rate Info */}
        <Card className="p-4 bg-accent/10 border-primary/10">
          <div className="text-center text-sm text-muted-foreground">
            Exchange Rate: <span className="text-foreground font-semibold">1 MERE = {MERE_TO_USD_RATE.toFixed(2)} USDT</span>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-center flex-wrap">
          <Button
            onClick={handleDeposit}
            className="flex-1 min-w-[140px] bg-gold-gradient text-black font-bold"
            data-testid="button-deposit"
          >
            <ArrowDownToLine className="w-4 h-4 mr-2" />
            Deposit
          </Button>
          <Button
            onClick={() => setShowWithdraw(true)}
            variant="outline"
            className="flex-1 min-w-[140px]"
            data-testid="button-withdraw"
          >
            <ArrowUpFromLine className="w-4 h-4 mr-2" />
            Withdraw
          </Button>
          <Button
            onClick={() => setShowConvert(true)}
            variant="secondary"
            className="flex-1 min-w-[140px]"
            data-testid="button-convert"
          >
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            Convert
          </Button>
        </div>

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
                          {parseFloat(tx.amountUsd).toFixed(2)} USDT
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
                <strong>Exchange Rate:</strong> 1 USDT = {(1 / MERE_TO_USD_RATE).toFixed(0)} MERE (1 MERE = {MERE_TO_USD_RATE.toFixed(2)} USDT)
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
                  <div className="text-sm font-medium">USDT(TRC-20) Address</div>
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
              Withdraw USDT to your external wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Withdrawal Address USDT(TRC-20)</label>
              <Input
                type="text"
                placeholder="USDT(TRC-20) wallet address"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-withdraw-address"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Amount (USDT)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                data-testid="input-withdraw-amount"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Available: {usdtBalance.toFixed(2)} USDT
              </div>
            </div>

            {withdrawAmountUsdt > 0 && (
              <Card className="p-4 space-y-2 bg-accent/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span>{withdrawAmountUsdt.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee (2%):</span>
                  <span className="text-status-busy">-{withdrawFee.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="font-semibold">You will receive:</span>
                  <div className="text-right">
                    <div className="font-bold text-primary">{withdrawTotal.toFixed(2)} USDT</div>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-4 bg-primary/10">
              <div className="text-sm text-muted-foreground">
                <strong>Important:</strong> Only withdraw to a valid USDT(TRC-20) wallet address. Withdrawals are final and cannot be reversed.
              </div>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdraw(false)} data-testid="button-cancel-withdraw">
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawAmountUsdt <= 0 || withdrawAmountUsdt > usdtBalance || !withdrawAddress || withdrawMutation.isPending}
              className="bg-gold-gradient text-black font-bold"
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending ? "Processing..." : "Confirm Withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={showConvert} onOpenChange={setShowConvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Currency</DialogTitle>
            <DialogDescription>
              Convert between MERE and USDT instantly
            </DialogDescription>
          </DialogHeader>

          <Tabs value={convertDirection} onValueChange={(v) => setConvertDirection(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mere-to-usdt" data-testid="tab-mere-to-usdt">MERE → USDT</TabsTrigger>
              <TabsTrigger value="usdt-to-mere" data-testid="tab-usdt-to-mere">USDT → MERE</TabsTrigger>
            </TabsList>

            <TabsContent value="mere-to-usdt" className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Amount (MERE)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  data-testid="input-convert-amount-mere"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Available: {formatMERE(mereBalance)} MERE
                </div>
              </div>

              {parseFloat(convertAmount) > 0 && (
                <Card className="p-4 space-y-2 bg-accent/20">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Convert:</span>
                    <span>{formatMERE(parseFloat(convertAmount))} MERE</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Exchange Rate:</span>
                    <span>1 MERE = {MERE_TO_USD_RATE.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="font-semibold">You will receive:</span>
                    <div className="text-right">
                      <div className="font-bold text-primary">
                        {mereToUSD(parseFloat(convertAmount)).toFixed(2)} USDT
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="usdt-to-mere" className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Amount (USDT)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  data-testid="input-convert-amount-usdt"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Available: {usdtBalance.toFixed(2)} USDT
                </div>
              </div>

              {parseFloat(convertAmount) > 0 && (
                <Card className="p-4 space-y-2 bg-accent/20">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Convert:</span>
                    <span>{parseFloat(convertAmount).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Exchange Rate:</span>
                    <span>1 USDT = {(1 / MERE_TO_USD_RATE).toFixed(0)} MERE</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="font-semibold">You will receive:</span>
                    <div className="text-right">
                      <div className="font-bold text-primary">
                        {formatMERE(usdToMERE(parseFloat(convertAmount)))} MERE
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          <Card className="p-4 bg-primary/10">
            <div className="text-sm text-muted-foreground">
              <strong>Note:</strong> Conversions are instant with no fees. Exchange rate: 1 MERE = {MERE_TO_USD_RATE.toFixed(2)} USDT
            </div>
          </Card>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvert(false)} data-testid="button-cancel-convert">
              Cancel
            </Button>
            <Button
              onClick={handleConvert}
              disabled={!convertAmount || parseFloat(convertAmount) <= 0 || convertMutation.isPending}
              className="bg-gold-gradient text-black font-bold"
              data-testid="button-confirm-convert"
            >
              {convertMutation.isPending ? "Converting..." : "Confirm Conversion"}
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
