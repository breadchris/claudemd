import { supabase } from './SupabaseClient';
import type { ClaudeDocStar } from '../types/database';

export class StarRepository {
  /**
   * Star a document
   */
  async starDocument(docId: string, userId: string): Promise<boolean> {
    // Check if already starred
    const { data: existingStar, error: checkError } = await supabase
      .from('claude_doc_stars')
      .select('id')
      .eq('claude_doc_id', docId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Failed to check star status: ${checkError.message}`);
    }

    if (existingStar) {
      return true; // Already starred
    }

    // Create new star
    const { error } = await supabase
      .from('claude_doc_stars')
      .insert({
        id: crypto.randomUUID(),
        claude_doc_id: docId,
        user_id: userId
      });

    if (error) {
      throw new Error(`Failed to star document: ${error.message}`);
    }

    return true;
  }

  /**
   * Unstar a document
   */
  async unstarDocument(docId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('claude_doc_stars')
      .delete()
      .eq('claude_doc_id', docId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to unstar document: ${error.message}`);
    }

    return true;
  }

  /**
   * Toggle star status for a document
   */
  async toggleStar(docId: string, userId: string): Promise<boolean> {
    // Check current star status
    const { data: existingStar, error: checkError } = await supabase
      .from('claude_doc_stars')
      .select('id')
      .eq('claude_doc_id', docId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Failed to check star status: ${checkError.message}`);
    }

    if (existingStar) {
      // Already starred, so unstar
      await this.unstarDocument(docId, userId);
      return false;
    } else {
      // Not starred, so star it
      await this.starDocument(docId, userId);
      return true;
    }
  }

  /**
   * Check if a document is starred by a user
   */
  async isStarred(docId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('claude_doc_stars')
      .select('id')
      .eq('claude_doc_id', docId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check star status: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Get all starred documents for a user
   */
  async getStarredDocuments(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('claude_doc_stars')
      .select('claude_doc_id')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch starred documents: ${error.message}`);
    }

    return (data || []).map(star => star.claude_doc_id);
  }

  /**
   * Get star count for a document
   */
  async getStarCount(docId: string): Promise<number> {
    const { count, error } = await supabase
      .from('claude_doc_stars')
      .select('*', { count: 'exact', head: true })
      .eq('claude_doc_id', docId);

    if (error) {
      throw new Error(`Failed to get star count: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Get users who starred a document
   */
  async getStarredByUsers(docId: string): Promise<Array<{ id: string; username: string }>> {
    const { data, error } = await supabase
      .from('claude_doc_stars')
      .select(`
        user_id,
        users!inner(username)
      `)
      .eq('claude_doc_id', docId);

    if (error) {
      throw new Error(`Failed to fetch starring users: ${error.message}`);
    }

    return (data || []).map(star => ({
      id: star.user_id,
      username: star.users.username
    }));
  }

  /**
   * Get star statistics for multiple documents
   */
  async getStarStats(docIds: string[], userId?: string): Promise<Record<string, { count: number; isStarred: boolean }>> {
    const { data, error } = await supabase
      .from('claude_doc_stars')
      .select('claude_doc_id, user_id')
      .in('claude_doc_id', docIds);

    if (error) {
      throw new Error(`Failed to fetch star stats: ${error.message}`);
    }

    const stats: Record<string, { count: number; isStarred: boolean }> = {};

    // Initialize stats for all documents
    docIds.forEach(docId => {
      stats[docId] = { count: 0, isStarred: false };
    });

    // Calculate stats from the data
    (data || []).forEach(star => {
      stats[star.claude_doc_id].count++;
      if (userId && star.user_id === userId) {
        stats[star.claude_doc_id].isStarred = true;
      }
    });

    return stats;
  }
}