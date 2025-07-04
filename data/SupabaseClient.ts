import { createClient } from '@supabase/supabase-js';

// Configuration from environment variables
const SUPABASE_URL = 'https://qxbfhpisnafbwtrhekyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4YmZocGlzbmFmYnd0cmhla3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNDkyOTcsImV4cCI6MjA2NjcyNTI5N30.VboPHSbBC6XERXMKbxRLe_NhjzhjRYfctwBPzpz1eAo';

// Validate configuration
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration: SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

// Create real Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Helper function to create timeout wrapper
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

// Helper functions for auth
export const getCurrentUser = async () => {
  console.log("🔍 SupabaseClient: Getting current user...");
  try {
    const { data: { user }, error } = await withTimeout(supabase.auth.getUser(), 8000);
    if (error) {
      console.error('❌ SupabaseClient: Error getting current user:', error);
      throw error;
    }
    console.log("✅ SupabaseClient: Current user retrieved:", user ? "Found" : "None");
    return user;
  } catch (error) {
    console.error('❌ SupabaseClient: getCurrentUser failed:', error);
    throw error;
  }
};

export const getCurrentSession = async () => {
  console.log("🔍 SupabaseClient: Getting current session...");
  try {
    const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 8000);
    if (error) {
      console.error('❌ SupabaseClient: Error getting current session:', error);
      throw error;
    }
    console.log("✅ SupabaseClient: Current session retrieved:", session ? "Found" : "None");
    return session;
  } catch (error) {
    console.error('❌ SupabaseClient: getCurrentSession failed:', error);
    throw error;
  }
};

// Database health check
export const checkDatabaseHealth = async (): Promise<{ healthy: boolean; error?: string }> => {
  try {
    console.log("🏥 SupabaseClient: Checking database health...");
    
    // Simple query to test database connectivity
    const { data, error } = await withTimeout(
      supabase.from('users').select('id').limit(1), 
      5000
    );
    
    if (error) {
      console.error('❌ SupabaseClient: Database health check failed:', error);
      return { healthy: false, error: error.message };
    }
    
    console.log("✅ SupabaseClient: Database is healthy");
    return { healthy: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ SupabaseClient: Database health check error:', message);
    return { healthy: false, error: message };
  }
};

// Type exports for convenience
export type { Database } from '../types/database';
export type SupabaseClient = typeof supabase;