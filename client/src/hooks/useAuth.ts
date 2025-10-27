import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    // Treat 401 as null instead of throwing to avoid error states
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchInterval: 5000, // keep balance updated in real-time
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
