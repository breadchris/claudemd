import React, { useState, useEffect, useCallback } from 'react';
import { useSessions } from '../hooks/useSessions';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { SessionRepository, type SessionSummary } from '../data/SessionRepository';
import { useAuth } from '../auth';
import type { ClaudeSession } from '../types/session';
import { ClaudeSessionViewer } from './ClaudeSessionViewer';

interface ClaudeSessionBrowserProps {
  onViewSession?: (sessionId: string) => void;
}

export const ClaudeSessionBrowser: React.FC<ClaudeSessionBrowserProps> = ({
  onViewSession
}) => {
  const { user, signInWithGithub } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedSession, setSelectedSession] = useState<ClaudeSession | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [initialSessionId, setInitialSessionId] = useState<string | null>(null);
  
  const sessionRepository = new SessionRepository();
  const { 
    sessions, 
    loading, 
    isLoadingMore,
    error, 
    hasMore,
    refreshSessions, 
    searchSessions,
    loadMoreSessions
  } = useSessions({
    autoRefresh: false,
    pageSize: 20
  });

  // Set up infinite scroll
  const { triggerRef } = useInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: loadMoreSessions
  });

  // Handle URL parameters for session sharing
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    if (sessionId && !selectedSession) {
      setInitialSessionId(sessionId);
      // Find and load the session from the list
      const foundSession = sessions.find(s => s.session_id === sessionId);
      if (foundSession) {
        // Load the full session if we only have a summary
        if (!('messages' in foundSession)) {
          sessionRepository.getBySessionId(sessionId).then(session => {
            if (session) {
              setSelectedSession(session);
            }
          }).catch(error => {
            console.error('Failed to load full session from URL:', error);
          });
        } else {
          setSelectedSession(foundSession as ClaudeSession);
        }
      } else {
        // If session not in current list, load it directly
        sessionRepository.getBySessionId(sessionId).then(session => {
          if (session) {
            setSelectedSession(session);
          }
        }).catch(error => {
          console.error('Failed to load session from URL:', error);
        });
      }
    }
  }, [sessions, selectedSession, sessionRepository]);

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      await searchSessions(query);
    } else {
      refreshSessions();
    }
  }, [searchSessions, refreshSessions]);

  // Handle session selection
  const handleSessionSelect = async (session: ClaudeSession | SessionSummary) => {
    // If it's a summary, we need to load the full session
    if (!('messages' in session)) {
      try {
        const fullSession = await sessionRepository.getBySessionId(session.session_id);
        if (fullSession) {
          setSelectedSession(fullSession);
          if (onViewSession) {
            onViewSession(session.session_id);
          }
        }
      } catch (error) {
        console.error('Failed to load full session:', error);
      }
    } else {
      // It's already a full session
      setSelectedSession(session as ClaudeSession);
      if (onViewSession) {
        onViewSession(session.session_id);
      }
    }
  };

  // Handle back from session detail
  const handleBackToList = () => {
    setSelectedSession(null);
  };

  // Get first user message for preview
  const getFirstUserMessage = (session: ClaudeSession | SessionSummary): string => {
    return sessionRepository.getFirstUserMessage(session);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // If a session is selected, show the session viewer
  if (selectedSession) {
    return (
      <ClaudeSessionViewer 
        initialSessionId={selectedSession.session_id}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Claude Sessions
              </h1>
              {user && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {user.avatar_url && (
                    <img 
                      src={user.avatar_url} 
                      alt={user.username}
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  @{user.username}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSearch(!showSearch)}
                    className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    {showSearch ? 'Hide Search' : 'Search'}
                  </button>
                  <button
                    onClick={refreshSessions}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => signInWithGithub()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Sign in with GitHub
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="mt-4 flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search sessions by title or content..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 text-sm border-l border-gray-300 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                  >
                    List
                  </button>
                </div>
                
                {searchQuery && (
                  <button
                    onClick={() => handleSearch('')}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-600">
            {loading ? 'Loading...' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} found`}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading sessions...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              No sessions found
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery ? 'Try a different search term.' : 'Your Claude Code sessions will appear here once synced.'}
            </p>
            {!user && (
              <button
                onClick={() => signInWithGithub()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Sign in to view sessions
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={`grid gap-6 ${
              viewMode === 'grid' 
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' 
                : 'grid-cols-1'
            }`}>
              {sessions.map(session => (
                <div 
                  key={session.id} 
                  className="bg-white rounded-lg shadow-sm border hover:shadow-lg hover:border-blue-200 transition-all duration-200 cursor-pointer group focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
                  onClick={() => handleSessionSelect(session)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSessionSelect(session);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View session: ${session.title}`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 transition-colors">
                        {session.title}
                      </h3>
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {(() => {
                            const count = 'message_count' in session ? session.message_count : 
                                         ('messages' in session && session.messages) ? session.messages.length : 0;
                            return `${count} msg${count !== 1 ? 's' : ''}`;
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* First user message preview */}
                    <div className="mb-3">
                      <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed">
                        {getFirstUserMessage(session)}
                      </p>
                    </div>

                    {/* Session metadata */}
                    <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
                      <span>{formatDate(session.created_at)}</span>
                      <span className="px-2 py-1 bg-gray-100 rounded font-mono">
                        {session.session_id.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Infinite Scroll Trigger and Loading States */}
            <div className="mt-8">
              {/* Loading More Indicator */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading more sessions...</span>
                </div>
              )}

              {/* Load More Button (fallback) */}
              {hasMore && !isLoadingMore && (
                <div className="flex items-center justify-center py-6">
                  <button
                    onClick={loadMoreSessions}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Load More Sessions
                  </button>
                </div>
              )}

              {/* End of Results */}
              {!hasMore && sessions.length > 0 && (
                <div className="flex items-center justify-center py-6">
                  <span className="text-gray-500 text-sm">You've reached the end of your sessions</span>
                </div>
              )}

              {/* Infinite Scroll Trigger (invisible) */}
              <div ref={triggerRef} className="h-1" aria-hidden="true" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};