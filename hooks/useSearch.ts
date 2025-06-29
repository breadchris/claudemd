import { useState, useCallback } from 'react';
import { SearchService } from '../services';
import type { ClaudeDocListResponse, SearchParams } from '../types/database';

export interface UseSearchReturn {
  results: ClaudeDocListResponse | null;
  loading: boolean;
  error: string | null;
  suggestions: string[];
  
  // Actions
  search: (params: SearchParams) => Promise<void>;
  getSuggestions: (query: string) => Promise<void>;
  getPopularTerms: () => string[];
  searchByAuthor: (username: string, params?: Omit<SearchParams, 'query'>) => Promise<void>;
  
  // Utilities
  clearResults: () => void;
  clearError: () => void;
}

export const useSearch = (): UseSearchReturn => {
  const searchService = new SearchService();
  
  const [results, setResults] = useState<ClaudeDocListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Perform search
  const search = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const searchResults = await searchService.searchDocuments(params);
      setResults(searchResults);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      console.error('Search failed:', err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get search suggestions
  const getSuggestions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const searchSuggestions = await searchService.getSearchSuggestions(query);
      setSuggestions(searchSuggestions);
    } catch (err) {
      console.error('Failed to get search suggestions:', err);
      setSuggestions([]);
    }
  }, []);

  // Get popular search terms
  const getPopularTerms = useCallback((): string[] => {
    return searchService.getPopularSearchTerms();
  }, []);

  // Search by author
  const searchByAuthor = useCallback(async (username: string, params: Omit<SearchParams, 'query'> = {}) => {
    await search({
      ...params,
      query: `author:${username}`
    });
  }, [search]);

  // Clear results
  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    suggestions,
    
    // Actions
    search,
    getSuggestions,
    getPopularTerms,
    searchByAuthor,
    
    // Utilities
    clearResults,
    clearError
  };
};