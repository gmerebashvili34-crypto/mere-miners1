import { useEffect, useRef } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';

declare global {
  interface Window { google?: any }
}

export function GoogleSignInButton({ onSuccess }: { onSuccess?: () => void }) {
  const btnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          const idToken = response?.credential;
          if (!idToken) return;
          try {
            await apiRequest('POST', '/api/auth/google', { idToken });
            await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
            onSuccess?.();
          } catch (e) {
            // ignore here; page can show toast
          }
        },
      });
      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, { theme: 'outline', size: 'large', width: 320 });
      }
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [onSuccess]);

  return <div ref={btnRef} />;
}
