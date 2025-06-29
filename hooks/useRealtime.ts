import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../data/SupabaseClient';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { ClaudeDoc, ClaudeDocStar } from '../types/database';

export interface UseRealtimeOptions {
  table: 'claude_docs' | 'claude_doc_stars' | 'tags';
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
}

export interface UseRealtimeReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  
  // Actions
  subscribe: () => void;
  unsubscribe: () => void;
}

export const useRealtime = <T = any>(
  options: UseRealtimeOptions,
  onEvent?: (payload: RealtimePostgresChangesPayload<T>) => void
): UseRealtimeReturn<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  const subscribe = useCallback(() => {
    if (subscription) {
      return; // Already subscribed
    }

    setLoading(true);
    setError(null);

    try {
      let channel = supabase
        .channel(`realtime-${options.table}`)
        .on(
          'postgres_changes',
          {
            event: options.event || '*',
            schema: 'public',
            table: options.table,
            filter: options.filter
          },
          (payload: RealtimePostgresChangesPayload<T>) => {
            console.log('Realtime event:', payload);
            
            setData(payload.new as T || payload.old as T || null);
            onEvent?.(payload);
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
          setIsConnected(status === 'SUBSCRIBED');
          setLoading(false);
          
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setError('Realtime connection failed');
          }
        });

      setSubscription(channel);
    } catch (err) {
      console.error('Failed to subscribe to realtime:', err);
      setError(err instanceof Error ? err.message : 'Subscription failed');
      setLoading(false);
    }
  }, [options, onEvent, subscription]);

  const unsubscribe = useCallback(() => {
    if (subscription) {
      supabase.removeChannel(subscription);
      setSubscription(null);
      setIsConnected(false);
      setData(null);
    }
  }, [subscription]);

  // Auto-subscribe on mount
  useEffect(() => {
    subscribe();
    
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    data,
    loading,
    error,
    isConnected,
    subscribe,
    unsubscribe
  };
};

// Specialized hooks for common use cases

export const useDocumentRealtime = (
  docId?: string,
  onDocumentUpdate?: (doc: ClaudeDoc) => void
) => {
  return useRealtime<ClaudeDoc>(
    {
      table: 'claude_docs',
      event: 'UPDATE',
      filter: docId ? `id=eq.${docId}` : undefined
    },
    (payload) => {
      if (payload.new && onDocumentUpdate) {
        onDocumentUpdate(payload.new as ClaudeDoc);
      }
    }
  );
};

export const useStarRealtime = (
  docId?: string,
  onStarChange?: (star: ClaudeDocStar, event: 'INSERT' | 'DELETE') => void
) => {
  return useRealtime<ClaudeDocStar>(
    {
      table: 'claude_doc_stars',
      event: '*',
      filter: docId ? `claude_doc_id=eq.${docId}` : undefined
    },
    (payload) => {
      if (onStarChange) {
        const event = payload.eventType as 'INSERT' | 'DELETE';
        const star = (payload.new || payload.old) as ClaudeDocStar;
        onStarChange(star, event);
      }
    }
  );
};

export const useDocumentListRealtime = (
  onDocumentChange?: (payload: RealtimePostgresChangesPayload<ClaudeDoc>) => void
) => {
  return useRealtime<ClaudeDoc>(
    {
      table: 'claude_docs',
      event: '*'
    },
    onDocumentChange
  );
};