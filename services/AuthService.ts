import { supabase, getCurrentUser, getCurrentSession } from '../data/SupabaseClient';
import { UserRepository } from '../data';
import type { User } from '../types/database';
import type { AuthError, Session, User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export class AuthService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  /**
   * Sign in with GitHub OAuth
   */
  async signInWithGithub(redirectTo?: string): Promise<{ error?: AuthError }> {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: redirectTo || window.location.origin
      }
    });

    if (error) {
      console.error('GitHub sign-in error:', error);
      return { error };
    }

    return { error: undefined };
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<{ error?: AuthError }> {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Sign-out error:', error);
      return { error };
    }

    return { error: undefined };
  }

  /**
   * Get current user session
   */
  async getCurrentSession(): Promise<Session | null> {
    return await getCurrentSession();
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<SupabaseUser | null> {
    return await getCurrentUser();
  }

  /**
   * Get current user profile
   */
  async getCurrentUserProfile(): Promise<User | null> {
    const authUser = await getCurrentUser();
    
    if (!authUser) {
      return null;
    }

    return await this.userRepo.getById(authUser.id);
  }

  /**
   * Create or update user profile from auth user
   */
  async syncUserProfile(authUser: SupabaseUser): Promise<User> {
    return await this.userRepo.findOrCreateFromAuth({
      id: authUser.id,
      email: authUser.email,
      user_metadata: authUser.user_metadata
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: {
    username?: string;
    avatar_url?: string;
    email?: string;
  }): Promise<User> {
    const authUser = await getCurrentUser();
    
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    // Validate username if provided
    if (updates.username) {
      await this.validateUsername(updates.username, authUser.id);
    }

    return await this.userRepo.update(authUser.id, updates);
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    if (!this.isValidUsername(username)) {
      return false;
    }

    return await this.userRepo.isUsernameAvailable(username, excludeUserId);
  }

  /**
   * Generate a unique username suggestion
   */
  async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = this.sanitizeUsername(baseUsername);
    let counter = 1;
    
    while (!(await this.isUsernameAvailable(username))) {
      username = `${this.sanitizeUsername(baseUsername)}_${counter}`;
      counter++;
    }
    
    return username;
  }

  /**
   * Validate and sanitize username
   */
  private async validateUsername(username: string, excludeUserId?: string): Promise<void> {
    if (!this.isValidUsername(username)) {
      throw new Error('Username must be 3-30 characters long and contain only letters, numbers, underscores, and hyphens');
    }

    const isAvailable = await this.isUsernameAvailable(username, excludeUserId);
    if (!isAvailable) {
      throw new Error('Username is already taken');
    }
  }

  /**
   * Check if username format is valid
   */
  private isValidUsername(username: string): boolean {
    if (!username || username.length < 3 || username.length > 30) {
      return false;
    }

    // Must contain only letters, numbers, underscores, and hyphens
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return false;
    }

    // Cannot start or end with underscore or hyphen
    if (username.startsWith('_') || username.startsWith('-') || 
        username.endsWith('_') || username.endsWith('-')) {
      return false;
    }

    // Cannot have consecutive special characters
    if (username.includes('__') || username.includes('--') || 
        username.includes('_-') || username.includes('-_')) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize username by removing invalid characters
   */
  private sanitizeUsername(username: string): string {
    return username
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_-]/g, '') // Remove invalid characters
      .replace(/^[_-]+|[_-]+$/g, '') // Remove leading/trailing special chars
      .replace(/[_-]{2,}/g, '_') // Replace consecutive special chars with single underscore
      .slice(0, 30); // Limit length
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId?: string): Promise<{
    total_docs: number;
    public_docs: number;
    private_docs: number;
    total_stars: number;
    total_views: number;
    total_downloads: number;
  }> {
    const targetUserId = userId || (await getCurrentUser())?.id;
    
    if (!targetUserId) {
      throw new Error('User not found');
    }

    return await this.userRepo.getUserStats(targetUserId);
  }

  /**
   * Delete user account and all associated data
   */
  async deleteAccount(): Promise<{ error?: AuthError }> {
    const authUser = await getCurrentUser();
    
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    // Delete user profile (cascading deletes will handle associated data)
    await this.userRepo.delete(authUser.id);

    // Sign out user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out after account deletion:', error);
      return { error };
    }

    return { error: undefined };
  }

  /**
   * Refresh current session
   */
  async refreshSession(): Promise<{ session: Session | null; error?: AuthError }> {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Session refresh error:', error);
      return { session: null, error };
    }

    return { session: data.session, error: undefined };
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await getCurrentSession();
    return !!session;
  }

  /**
   * Get user role/permissions (if implementing role-based access)
   */
  async getUserRole(): Promise<'user' | 'admin' | null> {
    const authUser = await getCurrentUser();
    
    if (!authUser) {
      return null;
    }

    // For now, all users are 'user' role
    // This can be extended to check user metadata or a separate roles table
    return 'user';
  }
}