import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const submit = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/auth/forgot-password', { email });
      const json = await res.json();
      if (json?.devLink) {
        // Auto-navigate to the reset page in development for convenience
        try {
          const url = new URL(json.devLink);
          setLocation(url.pathname + url.search);
        } catch {
          // Fallback: show it so user can copy
          toast({ title: 'Development reset link', description: json.devLink });
        }
      } else {
        toast({ title: 'Check your email', description: 'If an account exists, a reset link has been sent.' });
        setLocation('/signin');
      }
    } catch (e: any) {
      toast({ title: 'Request failed', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display font-bold">
            <span className="bg-gold-gradient bg-clip-text text-transparent">Forgot Password</span>
          </CardTitle>
          <CardDescription>Enter your email to receive a reset link</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            <Button className="w-full bg-gold-gradient text-black font-bold" onClick={submit} disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
