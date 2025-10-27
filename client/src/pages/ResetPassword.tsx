import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
  }, []);

  const submit = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await apiRequest('POST', '/api/auth/reset-password', { token, password });
      toast({ title: 'Password updated', description: 'You can now sign in.' });
      setLocation('/signin');
    } catch (e: any) {
      toast({ title: 'Reset failed', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display font-bold">
            <span className="bg-gold-gradient bg-clip-text text-transparent">Reset Password</span>
          </CardTitle>
          <CardDescription>Enter a new password (min 8 characters)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            <Button className="w-full bg-gold-gradient text-black font-bold" onClick={submit} disabled={loading || !password || !token}>
              {loading ? 'Saving…' : 'Save new password'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
