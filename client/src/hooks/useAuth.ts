import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchInterval: 5000, // Refetch every 5 seconds to keep totalMined and balance updated in real-time
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale to ensure fresh updates
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
