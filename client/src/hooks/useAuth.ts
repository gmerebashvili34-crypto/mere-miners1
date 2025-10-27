import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    // Treat 401 as null instead of throwing to avoid error states
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    // Avoid aggressive periodic refetches that can cause auth flicker on some hosts
    refetchInterval: false,
    refetchOnWindowFocus: false,
    // Cache until an explicit invalidate, SignIn/SignUp invalidate on success
    staleTime: Infinity,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
