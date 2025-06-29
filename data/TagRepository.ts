import { supabase } from './SupabaseClient';
import type { Tag } from '../types/database';

export class TagRepository {
  /**
   * Get all tags
   */
  async getAll(): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tags with usage count
   */
  async getTagsWithCount(): Promise<Array<Tag & { doc_count: number }>> {
    const { data, error } = await supabase
      .from('tags')
      .select(`
        *,
        claude_doc_tags(claude_doc_id)
      `)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch tags with count: ${error.message}`);
    }

    return (data || []).map(tag => ({
      ...tag,
      doc_count: tag.claude_doc_tags?.length || 0
    }));
  }

  /**
   * Get popular tags (most used)
   */
  async getPopularTags(limit: number = 20): Promise<Array<Tag & { doc_count: number }>> {
    const tagsWithCount = await this.getTagsWithCount();
    
    return tagsWithCount
      .sort((a, b) => b.doc_count - a.doc_count)
      .slice(0, limit);
  }

  /**
   * Search tags by name
   */
  async searchByName(query: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(50);

    if (error) {
      throw new Error(`Failed to search tags: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tag by name
   */
  async getByName(name: string): Promise<Tag | null> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Tag not found
      }
      throw new Error(`Failed to fetch tag: ${error.message}`);
    }

    return data;
  }

  /**
   * Get tag by ID
   */
  async getById(id: string): Promise<Tag | null> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Tag not found
      }
      throw new Error(`Failed to fetch tag: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new tag
   */
  async create(name: string, userId: string, color?: string): Promise<Tag> {
    const { data, error } = await supabase
      .from('tags')
      .insert({
        name: name.toLowerCase().trim(),
        color,
        user_id: userId
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create tag: ${error.message}`);
    }

    return data;
  }

  /**
   * Find or create a tag by name
   */
  async findOrCreate(name: string, userId: string, color?: string): Promise<Tag> {
    const normalizedName = name.toLowerCase().trim();
    
    // Try to find existing tag
    let tag = await this.getByName(normalizedName);
    
    if (!tag) {
      // Create new tag if it doesn't exist
      tag = await this.create(normalizedName, userId, color);
    }
    
    return tag;
  }

  /**
   * Update a tag
   */
  async update(id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>, userId: string): Promise<Tag> {
    const { data, error } = await supabase
      .from('tags')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId) // Only allow updates by the creator
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update tag: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a tag (only if not used by any documents)
   */
  async delete(id: string, userId: string): Promise<boolean> {
    // Check if tag is being used
    const { count, error: countError } = await supabase
      .from('claude_doc_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', id);

    if (countError) {
      throw new Error(`Failed to check tag usage: ${countError.message}`);
    }

    if (count && count > 0) {
      throw new Error('Cannot delete tag that is being used by documents');
    }

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Only allow deletion by the creator

    if (error) {
      throw new Error(`Failed to delete tag: ${error.message}`);
    }

    return true;
  }

  /**
   * Get tags for a specific document
   */
  async getDocumentTags(docId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('claude_doc_tags')
      .select(`
        tags(*)
      `)
      .eq('claude_doc_id', docId);

    if (error) {
      throw new Error(`Failed to fetch document tags: ${error.message}`);
    }

    return (data || []).map(item => item.tags).filter(Boolean);
  }

  /**
   * Get documents for a specific tag
   */
  async getTagDocuments(tagId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('claude_doc_tags')
      .select('claude_doc_id')
      .eq('tag_id', tagId);

    if (error) {
      throw new Error(`Failed to fetch tag documents: ${error.message}`);
    }

    return (data || []).map(item => item.claude_doc_id);
  }

  /**
   * Get tags created by a user
   */
  async getUserTags(userId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch user tags: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Bulk find or create tags
   */
  async bulkFindOrCreate(tagNames: string[], userId: string): Promise<Tag[]> {
    const results: Tag[] = [];
    
    for (const name of tagNames) {
      if (name.trim()) {
        try {
          const tag = await this.findOrCreate(name, userId);
          results.push(tag);
        } catch (error) {
          console.error(`Failed to create tag ${name}:`, error);
        }
      }
    }
    
    return results;
  }
}