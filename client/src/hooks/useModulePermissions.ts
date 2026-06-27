/**
 * useModulePermissions
 *
 * Returns the set of module keys the current user is allowed to access.
 * Admins always get all modules. Other roles get what the operator has configured.
 *
 * Usage:
 *   const { canAccess, isLoading } = useModulePermissions();
 *   if (!canAccess("market_scan")) return <AccessDenied />;
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function useModulePermissions() {
  const { user, isAuthenticated } = useAuth();

  const { data, isLoading } = trpc.rolePermissions.getMyPermissions.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 30_000, // 30s — permissions change rarely
    refetchOnWindowFocus: false,
  });

  const allowedModules = new Set<string>(data?.allowedModules ?? []);

  // Admins always have full access — belt-and-suspenders check on the client
  const isAdmin = user?.role === "admin";

  function canAccess(moduleKey: string): boolean {
    if (!isAuthenticated) return false;
    if (isAdmin) return true;
    if (isLoading) return true; // optimistic — don't flash access denied during load
    return allowedModules.has(moduleKey);
  }

  return { canAccess, allowedModules, isLoading };
}
