import { useState, useEffect, useCallback } from 'react';
import { TagService } from '../services';
import { useAuth } from '../auth';
import type { Tag } from '../types/database';

export interface UseTagsReturn {
  tags: Array<Tag & { doc_count: number }>;
  loading: boolean;
  error: string | null;
  suggestions: string[];
  
  // Actions
  loadTags: () => Promise<void>;
  searchTags: (query: string) => Promise<Tag[]>;
  getSuggestions: (query: string) => Promise<void>;
  createTag: (name: string, color?: string) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  
  // Utilities
  validateTagNames: (tagNames: string[]) => { valid: string[]; invalid: string[] };
  getPopularTags: (limit?: number) => Promise<Array<Tag & { doc_count: number }>>;
  getPredefinedTags: () => string[];
  getTagsByCategory: () => Record<string, string[]>;
  getRecommendedTags: (title: string, description: string, content: string) => string[];
}

export const useTags = (): UseTagsReturn => {
  const { user } = useAuth();
  const tagService = new TagService();
  
  const [tags, setTags] = useState<Array<Tag & { doc_count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Load all tags with usage count
  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const allTags = await tagService.getAllTags();
      setTags(allTags);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tags';
      setError(errorMessage);
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search tags by name
  const searchTags = useCallback(async (query: string): Promise<Tag[]> => {
    try {
      return await tagService.searchTags(query);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search tags';
      setError(errorMessage);
      console.error('Failed to search tags:', err);
      return [];
    }
  }, []);

  // Get tag suggestions
  const getSuggestions = useCallback(async (query: string) => {
    try {
      const tagSuggestions = await tagService.getTagSuggestions(query);
      setSuggestions(tagSuggestions);
    } catch (err) {
      console.error('Failed to get tag suggestions:', err);
      setSuggestions([]);
    }
  }, []);

  // Create a new tag
  const createTag = useCallback(async (name: string, color?: string): Promise<Tag> => {
    if (!user) {
      throw new Error('User must be authenticated to create tags');
    }

    try {
      const newTag = await tagService.processTagNames([name], user.id);
      
      if (newTag.length === 0) {
        throw new Error('Failed to create tag');
      }
      
      // Refresh tags list
      await loadTags();
      
      return newTag[0];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tag';
      setError(errorMessage);
      throw err;
    }
  }, [user, loadTags]);

  // Delete a tag
  const deleteTag = useCallback(async (id: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be authenticated to delete tags');
    }

    try {
      await tagService.deleteTag(id, user.id);
      
      // Remove from current tags
      setTags(prev => prev.filter(tag => tag.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete tag';
      setError(errorMessage);
      throw err;
    }
  }, [user]);

  // Validate tag names
  const validateTagNames = useCallback((tagNames: string[]) => {
    return tagService.validateTagNames(tagNames);
  }, []);

  // Get popular tags
  const getPopularTags = useCallback(async (limit: number = 20): Promise<Array<Tag & { doc_count: number }>> => {
    try {
      return await tagService.getPopularTags(limit);
    } catch (err) {
      console.error('Failed to get popular tags:', err);
      return [];
    }
  }, []);

  // Get predefined tags
  const getPredefinedTags = useCallback((): string[] => {
    return tagService.getPredefinedTags();
  }, []);

  // Get tags by category
  const getTagsByCategory = useCallback((): Record<string, string[]> => {
    return tagService.getTagsByCategory();
  }, []);

  // Get recommended tags
  const getRecommendedTags = useCallback((title: string, description: string, content: string): string[] => {
    return tagService.getRecommendedTags(title, description, content);
  }, []);

  // Load tags on mount
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  return {
    tags,
    loading,
    error,
    suggestions,
    
    // Actions
    loadTags,
    searchTags,
    getSuggestions,
    createTag,
    deleteTag,
    
    // Utilities
    validateTagNames,
    getPopularTags,
    getPredefinedTags,
    getTagsByCategory,
    getRecommendedTags
  };
};