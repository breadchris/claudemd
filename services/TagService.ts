import { TagRepository } from '../data';
import type { Tag } from '../types/database';

// Predefined developer tags
const PREDEFINED_TAGS = [
  // Languages
  'typescript', 'javascript', 'python', 'golang', 'rust', 'java', 'csharp', 'ruby', 'php',
  // Frameworks
  'react', 'vue', 'angular', 'nextjs', 'svelte', 'express', 'fastapi', 'django', 'rails', 'laravel',
  // Infrastructure
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ansible',
  // Databases
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  // Tools
  'git', 'vscode', 'intellij', 'postman', 'figma', 'slack',
  // APIs
  'rest', 'graphql', 'websocket', 'grpc', 'oauth', 'jwt',
  // Platforms
  'web', 'mobile', 'desktop', 'cli', 'api', 'microservices'
];

export class TagService {
  private tagRepo: TagRepository;

  constructor() {
    this.tagRepo = new TagRepository();
  }

  /**
   * Get all tags with usage statistics
   */
  async getAllTags(): Promise<Array<Tag & { doc_count: number }>> {
    return await this.tagRepo.getTagsWithCount();
  }

  /**
   * Get popular tags (most used)
   */
  async getPopularTags(limit: number = 20): Promise<Array<Tag & { doc_count: number }>> {
    return await this.tagRepo.getPopularTags(limit);
  }

  /**
   * Search tags by name with suggestions
   */
  async searchTags(query: string): Promise<Tag[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const sanitizedQuery = this.sanitizeTagName(query);
    
    if (sanitizedQuery.length < 2) {
      return [];
    }

    return await this.tagRepo.searchByName(sanitizedQuery);
  }

  /**
   * Get tag suggestions based on query
   */
  async getTagSuggestions(query: string): Promise<string[]> {
    const sanitizedQuery = this.sanitizeTagName(query).toLowerCase();
    
    if (sanitizedQuery.length === 0) {
      return PREDEFINED_TAGS.slice(0, 10);
    }

    // Find predefined tags that match the query
    const predefinedMatches = PREDEFINED_TAGS
      .filter(tag => tag.includes(sanitizedQuery))
      .slice(0, 5);

    // Find existing tags that match the query
    const existingTags = await this.searchTags(sanitizedQuery);
    const existingMatches = existingTags
      .map(tag => tag.name)
      .slice(0, 5);

    // Combine and deduplicate
    const allMatches = [...predefinedMatches, ...existingMatches];
    const uniqueMatches = Array.from(new Set(allMatches));

    return uniqueMatches.slice(0, 10);
  }

  /**
   * Get predefined tags for a specific category
   */
  getPredefinedTags(): string[] {
    return [...PREDEFINED_TAGS];
  }

  /**
   * Get tags by category
   */
  getTagsByCategory(): Record<string, string[]> {
    return {
      languages: [
        'typescript', 'javascript', 'python', 'golang', 'rust', 'java', 'csharp', 'ruby', 'php'
      ],
      frameworks: [
        'react', 'vue', 'angular', 'nextjs', 'svelte', 'express', 'fastapi', 'django', 'rails', 'laravel'
      ],
      infrastructure: [
        'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ansible'
      ],
      databases: [
        'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch'
      ],
      tools: [
        'git', 'vscode', 'intellij', 'postman', 'figma', 'slack'
      ],
      apis: [
        'rest', 'graphql', 'websocket', 'grpc', 'oauth', 'jwt'
      ],
      platforms: [
        'web', 'mobile', 'desktop', 'cli', 'api', 'microservices'
      ]
    };
  }

  /**
   * Validate and sanitize tag names
   */
  validateTagNames(tagNames: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const tagName of tagNames) {
      const sanitized = this.sanitizeTagName(tagName);
      
      if (this.isValidTagName(sanitized)) {
        valid.push(sanitized);
      } else {
        invalid.push(tagName);
      }
    }

    return { valid, invalid };
  }

  /**
   * Create or find tags from tag names
   */
  async processTagNames(tagNames: string[], userId: string): Promise<Tag[]> {
    const { valid } = this.validateTagNames(tagNames);
    
    if (valid.length === 0) {
      return [];
    }

    // Remove duplicates
    const uniqueTagNames = Array.from(new Set(valid));

    return await this.tagRepo.bulkFindOrCreate(uniqueTagNames, userId);
  }

  /**
   * Get tag details by name
   */
  async getTagByName(name: string): Promise<Tag | null> {
    const sanitizedName = this.sanitizeTagName(name);
    
    if (!this.isValidTagName(sanitizedName)) {
      return null;
    }

    return await this.tagRepo.getByName(sanitizedName);
  }

  /**
   * Get documents for a tag
   */
  async getTagDocuments(tagId: string): Promise<string[]> {
    if (!this.isValidUUID(tagId)) {
      throw new Error('Invalid tag ID format');
    }

    return await this.tagRepo.getTagDocuments(tagId);
  }

  /**
   * Get user's created tags
   */
  async getUserTags(userId: string): Promise<Tag[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return await this.tagRepo.getUserTags(userId);
  }

  /**
   * Delete a tag (if not in use)
   */
  async deleteTag(tagId: string, userId: string): Promise<boolean> {
    if (!this.isValidUUID(tagId)) {
      throw new Error('Invalid tag ID format');
    }

    if (!userId) {
      throw new Error('User must be authenticated to delete tags');
    }

    return await this.tagRepo.delete(tagId, userId);
  }

  /**
   * Get trending tags (recently popular)
   */
  async getTrendingTags(limit: number = 10): Promise<Array<Tag & { doc_count: number }>> {
    // For now, return popular tags
    // This could be enhanced to consider recent activity
    return await this.getPopularTags(limit);
  }

  /**
   * Get recommended tags based on document content
   */
  getRecommendedTags(title: string, description: string, content: string): string[] {
    const text = `${title} ${description} ${content}`.toLowerCase();
    const recommendations: string[] = [];

    // Simple keyword matching with predefined tags
    for (const tag of PREDEFINED_TAGS) {
      if (text.includes(tag)) {
        recommendations.push(tag);
      }
    }

    // Additional smart recommendations based on patterns
    if (text.includes('react') || text.includes('jsx') || text.includes('tsx')) {
      recommendations.push('react', 'javascript', 'typescript');
    }

    if (text.includes('api') || text.includes('endpoint') || text.includes('http')) {
      recommendations.push('api', 'rest');
    }

    if (text.includes('database') || text.includes('sql') || text.includes('query')) {
      recommendations.push('postgresql', 'mysql');
    }

    // Remove duplicates and limit to 5 recommendations
    return Array.from(new Set(recommendations)).slice(0, 5);
  }

  // Private helper methods

  private sanitizeTagName(tagName: string): string {
    return tagName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '') // Remove invalid characters
      .replace(/^[-_]+|[-_]+$/g, '') // Remove leading/trailing special chars
      .replace(/[-_]{2,}/g, '-') // Replace consecutive special chars with single hyphen
      .slice(0, 50); // Limit length
  }

  private isValidTagName(tagName: string): boolean {
    if (!tagName || tagName.length < 2 || tagName.length > 50) {
      return false;
    }

    // Must contain only letters, numbers, hyphens, and underscores
    const tagRegex = /^[a-z0-9\-_]+$/;
    if (!tagRegex.test(tagName)) {
      return false;
    }

    // Cannot start or end with special characters
    if (tagName.startsWith('-') || tagName.startsWith('_') || 
        tagName.endsWith('-') || tagName.endsWith('_')) {
      return false;
    }

    return true;
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}