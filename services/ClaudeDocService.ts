import { ClaudeDocRepository, StarRepository, TagRepository } from '../data';
import type { 
  ClaudeDocResponse, 
  ClaudeDocListResponse, 
  CreateClaudeDocRequest, 
  UpdateClaudeDocRequest,
  SearchParams 
} from '../types/database';

export class ClaudeDocService {
  private docRepo: ClaudeDocRepository;
  private starRepo: StarRepository;
  private tagRepo: TagRepository;

  constructor() {
    this.docRepo = new ClaudeDocRepository();
    this.starRepo = new StarRepository();
    this.tagRepo = new TagRepository();
  }

  /**
   * Get public documents with enhanced search and filtering
   */
  async getPublicDocs(params: SearchParams = {}): Promise<ClaudeDocListResponse> {
    // Validate and sanitize parameters
    const sanitizedParams = this.sanitizeSearchParams(params);
    
    return await this.docRepo.getPublicDocs(sanitizedParams);
  }

  /**
   * Get a document by ID with view tracking
   */
  async getDocument(id: string, userId?: string, incrementView: boolean = true): Promise<ClaudeDocResponse | null> {
    if (!this.isValidUUID(id)) {
      throw new Error('Invalid document ID format');
    }

    const doc = await this.docRepo.getById(id, userId);
    
    if (doc && incrementView) {
      // Increment view count asynchronously (don't block the response)
      this.docRepo.incrementViews(id).catch(error => {
        console.error('Failed to increment view count:', error);
      });
    }

    return doc;
  }

  /**
   * Create a new document with validation
   */
  async createDocument(doc: CreateClaudeDocRequest, userId: string): Promise<ClaudeDocResponse> {
    if (!userId) {
      throw new Error('User must be authenticated to create documents');
    }

    // Validate document data
    this.validateDocumentData(doc);

    // Sanitize tag names
    const sanitizedDoc = {
      ...doc,
      tag_names: this.sanitizeTagNames(doc.tag_names),
      title: doc.title.trim(),
      description: doc.description?.trim() || '',
      content: doc.content.trim()
    };

    return await this.docRepo.create(sanitizedDoc, userId);
  }

  /**
   * Update a document with validation
   */
  async updateDocument(id: string, doc: UpdateClaudeDocRequest, userId: string): Promise<ClaudeDocResponse> {
    if (!userId) {
      throw new Error('User must be authenticated to update documents');
    }

    if (!this.isValidUUID(id)) {
      throw new Error('Invalid document ID format');
    }

    // Validate document data
    this.validateDocumentData(doc);

    // Sanitize tag names
    const sanitizedDoc = {
      ...doc,
      tag_names: this.sanitizeTagNames(doc.tag_names),
      title: doc.title.trim(),
      description: doc.description?.trim() || '',
      content: doc.content.trim()
    };

    return await this.docRepo.update(id, sanitizedDoc, userId);
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string, userId: string): Promise<boolean> {
    if (!userId) {
      throw new Error('User must be authenticated to delete documents');
    }

    if (!this.isValidUUID(id)) {
      throw new Error('Invalid document ID format');
    }

    return await this.docRepo.delete(id, userId);
  }

  /**
   * Toggle star status for a document
   */
  async toggleStar(docId: string, userId: string): Promise<{ starred: boolean; starCount: number }> {
    if (!userId) {
      throw new Error('User must be authenticated to star documents');
    }

    if (!this.isValidUUID(docId)) {
      throw new Error('Invalid document ID format');
    }

    const isStarred = await this.starRepo.toggleStar(docId, userId);
    const starCount = await this.starRepo.getStarCount(docId);

    return {
      starred: isStarred,
      starCount
    };
  }

  /**
   * Download a document (increment download count and return content)
   */
  async downloadDocument(id: string, userId?: string): Promise<{ content: string; filename: string }> {
    if (!this.isValidUUID(id)) {
      throw new Error('Invalid document ID format');
    }

    const doc = await this.docRepo.getById(id, userId);
    
    if (!doc) {
      throw new Error('Document not found or access denied');
    }

    // Increment download count asynchronously
    this.docRepo.incrementDownloads(id).catch(error => {
      console.error('Failed to increment download count:', error);
    });

    return {
      content: doc.content,
      filename: `${this.sanitizeFilename(doc.title)}.md`
    };
  }

  /**
   * Toggle document visibility
   */
  async toggleVisibility(id: string, userId: string): Promise<{ isPublic: boolean }> {
    if (!userId) {
      throw new Error('User must be authenticated to change document visibility');
    }

    if (!this.isValidUUID(id)) {
      throw new Error('Invalid document ID format');
    }

    const isPublic = await this.docRepo.toggleVisibility(id, userId);

    return { isPublic };
  }

  /**
   * Get user's documents
   */
  async getUserDocuments(userId: string): Promise<ClaudeDocResponse[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return await this.docRepo.getByUserId(userId);
  }

  /**
   * Search documents with advanced filtering
   */
  async searchDocuments(params: SearchParams): Promise<ClaudeDocListResponse> {
    const sanitizedParams = this.sanitizeSearchParams(params);
    
    return await this.docRepo.getPublicDocs(sanitizedParams);
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(docId: string): Promise<{
    views: number;
    downloads: number;
    stars: number;
    tagCount: number;
  }> {
    if (!this.isValidUUID(docId)) {
      throw new Error('Invalid document ID format');
    }

    const doc = await this.docRepo.getById(docId);
    
    if (!doc) {
      throw new Error('Document not found');
    }

    return {
      views: doc.views,
      downloads: doc.downloads,
      stars: doc.stars,
      tagCount: doc.tag_names.length
    };
  }

  /**
   * Get trending documents (most viewed/starred recently)
   */
  async getTrendingDocuments(limit: number = 10): Promise<ClaudeDocResponse[]> {
    const result = await this.docRepo.getPublicDocs({
      sort_by: 'views',
      per_page: limit,
      page: 1
    });

    return result.docs;
  }

  // Private helper methods

  private validateDocumentData(doc: CreateClaudeDocRequest | UpdateClaudeDocRequest): void {
    if (!doc.title || doc.title.trim().length === 0) {
      throw new Error('Document title is required');
    }

    if (doc.title.trim().length > 200) {
      throw new Error('Document title must be 200 characters or less');
    }

    if (!doc.content || doc.content.trim().length === 0) {
      throw new Error('Document content is required');
    }

    if (doc.content.length > 1000000) { // 1MB limit
      throw new Error('Document content is too large (max 1MB)');
    }

    if (doc.description && doc.description.length > 500) {
      throw new Error('Document description must be 500 characters or less');
    }

    if (doc.tag_names.length > 10) {
      throw new Error('Maximum of 10 tags allowed per document');
    }
  }

  private sanitizeSearchParams(params: SearchParams): SearchParams {
    return {
      query: params.query?.trim().slice(0, 100), // Limit query length
      tags: params.tags?.slice(0, 5), // Limit to 5 tags max
      page: Math.max(1, params.page || 1),
      per_page: Math.min(50, Math.max(1, params.per_page || 20)), // Limit between 1-50
      sort_by: ['created_at', 'stars', 'views', 'downloads'].includes(params.sort_by || '') 
        ? params.sort_by 
        : 'created_at'
    };
  }

  private sanitizeTagNames(tagNames: string[]): string[] {
    return tagNames
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length <= 50)
      .filter((tag, index, arr) => arr.indexOf(tag) === index) // Remove duplicates
      .slice(0, 10); // Limit to 10 tags
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .slice(0, 100); // Limit length
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}