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

// Helper functions for auth
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
  return user;
};

export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting current session:', error);
    throw error;
  }
  return session;
};

// Type exports for convenience
export type { Database } from '../types/database';
export type SupabaseClient = typeof supabase;