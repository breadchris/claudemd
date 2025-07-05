import { useState, useEffect, useCallback } from 'react';
import { SessionRepository, type SessionSummary } from '../data/SessionRepository';
import type { ClaudeSession } from '../types/session';
import { useAuth } from '../auth/useAuth';

const sessionRepository = new SessionRepository();

export interface UseSessionsOptions {
  autoRefresh?: boolean;
  pageSize?: number;
}

export function useSessions(options: UseSessionsOptions = {}) {
  const { autoRefresh = true, pageSize = 20 } = options;
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSessions = useCallback(async (resetPagination = true) => {
    try {
      setLoading(resetPagination);
      setError(null);
      
      const page = resetPagination ? 1 : currentPage;
      const params = {
        page,
        per_page: pageSize,
        user_id: user?.id,
        query: searchQuery.trim() || undefined
      };
      
      const response = await sessionRepository.getSessions(params);
      
      if (resetPagination) {
        setSessions(response.sessions);
        setCurrentPage(1);
      } else {
        setSessions(prev => [...prev, ...response.sessions]);
      }
      
      setTotalPages(response.total_pages);
      setHasMore(page < response.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [pageSize, user?.id, searchQuery, currentPage]);

  const loadMoreSessions = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    try {
      setIsLoadingMore(true);
      setError(null);
      
      const nextPage = currentPage + 1;
      const params = {
        page: nextPage,
        per_page: pageSize,
        user_id: user?.id,
        query: searchQuery.trim() || undefined
      };
      
      const response = await sessionRepository.getSessions(params);
      
      setSessions(prev => [...prev, ...response.sessions]);
      setCurrentPage(nextPage);
      setHasMore(nextPage < response.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more sessions');
      console.error('Error loading more sessions:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, pageSize, user?.id, searchQuery, isLoadingMore, hasMore]);

  const searchSessions = useCallback(async (searchTerm: string) => {
    setSearchQuery(searchTerm);
    setCurrentPage(1);
    setHasMore(true);
    await fetchSessions(true);
  }, [fetchSessions]);

  const refreshSessions = useCallback(() => {
    setCurrentPage(1);
    setHasMore(true);
    fetchSessions(true);
  }, [fetchSessions]);

  // Initial load
  useEffect(() => {
    fetchSessions(true);
  }, [user?.id]); // Only depend on user id change

  // Optional: Set up auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshSessions();
    }, 30000); // Refresh every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, [autoRefresh, refreshSessions]);

  return {
    sessions,
    loading,
    isLoadingMore,
    error,
    hasMore,
    currentPage,
    totalPages,
    refreshSessions,
    searchSessions,
    loadMoreSessions,
  };
}

export function useSession(sessionId: string) {
  const [session, setSession] = useState<ClaudeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await sessionRepository.getBySessionId(sessionId);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch session');
      console.error('Error fetching session:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const refreshSession = useCallback(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    session,
    loading,
    error,
    refreshSession,
  };
}