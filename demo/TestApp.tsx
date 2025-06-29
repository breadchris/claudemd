import React, { useState } from 'react';
import { AuthProvider, useAuth } from '../auth';
import { ErrorTestDemo } from './ErrorTestDemo';

// Simple test component to verify the authentication works
const TestAuthComponent: React.FC = () => {
  const { user, loading, signInWithGithub, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Authentication Test
      </h2>
      
      {user ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {user.avatar_url && (
              <img 
                src={user.avatar_url} 
                alt={user.username}
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <p className="font-medium text-gray-900">@{user.username}</p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          </div>
          
          <button
            onClick={signOut}
            className="w-full bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600 text-center">
            Sign in to test the authentication system
          </p>
          
          <button
            onClick={() => signInWithGithub()}
            className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Sign in with GitHub
          </button>
          
          <p className="text-xs text-gray-500 text-center">
            * This will use real Supabase authentication
          </p>
        </div>
      )}
    </div>
  );
};

// Main test app
export const TestApp: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'auth' | 'demo' | 'errors'>('demo');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Supabase CLAUDE.md Test
            </h1>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCurrentTab('demo')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  currentTab === 'demo'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Demo
              </button>
              <button
                onClick={() => setCurrentTab('auth')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  currentTab === 'auth'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Auth Test
              </button>
              <button
                onClick={() => setCurrentTab('errors')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  currentTab === 'errors'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Error Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {currentTab === 'demo' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                🚀 Supabase CLAUDE.md Platform
              </h3>
              <p className="text-blue-700 text-sm">
                This is a test environment for the Supabase CLAUDE.md platform. 
                The full platform includes document management, authentication, 
                real-time updates, and more.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-3">✅ Features Implemented</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Stratified architecture (Data/Service/UI layers)</li>
                  <li>• GitHub OAuth authentication</li>
                  <li>• Document CRUD operations</li>
                  <li>• Tag management system</li>
                  <li>• Search and filtering</li>
                  <li>• Real-time subscriptions</li>
                  <li>• Mobile-responsive design</li>
                  <li>• Row Level Security (RLS)</li>
                </ul>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-3">🛠️ To Use Full Platform</h3>
                <ol className="space-y-2 text-sm text-gray-600">
                  <li>1. Install Supabase dependencies:</li>
                  <li className="ml-4 font-mono text-xs bg-gray-100 p-1 rounded">
                    npm install @supabase/supabase-js
                  </li>
                  <li>2. Run SQL migrations in Supabase</li>
                  <li>3. Configure GitHub OAuth</li>
                  <li>4. Import and use ClaudeDocApp</li>
                </ol>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📁 File Structure</h3>
              <div className="text-sm text-gray-600 font-mono bg-gray-50 p-4 rounded">
                <div>/supabase/</div>
                <div>├── data/ (Repositories & DB access)</div>
                <div>├── services/ (Business logic)</div>
                <div>├── auth/ (Authentication)</div>
                <div>├── hooks/ (Custom React hooks)</div>
                <div>├── components/ (UI components)</div>
                <div>├── schema/ (Database migrations)</div>
                <div>└── demo/ (Test components)</div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'auth' && (
          <AuthProvider>
            <TestAuthComponent />
          </AuthProvider>
        )}

        {currentTab === 'errors' && (
          <ErrorTestDemo />
        )}
      </div>
    </div>
  );
};

export default TestApp;