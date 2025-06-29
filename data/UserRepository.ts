import { supabase } from './SupabaseClient';
import type { User } from '../types/database';

export class UserRepository {
  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // User not found
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user by username
   */
  async getByUsername(username: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // User not found
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new user profile
   */
  async create(userData: {
    id: string;
    username: string;
    password?: string;
  }): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: userData.id,
        username: userData.username,
        password: userData.password
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return data;
  }

  /**
   * Update user profile
   */
  async update(id: string, updates: Partial<Pick<User, 'username' | 'password'>>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete user profile
   */
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    return true;
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    let query = supabase
      .from('users')
      .select('id')
      .eq('username', username);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query.single();

    if (error && error.code === 'PGRST116') {
      return true; // Username not found, so it's available
    }

    if (error) {
      throw new Error(`Failed to check username availability: ${error.message}`);
    }

    return !data; // If data exists, username is taken
  }

  /**
   * Search users by username
   */
  async searchByUsername(query: string, limit: number = 20): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', `%${query}%`)
      .order('username')
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search users: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get user stats (document counts, etc.)
   */
  async getUserStats(userId: string): Promise<{
    total_docs: number;
    public_docs: number;
    private_docs: number;
    total_stars: number;
    total_views: number;
    total_downloads: number;
  }> {
    const { data, error } = await supabase
      .from('claude_docs')
      .select('is_public, stars, views, downloads')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch user stats: ${error.message}`);
    }

    const docs = data || [];
    
    return {
      total_docs: docs.length,
      public_docs: docs.filter(doc => doc.is_public).length,
      private_docs: docs.filter(doc => !doc.is_public).length,
      total_stars: docs.reduce((sum, doc) => sum + (doc.stars || 0), 0),
      total_views: docs.reduce((sum, doc) => sum + (doc.views || 0), 0),
      total_downloads: docs.reduce((sum, doc) => sum + (doc.downloads || 0), 0)
    };
  }

  /**
   * Get top contributors (users with most public documents)
   */
  async getTopContributors(limit: number = 10): Promise<Array<User & { doc_count: number }>> {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        claude_docs!inner(id)
      `)
      .eq('claude_docs.is_public', true)
      .order('claude_docs(count)', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch top contributors: ${error.message}`);
    }

    return (data || []).map(user => ({
      ...user,
      doc_count: user.claude_docs?.length || 0
    }));
  }

  /**
   * Find or create user from auth user
   */
  async findOrCreateFromAuth(authUser: {
    id: string;
    user_metadata?: {
      user_name?: string;
      username?: string;
      full_name?: string;
    };
  }): Promise<User> {
    // Try to find existing user
    let user = await this.getById(authUser.id);
    
    if (!user) {
      // Generate username from metadata or fallback
      const username = 
        authUser.user_metadata?.user_name ||
        authUser.user_metadata?.username ||
        authUser.user_metadata?.full_name ||
        `user_${authUser.id.slice(0, 8)}`;

      // Ensure username is unique
      let finalUsername = username;
      let counter = 1;
      
      while (!(await this.isUsernameAvailable(finalUsername))) {
        finalUsername = `${username}_${counter}`;
        counter++;
      }

      // Create new user
      user = await this.create({
        id: authUser.id,
        username: finalUsername
      });
    }
    
    return user;
  }

  /**
   * Get recent activity for a user (recent documents)
   */
  async getRecentActivity(userId: string, limit: number = 10): Promise<Array<{
    id: string;
    title: string;
    created_at: string;
    action: 'created' | 'updated';
  }>> {
    const { data, error } = await supabase
      .from('claude_docs')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch recent activity: ${error.message}`);
    }

    return (data || []).map(doc => ({
      id: doc.id,
      title: doc.title,
      created_at: doc.updated_at,
      action: (doc.created_at === doc.updated_at ? 'created' : 'updated') as 'created' | 'updated'
    }));
  }
}