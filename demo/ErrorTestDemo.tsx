import React, { useState } from 'react';
import { supabase } from '../data/SupabaseClient';

// Simple component to test error handling with the real Supabase client
export const ErrorTestDemo: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testInvalidQuery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // This should fail and show a real error
      const { data, error } = await supabase
        .from('nonexistent_table')
        .select('*');
      
      if (error) {
        throw error;
      }
      
      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Supabase error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testAuthError = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // This should fail with an auth error
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'invalid@email.com',
        password: 'wrongpassword'
      });
      
      if (error) {
        throw error;
      }
      
      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Test basic connection - this might work or fail depending on RLS settings
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      setResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Connection test error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Supabase Error Testing
      </h2>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={testInvalidQuery}
          disabled={loading}
          className="w-full bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Invalid Table Query'}
        </button>
        
        <button
          onClick={testAuthError}
          disabled={loading}
          className="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Authentication Error'}
        </button>
        
        <button
          onClick={testConnection}
          disabled={loading}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-red-900 mb-2">Error:</h3>
          <p className="text-red-700 text-sm font-mono break-words">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-900 mb-2">Success:</h3>
          <pre className="text-green-700 text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">How to Test:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Invalid Table Query:</strong> Should show "relation does not exist" error</li>
          <li>• <strong>Authentication Error:</strong> Should show "Invalid login credentials" error</li>
          <li>• <strong>Connection Test:</strong> May succeed or fail based on RLS policies</li>
        </ul>
      </div>
    </div>
  );
};

export default ErrorTestDemo;