import { useState, useEffect, useCallback } from 'react';
import { ClaudeDocService } from '../services';
import { useAuth } from '../auth';
import type { 
  ClaudeDocResponse, 
  ClaudeDocListResponse, 
  CreateClaudeDocRequest, 
  UpdateClaudeDocRequest,
  SearchParams 
} from '../types/database';

export interface UseClaudeDocsOptions {
  initialParams?: SearchParams;
  autoLoad?: boolean;
}

export interface UseClaudeDocsReturn {
  docs: ClaudeDocResponse[];
  loading: boolean;
  error: string | null;
  total: number;
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
  
  // Actions
  loadDocs: (params?: SearchParams) => Promise<void>;
  createDoc: (doc: CreateClaudeDocRequest) => Promise<ClaudeDocResponse>;
  updateDoc: (id: string, doc: UpdateClaudeDocRequest) => Promise<ClaudeDocResponse>;
  deleteDoc: (id: string) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  downloadDoc: (id: string) => Promise<void>;
  
  // Utilities
  setSearchParams: (params: Partial<SearchParams>) => void;
  resetSearch: () => void;
  nextPage: () => void;
  prevPage: () => void;
  setPage: (page: number) => void;
}

export const useClaudeDocs = (options: UseClaudeDocsOptions = {}): UseClaudeDocsReturn => {
  const { user } = useAuth();
  const docService = new ClaudeDocService();
  
  const defaultParams: SearchParams = {
    page: 1,
    per_page: 20,
    sort_by: 'created_at',
    ...options.initialParams
  };

  const [docs, setDocs] = useState<ClaudeDocResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(defaultParams.page || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchParams, setSearchParamsState] = useState<SearchParams>(defaultParams);

  // Load documents
  const loadDocs = useCallback(async (params?: SearchParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const searchParamsToUse = params || searchParams;
      const response = await docService.getPublicDocs(searchParamsToUse);
      
      setDocs(response.docs);
      setTotal(response.total);
      setCurrentPage(response.page);
      setTotalPages(response.total_pages);
      
      if (params) {
        setSearchParamsState(searchParamsToUse);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load documents';
      setError(errorMessage);
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  // Create document
  const createDoc = useCallback(async (doc: CreateClaudeDocRequest): Promise<ClaudeDocResponse> => {
    if (!user) {
      throw new Error('User must be authenticated to create documents');
    }

    try {
      const newDoc = await docService.createDocument(doc, user.id);
      
      // Add to current docs if it matches current filters
      if (!searchParams.query && (!searchParams.tags || searchParams.tags.length === 0)) {
        setDocs(prev => [newDoc, ...prev.slice(0, (searchParams.per_page || 20) - 1)]);
        setTotal(prev => prev + 1);
      }
      
      return newDoc;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create document';
      setError(errorMessage);
      throw err;
    }
  }, [user, searchParams]);

  // Update document
  const updateDoc = useCallback(async (id: string, doc: UpdateClaudeDocRequest): Promise<ClaudeDocResponse> => {
    if (!user) {
      throw new Error('User must be authenticated to update documents');
    }

    try {
      const updatedDoc = await docService.updateDocument(id, doc, user.id);
      
      // Update in current docs
      setDocs(prev => 
        prev.map(d => d.id === id ? updatedDoc : d)
      );
      
      return updatedDoc;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update document';
      setError(errorMessage);
      throw err;
    }
  }, [user]);

  // Delete document
  const deleteDoc = useCallback(async (id: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be authenticated to delete documents');
    }

    try {
      await docService.deleteDocument(id, user.id);
      
      // Remove from current docs
      setDocs(prev => prev.filter(d => d.id !== id));
      setTotal(prev => prev - 1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
      setError(errorMessage);
      throw err;
    }
  }, [user]);

  // Toggle star
  const toggleStar = useCallback(async (id: string): Promise<void> => {
    if (!user) {
      throw new Error('User must be authenticated to star documents');
    }

    try {
      const result = await docService.toggleStar(id, user.id);
      
      // Update in current docs
      setDocs(prev => 
        prev.map(doc => 
          doc.id === id 
            ? { 
                ...doc, 
                is_starred: result.starred,
                stars: result.starCount
              }
            : doc
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle star';
      setError(errorMessage);
      throw err;
    }
  }, [user]);

  // Download document
  const downloadDoc = useCallback(async (id: string): Promise<void> => {
    try {
      const result = await docService.downloadDocument(id, user?.id);
      
      // Create download link
      const blob = new Blob([result.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Update download count
      setDocs(prev => 
        prev.map(doc => 
          doc.id === id 
            ? { ...doc, downloads: doc.downloads + 1 }
            : doc
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download document';
      setError(errorMessage);
      throw err;
    }
  }, [user]);

  // Update search parameters
  const setSearchParams = useCallback((params: Partial<SearchParams>) => {
    const newParams = { ...searchParams, ...params, page: 1 }; // Reset to page 1 when params change
    setSearchParamsState(newParams);
  }, [searchParams]);

  // Reset search
  const resetSearch = useCallback(() => {
    setSearchParamsState(defaultParams);
  }, []);

  // Pagination helpers
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      const newParams = { ...searchParams, page: currentPage + 1 };
      setSearchParamsState(newParams);
    }
  }, [currentPage, totalPages, searchParams]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      const newParams = { ...searchParams, page: currentPage - 1 };
      setSearchParamsState(newParams);
    }
  }, [currentPage, searchParams]);

  const setPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      const newParams = { ...searchParams, page };
      setSearchParamsState(newParams);
    }
  }, [currentPage, totalPages, searchParams]);

  // Auto-load on mount and when search params change
  useEffect(() => {
    if (options.autoLoad !== false) {
      loadDocs();
    }
  }, [searchParams, loadDocs, options.autoLoad]);

  return {
    docs,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    searchParams,
    
    // Actions
    loadDocs,
    createDoc,
    updateDoc,
    deleteDoc,
    toggleStar,
    downloadDoc,
    
    // Utilities
    setSearchParams,
    resetSearch,
    nextPage,
    prevPage,
    setPage
  };
};