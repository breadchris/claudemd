import { ClaudeDocRepository } from '../data';
import type { ClaudeDocListResponse, SearchParams } from '../types/database';

export interface AdvancedSearchParams extends SearchParams {
  author?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  minStars?: number;
  minViews?: number;
  includePrivate?: boolean; // Only works for authenticated user's own docs
}

export class SearchService {
  private docRepo: ClaudeDocRepository;

  constructor() {
    this.docRepo = new ClaudeDocRepository();
  }

  /**
   * Basic text search across documents
   */
  async searchDocuments(params: SearchParams): Promise<ClaudeDocListResponse> {
    const sanitizedParams = this.sanitizeSearchParams(params);
    return await this.docRepo.getPublicDocs(sanitizedParams);
  }

  /**
   * Advanced search with multiple filters
   */
  async advancedSearch(params: AdvancedSearchParams): Promise<ClaudeDocListResponse> {
    // For now, delegate to basic search
    // This can be extended to handle advanced filters
    const basicParams: SearchParams = {
      query: params.query,
      tags: params.tags,
      page: params.page,
      per_page: params.per_page,
      sort_by: params.sort_by
    };

    return await this.searchDocuments(basicParams);
  }

  /**
   * Search suggestions based on query
   */
  async getSearchSuggestions(query: string): Promise<string[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const suggestions: string[] = [];
    
    // Common search terms for CLAUDE.md documentation
    const commonTerms = [
      'api integration', 'authentication', 'configuration', 'setup guide',
      'getting started', 'examples', 'best practices', 'troubleshooting',
      'deployment', 'environment variables', 'webhooks', 'database',
      'react components', 'typescript', 'javascript', 'python',
      'rest api', 'graphql', 'oauth', 'jwt', 'docker', 'kubernetes'
    ];

    const queryLower = query.toLowerCase().trim();
    
    // Find matching common terms
    for (const term of commonTerms) {
      if (term.includes(queryLower) || queryLower.includes(term.split(' ')[0])) {
        suggestions.push(term);
      }
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Get popular search terms
   */
  getPopularSearchTerms(): string[] {
    return [
      'react setup',
      'api configuration',
      'authentication guide',
      'typescript examples',
      'database integration',
      'deployment guide',
      'environment setup',
      'oauth implementation',
      'webhook configuration',
      'best practices'
    ];
  }

  /**
   * Search by author username
   */
  async searchByAuthor(username: string, params: Omit<SearchParams, 'query'> = {}): Promise<ClaudeDocListResponse> {
    // This would require a more complex query to filter by author
    // For now, use the query field to search for author mentions
    return await this.searchDocuments({
      ...params,
      query: `author:${username}` // This would need custom handling in the repository
    });
  }

  /**
   * Get related documents based on tags
   */
  async getRelatedDocuments(tags: string[], excludeDocId?: string, limit: number = 5): Promise<ClaudeDocListResponse> {
    if (tags.length === 0) {
      return {
        docs: [],
        total: 0,
        page: 1,
        per_page: limit,
        total_pages: 0
      };
    }

    return await this.searchDocuments({
      tags: tags.slice(0, 3), // Use up to 3 tags for related search
      per_page: limit,
      page: 1,
      sort_by: 'stars' // Sort by popularity for better recommendations
    });
  }

  /**
   * Full-text search with ranking
   */
  async fullTextSearch(query: string, params: Omit<SearchParams, 'query'> = {}): Promise<ClaudeDocListResponse> {
    const searchTerms = this.extractSearchTerms(query);
    
    if (searchTerms.length === 0) {
      return {
        docs: [],
        total: 0,
        page: 1,
        per_page: params.per_page || 20,
        total_pages: 0
      };
    }

    // For now, join search terms and use basic search
    const searchQuery = searchTerms.join(' ');
    
    return await this.searchDocuments({
      ...params,
      query: searchQuery
    });
  }

  /**
   * Search within user's own documents (including private)
   */
  async searchUserDocuments(userId: string, query: string): Promise<ClaudeDocListResponse> {
    // This would require a different approach since we need to search private docs
    // For now, return empty results - this needs implementation in the repository layer
    return {
      docs: [],
      total: 0,
      page: 1,
      per_page: 20,
      total_pages: 0
    };
  }

  /**
   * Get search analytics/statistics
   */
  getSearchStats(): {
    popularTags: string[];
    popularTerms: string[];
    recentSearches: string[];
  } {
    return {
      popularTags: [
        'typescript', 'react', 'api', 'nodejs', 'python',
        'authentication', 'database', 'docker', 'aws'
      ],
      popularTerms: this.getPopularSearchTerms(),
      recentSearches: [] // This would be stored and retrieved from user sessions
    };
  }

  // Private helper methods

  private sanitizeSearchParams(params: SearchParams): SearchParams {
    return {
      query: params.query?.trim().slice(0, 200), // Limit query length
      tags: params.tags?.slice(0, 5), // Limit to 5 tags max
      page: Math.max(1, params.page || 1),
      per_page: Math.min(50, Math.max(1, params.per_page || 20)), // Limit between 1-50
      sort_by: ['created_at', 'stars', 'views', 'downloads'].includes(params.sort_by || '') 
        ? params.sort_by 
        : 'created_at'
    };
  }

  private extractSearchTerms(query: string): string[] {
    if (!query) return [];
    
    // Split by spaces, remove empty strings, and limit to reasonable terms
    return query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length >= 2) // Minimum 2 characters
      .filter(term => !/^[^a-z0-9]*$/.test(term)) // Must contain alphanumeric characters
      .slice(0, 10); // Limit to 10 terms
  }

  private buildSearchQuery(terms: string[]): string {
    // Simple approach: join terms with AND logic
    return terms.join(' ');
  }

  private rankResults(results: any[], query: string): any[] {
    // Simple ranking based on term frequency in title vs description vs content
    const searchTerms = this.extractSearchTerms(query);
    
    if (searchTerms.length === 0) {
      return results;
    }

    return results.map(doc => {
      let score = 0;
      
      searchTerms.forEach(term => {
        // Title matches are worth more
        if (doc.title.toLowerCase().includes(term)) {
          score += 10;
        }
        
        // Description matches
        if (doc.description?.toLowerCase().includes(term)) {
          score += 5;
        }
        
        // Content matches (limited check to avoid performance issues)
        if (doc.content.toLowerCase().slice(0, 1000).includes(term)) {
          score += 1;
        }
        
        // Tag matches
        if (doc.tag_names.some((tag: string) => tag.includes(term))) {
          score += 3;
        }
      });
      
      return { ...doc, _search_score: score };
    }).sort((a, b) => (b._search_score || 0) - (a._search_score || 0));
  }
}