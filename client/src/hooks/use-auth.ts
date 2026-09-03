import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PublicUser } from "@shared/schema";

/**
 * Current signed-in user, or null.
 *
 * The server is the only authority here: the client never stores identity, so
 * signing out or a session expiring is reflected on the next fetch rather than
 * leaving a stale user in local state.
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ user: PublicUser | null }>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/me/saved"] });
  };

  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: invalidate,
  });

  return {
    user: data?.user ?? null,
    isLoading,
    logout: () => logout.mutate(),
    refresh: invalidate,
  };
}
