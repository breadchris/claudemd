import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthService } from '../services';
import type { AuthState } from '../services';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '../types/database';

interface AuthContextType extends AuthState {
  signInWithGithub: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { username?: string; password?: string }) => Promise<User>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  generateUniqueUsername: (baseUsername: string) => Promise<string>;
  getUserStats: () => Promise<{
    total_docs: number;
    public_docs: number;
    private_docs: number;
    total_stars: number;
    total_views: number;
    total_downloads: number;
  }>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null
  });

  const authService = new AuthService();

  useEffect(() => {
    // Initialize auth state
    initializeAuth();

    // Fallback timeout to prevent infinite loading
    const authTimeout = setTimeout(() => {
      console.warn('Auth initialization timeout - forcing loading=false');
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: prev.error || 'Authentication initialization timeout'
      }));
    }, 10000); // 10 second timeout

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        
        // Clear timeout since auth state is responding
        clearTimeout(authTimeout);
        
        if (session) {
          await handleAuthSession(session);
        } else {
          setAuthState(prev => ({
            ...prev,
            user: null,
            session: null,
            loading: false,
            error: null
          }));
        }
      }
    );

    return () => {
      clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const clearAuthStorage = () => {
    try {
      // Clear Supabase auth storage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          sessionStorage.removeItem(key);
        }
      });
      
      console.log('Cleared potentially corrupted auth storage');
    } catch (error) {
      console.error('Failed to clear auth storage:', error);
    }
  };

  const initializeAuth = async () => {
    try {
      console.log('🔄 Auth: Initializing authentication...');
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const session = await authService.getCurrentSession();
      console.log('🔍 Auth: Retrieved session:', session ? 'Found' : 'None');
      
      if (session) {
        await handleAuthSession(session);
      } else {
        console.log('✅ Auth: No session - setting unauthenticated state');
        setAuthState(prev => ({
          ...prev,
          user: null,
          session: null,
          loading: false,
          error: null
        }));
      }
    } catch (error) {
      console.error('❌ Auth: Failed to initialize:', error);
      
      // Clear potentially corrupted storage on auth failure
      clearAuthStorage();
      
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Authentication error'
      }));
    }
  };

  const handleAuthSession = async (session: Session) => {
    try {
      console.log('👤 Auth: Handling session for user:', session.user.email);
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      // Get or create user profile
      const userProfile = await authService.syncUserProfile(session.user);
      console.log('✅ Auth: User profile synced:', userProfile.username);
      
      setAuthState(prev => ({
        ...prev,
        user: userProfile,
        session,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('❌ Auth: Failed to handle session:', error);
      
      // On session handling failure, clear storage and reset auth
      clearAuthStorage();
      
      setAuthState(prev => ({
        ...prev,
        user: null,
        session: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load user profile'
      }));
    }
  };

  const signInWithGithub = async (redirectTo?: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const { error } = await authService.signInWithGithub(redirectTo);
      
      if (error) {
        throw error;
      }
      
      // Don't set loading to false here - the auth state change will handle it
    } catch (error) {
      console.error('GitHub sign-in failed:', error);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign-in failed'
      }));
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const { error } = await authService.signOut();
      
      if (error) {
        throw error;
      }
      
      // Auth state change will handle clearing the state
    } catch (error) {
      console.error('Sign-out failed:', error);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign-out failed'
      }));
      throw error;
    }
  };

  const updateProfile = async (updates: { username?: string; password?: string }): Promise<User> => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const updatedUser = await authService.updateProfile(updates);
      
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
        loading: false,
        error: null
      }));
      
      return updatedUser;
    } catch (error) {
      console.error('Profile update failed:', error);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Profile update failed'
      }));
      throw error;
    }
  };

  const isUsernameAvailable = async (username: string): Promise<boolean> => {
    return await authService.isUsernameAvailable(username, authState.user?.id);
  };

  const generateUniqueUsername = async (baseUsername: string): Promise<string> => {
    return await authService.generateUniqueUsername(baseUsername);
  };

  const getUserStats = async () => {
    return await authService.getUserStats();
  };

  const refreshAuth = async () => {
    await initializeAuth();
  };

  const contextValue: AuthContextType = {
    ...authState,
    signInWithGithub,
    signOut,
    updateProfile,
    isUsernameAvailable,
    generateUniqueUsername,
    getUserStats,
    refreshAuth
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Higher-order component for protected routes
interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  fallback = <div>Please sign in to access this page.</div> 
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Component for showing auth status
export const AuthStatus: React.FC = () => {
  const { user, loading, error, signInWithGithub, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
        <span className="text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Error: {error}
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
          {user.username?.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium">@{user.username}</span>
        <button
          onClick={signOut}
          className="text-xs text-gray-600 hover:text-gray-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signInWithGithub()}
      className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      Sign in with GitHub
    </button>
  );
};