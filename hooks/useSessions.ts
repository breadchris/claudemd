import { useState, useEffect, useCallback } from 'react';
import { SessionRepository } from '../data/SessionRepository';
import type { ClaudeSession } from '../types/session';
import { useAuth } from '../auth/useAuth';

const sessionRepository = new SessionRepository();

export interface UseSessionsOptions {
  autoRefresh?: boolean;
  limit?: number;
}

export function useSessions(options: UseSessionsOptions = {}) {
  const { autoRefresh = true, limit = 50 } = options;
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ClaudeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sessionRepository.getRecentSessions(user?.id, limit);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, user?.id]);

  const searchSessions = useCallback(async (searchTerm: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await sessionRepository.searchSessions(searchTerm, user?.id);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search sessions');
      console.error('Error searching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const refreshSessions = useCallback(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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
    error,
    refreshSessions,
    searchSessions,
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