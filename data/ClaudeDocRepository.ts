import { supabase } from './SupabaseClient';
import type { 
  ClaudeDoc, 
  ClaudeDocResponse, 
  ClaudeDocListResponse, 
  CreateClaudeDocRequest, 
  UpdateClaudeDocRequest,
  SearchParams 
} from '../types/database';

export class ClaudeDocRepository {
  /**
   * Get all public documents with pagination and filtering
   */
  async getPublicDocs(params: SearchParams = {}): Promise<ClaudeDocListResponse> {
    const {
      query,
      tags = [],
      page = 1,
      per_page = 20,
      sort_by = 'created_at'
    } = params;

    let supabaseQuery = supabase
      .from('claude_docs')
      .select(`
        *,
        users!inner(username),
        claude_doc_tags(tags(name))
      `)
      .eq('is_public', true);

    // Text search
    if (query) {
      supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }

    // Tag filtering - this requires a more complex query
    if (tags.length > 0) {
      supabaseQuery = supabaseQuery.in('claude_doc_tags.tags.name', tags);
    }

    // Sorting
    const sortOrder = sort_by === 'created_at' ? 'desc' : 'desc';
    supabaseQuery = supabaseQuery.order(sort_by, { ascending: false });

    // Pagination
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;
    supabaseQuery = supabaseQuery.range(from, to);

    const { data, error, count } = await supabaseQuery;

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    // Transform the data to match the expected response format
    const docs: ClaudeDocResponse[] = (data || []).map(doc => this.transformToResponse(doc));

    const total = count || 0;
    const total_pages = Math.ceil(total / per_page);

    return {
      docs,
      total,
      page,
      per_page,
      total_pages
    };
  }

  /**
   * Get a single document by ID
   */
  async getById(id: string, userId?: string): Promise<ClaudeDocResponse | null> {
    const { data, error } = await supabase
      .from('claude_docs')
      .select(`
        *,
        users!inner(username),
        claude_doc_tags(tags(name)),
        claude_doc_stars(user_id)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Document not found
      }
      throw new Error(`Failed to fetch document: ${error.message}`);
    }

    // Check access permissions
    if (!data.is_public && data.user_id !== userId) {
      return null;
    }

    return this.transformToResponse(data, userId);
  }

  /**
   * Create a new document
   */
  async create(doc: CreateClaudeDocRequest, userId: string): Promise<ClaudeDocResponse> {
    const { data, error } = await supabase
      .from('claude_docs')
      .insert({
        id: crypto.randomUUID(),
        title: doc.title,
        description: doc.description,
        content: doc.content,
        user_id: userId,
        is_public: doc.is_public || false
      })
      .select(`
        *,
        users!inner(username)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }

    // Handle tags separately
    if (doc.tag_names.length > 0) {
      await this.assignTags(data.id, doc.tag_names, userId);
    }

    return this.transformToResponse(data, userId);
  }

  /**
   * Update an existing document
   */
  async update(id: string, doc: UpdateClaudeDocRequest, userId: string): Promise<ClaudeDocResponse> {
    // First check if user owns the document
    const existing = await this.getById(id, userId);
    if (!existing || existing.user_id !== userId) {
      throw new Error('Document not found or access denied');
    }

    const { data, error } = await supabase
      .from('claude_docs')
      .update({
        title: doc.title,
        description: doc.description,
        content: doc.content,
        is_public: doc.is_public
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        users!inner(username)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }

    // Update tags
    await this.assignTags(id, doc.tag_names, userId);

    return this.transformToResponse(data, userId);
  }

  /**
   * Delete a document
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('claude_docs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }

    return true;
  }

  /**
   * Get documents by user
   */
  async getByUserId(userId: string): Promise<ClaudeDocResponse[]> {
    const { data, error } = await supabase
      .from('claude_docs')
      .select(`
        *,
        users!inner(username),
        claude_doc_tags(tags(name)),
        claude_doc_stars(user_id)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user documents: ${error.message}`);
    }

    return (data || []).map(doc => this.transformToResponse(doc, userId));
  }

  /**
   * Increment view count
   */
  async incrementViews(id: string): Promise<void> {
    const { error } = await supabase.rpc('increment_views', { doc_id: id });
    
    if (error) {
      // Fallback to manual increment if RPC doesn't exist
      const { data: currentDoc } = await supabase
        .from('claude_docs')
        .select('views')
        .eq('id', id)
        .single();
      
      const { error: updateError } = await supabase
        .from('claude_docs')
        .update({ views: (currentDoc?.views || 0) + 1 })
        .eq('id', id);
      
      if (updateError) {
        console.error('Failed to increment views:', updateError);
      }
    }
  }

  /**
   * Increment download count
   */
  async incrementDownloads(id: string): Promise<void> {
    const { error } = await supabase.rpc('increment_downloads', { doc_id: id });
    
    if (error) {
      // Fallback to manual increment if RPC doesn't exist
      const { data: currentDoc } = await supabase
        .from('claude_docs')
        .select('downloads')
        .eq('id', id)
        .single();
      
      const { error: updateError } = await supabase
        .from('claude_docs')
        .update({ downloads: (currentDoc?.downloads || 0) + 1 })
        .eq('id', id);
      
      if (updateError) {
        console.error('Failed to increment downloads:', updateError);
      }
    }
  }

  /**
   * Toggle document visibility
   */
  async toggleVisibility(id: string, userId: string): Promise<boolean> {
    // Get current document
    const { data: currentDoc, error: fetchError } = await supabase
      .from('claude_docs')
      .select('is_public')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch document: ${fetchError.message}`);
    }

    const newVisibility = !currentDoc.is_public;

    const { error } = await supabase
      .from('claude_docs')
      .update({ 
        is_public: newVisibility
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to update visibility: ${error.message}`);
    }

    return newVisibility;
  }

  /**
   * Assign tags to a document
   */
  private async assignTags(docId: string, tagNames: string[], userId: string): Promise<void> {
    // Remove existing tags
    await supabase
      .from('claude_doc_tags')
      .delete()
      .eq('claude_doc_id', docId);

    // Add new tags
    for (const tagName of tagNames) {
      if (!tagName.trim()) continue;

      // Find or create tag
      let { data: tag, error } = await supabase
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .single();

      if (error && error.code === 'PGRST116') {
        // Tag doesn't exist, create it
        const { data: newTag, error: createError } = await supabase
          .from('tags')
          .insert({
            id: crypto.randomUUID(),
            name: tagName,
            user_id: userId
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`Failed to create tag ${tagName}:`, createError);
          continue;
        }
        tag = newTag;
      } else if (error) {
        console.error(`Failed to find tag ${tagName}:`, error);
        continue;
      }

      // Create association
      await supabase
        .from('claude_doc_tags')
        .insert({
          claude_doc_id: docId,
          tag_id: tag.id
        });
    }
  }

  /**
   * Transform database result to response format
   */
  private transformToResponse(data: any, currentUserId?: string): ClaudeDocResponse {
    const tagNames = data.claude_doc_tags?.map((cdt: any) => cdt.tags?.name).filter(Boolean) || [];
    const isStarred = currentUserId ? 
      data.claude_doc_stars?.some((star: any) => star.user_id === currentUserId) || false : 
      false;

    return {
      id: data.id,
      created_at: data.created_at,
      updated_at: data.updated_at,
      title: data.title,
      description: data.description,
      content: data.content,
      user_id: data.user_id,
      is_public: data.is_public,
      downloads: data.downloads,
      stars: data.stars || 0,
      views: data.views || 0,
      author_name: data.users?.username || 'Unknown',
      author_username: data.users?.username || 'Unknown',
      is_starred: isStarred,
      tag_names: tagNames
    };
  }
}