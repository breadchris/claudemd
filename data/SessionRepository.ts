import { supabase } from './SupabaseClient';
import type { ClaudeSession, ClaudeSessionInsert, ClaudeSessionUpdate } from '../types/session';

export interface SessionSummary {
  id: string;
  session_id: string;
  user_id?: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
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
   * Get all sessions for a user with pagination and filtering (optimized for list view)
   */
  async getSessions(params: SessionSearchParams = {}): Promise<SessionListResponse> {
    const {
      query,
      page = 1,
      per_page = 20,
      sort_by = 'created_at',
      user_id
    } = params;

    // Use selective field fetching - exclude heavy JSONB messages field
    let supabaseQuery = supabase
      .from('claude_sessions')
      .select('id, session_id, user_id, title, message_count, created_at, updated_at', { count: 'exact' });

    // Filter by user if provided
    if (user_id) {
      supabaseQuery = supabaseQuery.eq('user_id', user_id);
    }

    // Optimized text search using proper JSONB operators
    if (query) {
      // Search in title (fast) OR use JSONB containment for messages (with GIN index)
      supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,messages.@@.${query}`);
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

    const sessions: SessionSummary[] = data || [];
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
   * Get sessions by user ID (optimized with pagination)
   */
  async getByUserId(userId: string, limit: number = 50): Promise<SessionSummary[]> {
    const { data, error } = await supabase
      .from('claude_sessions')
      .select('id, session_id, user_id, title, message_count, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch user sessions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get the first user message from a session (for preview)
   */
  getFirstUserMessage(session: ClaudeSession | SessionSummary): string {
    // Type guard to check if this is a full ClaudeSession with messages
    if ('messages' in session && Array.isArray(session.messages)) {
      const userMessage = session.messages.find(msg => msg.type === 'user' || msg.type === 'human');
      if (userMessage) {
        // Try content first, then summary, then fall back to title
        return userMessage.content || userMessage.summary || session.title || 'No message preview available';
      }
    }
    // For SessionSummary objects, we only have the title
    return session.title || 'No message preview available';
  }

  /**
   * Get recent sessions for a user (optimized)
   */
  async getRecentSessions(userId?: string, limit: number = 10): Promise<SessionSummary[]> {
    let query = supabase
      .from('claude_sessions')
      .select('id, session_id, user_id, title, message_count, created_at, updated_at')
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
   * Search sessions by content (optimized with proper JSONB operators)
   */
  async searchSessions(query: string, userId?: string, limit: number = 50): Promise<SessionSummary[]> {
    let supabaseQuery = supabase
      .from('claude_sessions')
      .select('id, session_id, user_id, title, message_count, created_at, updated_at')
      .or(`title.ilike.%${query}%,messages.@@.${query}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      supabaseQuery = supabaseQuery.eq('user_id', userId);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      throw new Error(`Failed to search sessions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get session statistics for dashboard/analytics
   */
  async getSessionStats(userId?: string): Promise<{
    total_sessions: number;
    total_messages: number;
    avg_messages_per_session: number;
    recent_activity_count: number;
  }> {
    let query = supabase
      .from('claude_sessions')
      .select('message_count, created_at');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch session stats: ${error.message}`);
    }

    const sessions = data || [];
    const total_sessions = sessions.length;
    const total_messages = sessions.reduce((sum, s) => sum + (s.message_count || 0), 0);
    const avg_messages_per_session = total_sessions > 0 ? total_messages / total_sessions : 0;
    
    // Count sessions created in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recent_activity_count = sessions.filter(s => s.created_at > weekAgo).length;

    return {
      total_sessions,
      total_messages,
      avg_messages_per_session: Math.round(avg_messages_per_session * 100) / 100,
      recent_activity_count
    };
  }
}