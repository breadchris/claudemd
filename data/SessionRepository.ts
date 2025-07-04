import { supabase } from './SupabaseClient';
import type { ClaudeSession, ClaudeSessionInsert, ClaudeSessionUpdate } from '../types/session';

export interface SessionListResponse {
  sessions: ClaudeSession[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SessionSearchParams {
  query?: string;
  page?: number;
  per_page?: number;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  user_id?: string;
}

export class SessionRepository {
  /**
   * Get all sessions for a user with pagination and filtering
   */
  async getSessions(params: SessionSearchParams = {}): Promise<SessionListResponse> {
    const {
      query,
      page = 1,
      per_page = 20,
      sort_by = 'created_at',
      user_id
    } = params;

    let supabaseQuery = supabase
      .from('claude_sessions')
      .select('*', { count: 'exact' });

    // Filter by user if provided
    if (user_id) {
      supabaseQuery = supabaseQuery.eq('user_id', user_id);
    }

    // Text search in title and messages
    if (query) {
      supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,messages.cs.%${query}%`);
    }

    // Sorting
    supabaseQuery = supabaseQuery.order(sort_by, { ascending: false });

    // Pagination
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;
    supabaseQuery = supabaseQuery.range(from, to);

    const { data, error, count } = await supabaseQuery;

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    const sessions: ClaudeSession[] = data || [];
    const total = count || 0;
    const total_pages = Math.ceil(total / per_page);

    return {
      sessions,
      total,
      page,
      per_page,
      total_pages
    };
  }

  /**
   * Get a single session by ID
   */
  async getById(id: string): Promise<ClaudeSession | null> {
    const { data, error } = await supabase
      .from('claude_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Session not found
      }
      throw new Error(`Failed to fetch session: ${error.message}`);
    }

    return data;
  }

  /**
   * Get a single session by session_id
   */
  async getBySessionId(sessionId: string): Promise<ClaudeSession | null> {
    const { data, error } = await supabase
      .from('claude_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Session not found
      }
      throw new Error(`Failed to fetch session: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new session
   */
  async create(session: ClaudeSessionInsert): Promise<ClaudeSession> {
    const { data, error } = await supabase
      .from('claude_sessions')
      .insert(session)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing session
   */
  async update(id: string, session: ClaudeSessionUpdate): Promise<ClaudeSession> {
    const { data, error } = await supabase
      .from('claude_sessions')
      .update(session)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a session
   */
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('claude_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }

    return true;
  }

  /**
   * Get sessions by user ID
   */
  async getByUserId(userId: string): Promise<ClaudeSession[]> {
    const { data, error } = await supabase
      .from('claude_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user sessions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get the first user message from a session (for preview)
   */
  getFirstUserMessage(session: ClaudeSession): string {
    const userMessage = session.messages.find(msg => msg.type === 'user' || msg.type === 'human');
    return userMessage?.summary || session.title || 'No message preview available';
  }

  /**
   * Get recent sessions for a user
   */
  async getRecentSessions(userId?: string, limit: number = 10): Promise<ClaudeSession[]> {
    let query = supabase
      .from('claude_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch recent sessions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Search sessions by content
   */
  async searchSessions(query: string, userId?: string): Promise<ClaudeSession[]> {
    let supabaseQuery = supabase
      .from('claude_sessions')
      .select('*')
      .or(`title.ilike.%${query}%,messages.cs.%${query}%`)
      .order('created_at', { ascending: false });

    if (userId) {
      supabaseQuery = supabaseQuery.eq('user_id', userId);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      throw new Error(`Failed to search sessions: ${error.message}`);
    }

    return data || [];
  }
}