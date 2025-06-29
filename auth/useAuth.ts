import { useContext } from 'react';
import { AuthProvider } from './AuthProvider';

// Re-export the useAuth hook from AuthProvider for convenience
export { useAuth, RequireAuth, AuthStatus } from './AuthProvider';

// Additional auth-related hooks can be added here

/**
 * Hook to check if user is authenticated
 */
export const useIsAuthenticated = (): boolean => {
  const { user, loading } = useAuth();
  return !loading && !!user;
};

/**
 * Hook to get current user ID
 */
export const useUserId = (): string | null => {
  const { user } = useAuth();
  return user?.id || null;
};

/**
 * Hook to get current username
 */
export const useUsername = (): string | null => {
  const { user } = useAuth();
  return user?.username || null;
};

/**
 * Hook to check if user owns a resource
 */
export const useIsOwner = (resourceUserId?: string): boolean => {
  const { user } = useAuth();
  return !!user && !!resourceUserId && user.id === resourceUserId;
};