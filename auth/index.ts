// Authentication Layer - Export all auth components and hooks
export { AuthProvider, useAuth, RequireAuth, AuthStatus } from './AuthProvider';
export { useIsAuthenticated, useUserId, useUsername, useIsOwner } from './useAuth';