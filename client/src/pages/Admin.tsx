import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { BottomNav } from "@/components/BottomNav";
import { Shield, Users, Cpu, Calendar, TrendingUp, DollarSign, Package, Activity, Edit, Check, X, AlertTriangle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatMERE, formatUSD } from "@/lib/constants";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface AdminStats {
  totalUsers: number;
  totalMereInCirculation: number;
  totalMereMined: number;
  activeMiners: number;
  placedMiners: number;
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
}

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  mereBalance: string;
  totalMined: string;
  isAdmin: boolean;
  totalReferrals: number;
  createdAt: string | null;
}

interface MinerType {
  id: string;
  name: string;
  description: string | null;
  thRate: number;
  basePriceMere: string;
  basePriceUsd: string;
  dailyYieldMere: string;
  dailyYieldUsd: string;
  roiDays: number;
  rarity: string;
  isAvailable: boolean;
}

interface Season {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

export default function Admin() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedMiner, setSelectedMiner] = useState<MinerType | null>(null);
  const [editMinerOpen, setEditMinerOpen] = useState(false);
  const [minerFormData, setMinerFormData] = useState<Partial<MinerType>>({});

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: user?.isAdmin || false,
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.isAdmin || false,
  });

  const { data: miners } = useQuery<MinerType[]>({
    queryKey: ["/api/admin/miners"],
    enabled: user?.isAdmin || false,
  });

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/admin/seasons"],
    enabled: user?.isAdmin || false,
  });

  // Redirect non-admin users
  useEffect(() => {
    if (user && !user.isAdmin) {
      setLocation("/");
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin dashboard.",
        variant: "destructive",
      });
    }
  }, [user, setLocation, toast]);

  // Show loading state while checking auth
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-primary font-semibold">Verifying access...</div>
        </div>
      </div>
    );
  }

  // Don't render anything if user is not admin (they'll be redirected)
  if (!user.isAdmin) {
    return null;
  }

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/admin`, { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User admin status updated",
      });
    },
  });

  const updateMinerMutation = useMutation({
    mutationFn: async ({ minerId, updates }: { minerId: string; updates: Partial<MinerType> }) => {
      return apiRequest("PATCH", `/api/admin/miners/${minerId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/miners"] });
      setEditMinerOpen(false);
      toast({
        title: "Success",
        description: "Miner type updated successfully",
      });
    },
  });

  const handleEditMiner = (miner: MinerType) => {
    setSelectedMiner(miner);
    setMinerFormData(miner);
    setEditMinerOpen(true);
  };

  const handleSaveMiner = () => {
    if (selectedMiner) {
      updateMinerMutation.mutate({
        minerId: selectedMiner.id,
        updates: minerFormData,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <h1 className="font-display font-bold text-2xl bg-gold-gradient bg-clip-text text-transparent flex items-center gap-2" data-testid="text-admin-title">
            <Shield className="w-6 h-6 text-primary" />
            Admin Dashboard
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="hover-elevate" data-testid="card-stat-users">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-primary">
                {stats?.totalUsers?.toLocaleString() || "0"}
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-stat-mere">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                MERE in Circulation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-primary" data-testid="text-mere-circulation">
                {formatMERE(stats?.totalMereInCirculation || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatUSD((stats?.totalMereInCirculation || 0) * 0.5)}
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-stat-miners">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Active Miners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-primary">
                {stats?.activeMiners?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.placedMiners || 0} placed
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate" data-testid="card-stat-transactions">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-primary">
                {stats?.totalTransactions?.toLocaleString() || "0"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-admin">
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="miners" data-testid="tab-miners">
              <Package className="w-4 h-4 mr-2" />
              Miners
            </TabsTrigger>
            <TabsTrigger value="seasons" data-testid="tab-seasons">
              <Calendar className="w-4 h-4 mr-2" />
              Seasons
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user accounts and admin privileges</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Mined</TableHead>
                        <TableHead>Referrals</TableHead>
                        <TableHead>Admin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user) => (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell className="font-mono text-sm">{user.email || "N/A"}</TableCell>
                          <TableCell>{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "N/A"}</TableCell>
                          <TableCell className="font-mono">{formatMERE(parseFloat(user.mereBalance))}</TableCell>
                          <TableCell className="font-mono">{formatMERE(parseFloat(user.totalMined))}</TableCell>
                          <TableCell>{user.totalReferrals}</TableCell>
                          <TableCell>
                            <Switch
                              checked={user.isAdmin}
                              onCheckedChange={(checked) => {
                                toggleAdminMutation.mutate({
                                  userId: user.id,
                                  isAdmin: checked,
                                });
                              }}
                              data-testid={`switch-admin-${user.id}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Miners Tab */}
          <TabsContent value="miners" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Miner Types</CardTitle>
                <CardDescription>Configure miner pricing and availability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>TH/s</TableHead>
                        <TableHead>Price (MERE)</TableHead>
                        <TableHead>Daily Yield</TableHead>
                        <TableHead>ROI (days)</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {miners?.map((miner) => (
                        <TableRow key={miner.id} data-testid={`row-miner-${miner.id}`}>
                          <TableCell className="font-semibold">{miner.name}</TableCell>
                          <TableCell>{miner.thRate.toFixed(1)}</TableCell>
                          <TableCell className="font-mono">{formatMERE(parseFloat(miner.basePriceMere))}</TableCell>
                          <TableCell className="font-mono">{formatMERE(parseFloat(miner.dailyYieldMere))}</TableCell>
                          <TableCell>{miner.roiDays}</TableCell>
                          <TableCell>
                            {miner.isAvailable ? (
                              <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
                                <Check className="w-3 h-3 mr-1" />
                                Yes
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <X className="w-3 h-3 mr-1" />
                                No
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditMiner(miner)}
                              data-testid={`button-edit-miner-${miner.id}`}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Seasons Tab */}
          <TabsContent value="seasons" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Season Management</CardTitle>
                <CardDescription>View and manage seasonal events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seasons?.map((season) => (
                        <TableRow key={season.id} data-testid={`row-season-${season.id}`}>
                          <TableCell className="font-semibold">{season.name}</TableCell>
                          <TableCell>{new Date(season.startAt).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(season.endAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {season.isActive ? (
                              <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Miner Dialog */}
      <Dialog open={editMinerOpen} onOpenChange={setEditMinerOpen}>
        <DialogContent data-testid="dialog-edit-miner">
          <DialogHeader>
            <DialogTitle>Edit Miner Type</DialogTitle>
            <DialogDescription>
              Update miner properties and availability
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={minerFormData.name || ""}
                onChange={(e) => setMinerFormData({ ...minerFormData, name: e.target.value })}
                data-testid="input-miner-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thRate">TH/s Rate</Label>
              <Input
                id="thRate"
                type="number"
                step="0.1"
                value={minerFormData.thRate || ""}
                onChange={(e) => setMinerFormData({ ...minerFormData, thRate: parseFloat(e.target.value) })}
                data-testid="input-miner-thrate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="basePriceMere">Base Price (MERE)</Label>
              <Input
                id="basePriceMere"
                type="number"
                step="0.01"
                value={minerFormData.basePriceMere || ""}
                onChange={(e) => setMinerFormData({ ...minerFormData, basePriceMere: e.target.value })}
                data-testid="input-miner-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyYieldMere">Daily Yield (MERE)</Label>
              <Input
                id="dailyYieldMere"
                type="number"
                step="0.01"
                value={minerFormData.dailyYieldMere || ""}
                onChange={(e) => setMinerFormData({ ...minerFormData, dailyYieldMere: e.target.value })}
                data-testid="input-miner-yield"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isAvailable"
                checked={minerFormData.isAvailable || false}
                onCheckedChange={(checked) => setMinerFormData({ ...minerFormData, isAvailable: checked })}
                data-testid="switch-miner-available"
              />
              <Label htmlFor="isAvailable">Available for Purchase</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMinerOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={handleSaveMiner}
              disabled={updateMinerMutation.isPending}
              data-testid="button-save-miner"
            >
              {updateMinerMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
