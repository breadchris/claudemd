import React, { useState, useEffect } from 'react';
import { useSessions, useSession } from '../hooks/useSessions';
import type { SessionSummary } from '../data/SessionRepository';
import type { ClaudeSession, SessionMessage } from '../types/session';

interface ClaudeSessionViewerProps {
  initialSessionId?: string;
  onBack?: () => void;
}

export function ClaudeSessionViewer({ initialSessionId, onBack }: ClaudeSessionViewerProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  const { sessions, loading: sessionsLoading, error: sessionsError, searchSessions, refreshSessions } = useSessions();
  const { session: selectedSession, loading: sessionLoading, error: sessionError } = useSession(selectedSessionId || '');

  // Handle URL changes for session sharing
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session');
      if (sessionId) {
        setSelectedSessionId(sessionId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Check initial URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    if (sessionId && !selectedSessionId) {
      setSelectedSessionId(sessionId);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedSessionId]);

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    // Update URL for sharing
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    window.history.pushState({}, '', url.toString());
  };

  const handleBackToList = () => {
    setSelectedSessionId(null);
    // Remove session from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.pushState({}, '', url.toString());
    
    // Call parent onBack handler if provided
    if (onBack) {
      onBack();
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchSessions(searchTerm);
    } else {
      refreshSessions();
    }
  };

  const copySessionUrl = () => {
    if (selectedSessionId) {
      const url = new URL(window.location.href);
      url.searchParams.set('session', selectedSessionId);
      navigator.clipboard.writeText(url.toString());
      // Could add a toast notification here
      alert('Session URL copied to clipboard!');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateTitle = (title: string, maxLength: number = 60) => {
    return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
  };

  if (selectedSession) {
    return <SessionDetailView 
      session={selectedSession} 
      loading={sessionLoading}
      error={sessionError}
      onBack={handleBackToList}
      onCopyUrl={copySessionUrl}
    />;
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Claude Sessions</h1>
            <p className="text-gray-600">Browse and share your Claude Code conversations</p>
          </div>
          
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
        </div>

        {/* Search Bar */}
        {showSearch && (
          <form onSubmit={handleSearch} className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search sessions by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    refreshSessions();
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Error State */}
      {sessionsError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Error: {sessionsError}</p>
        </div>
      )}

      {/* Loading State */}
      {sessionsLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading sessions...</span>
        </div>
      )}

      {/* Sessions Grid */}
      {!sessionsLoading && sessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onSelect={() => handleSessionSelect(session.session_id)}
              formatDate={formatDate}
              truncateTitle={truncateTitle}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!sessionsLoading && sessions.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-5xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions found</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Try a different search term.' : 'Your Claude Code sessions will appear here once synced.'}
          </p>
        </div>
      )}
    </div>
  );
}

interface SessionCardProps {
  session: SessionSummary;
  onSelect: () => void;
  formatDate: (date: string) => string;
  truncateTitle: (title: string, maxLength?: number) => string;
}

function SessionCard({ session, onSelect, formatDate, truncateTitle }: SessionCardProps) {
  const messageCount = session.message_count || 0;

  return (
    <div
      onClick={onSelect}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 leading-tight">
          {truncateTitle(session.title)}
        </h3>
        <div className="flex-shrink-0 text-xs text-gray-500 ml-2">
          {messageCount} msg{messageCount !== 1 ? 's' : ''}
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {messageCount} message{messageCount !== 1 ? 's' : ''} • Last updated {formatDate(session.updated_at)}
      </p>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{formatDate(session.created_at)}</span>
        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
          {session.session_id.slice(0, 8)}...
        </span>
      </div>
    </div>
  );
}

interface SessionDetailViewProps {
  session: ClaudeSession;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onCopyUrl: () => void;
}

function SessionDetailView({ session, loading, error, onBack, onCopyUrl }: SessionDetailViewProps) {
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading session...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Error: {error}</p>
        </div>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          ← Back to Sessions
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← Back to Sessions
        </button>
        <button
          onClick={onCopyUrl}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
        >
          Share Session
        </button>
      </div>

      {/* Session Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{session.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>Session ID: {session.session_id}</span>
          <span>Messages: {session.messages?.length || 0}</span>
          <span>Created: {new Date(session.created_at).toLocaleString()}</span>
          {session.updated_at !== session.created_at && (
            <span>Updated: {new Date(session.updated_at).toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
        {session.messages && session.messages.length > 0 ? (
          <div className="space-y-3">
            {session.messages.map((message, index) => (
              <MessageCard key={index} message={message} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No messages in this session.
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageCardProps {
  message: SessionMessage;
  index: number;
}

function MessageCard({ message, index }: MessageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const PREVIEW_LENGTH = 200;

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'summary':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'user':
      case 'human':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'assistant':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getDisplayContent = () => {
    // Priority: content > summary > fallback message
    const fullContent = message.content || message.summary;
    if (!fullContent) {
      return `${message.type} message (no content available)`;
    }
    return fullContent;
  };

  const displayContent = getDisplayContent();
  const shouldShowExpansion = displayContent.length > PREVIEW_LENGTH;
  const contentToShow = isExpanded || !shouldShowExpansion
    ? displayContent
    : displayContent.substring(0, PREVIEW_LENGTH) + '...';

  return (
    <div className={`border rounded-lg p-4 ${getTypeColor(message.type)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide">
          {message.type}
        </span>
        <div className="flex items-center gap-2">
          {message.timestamp && (
            <span className="text-xs opacity-75">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          )}
          <span className="text-xs opacity-75">#{index + 1}</span>
        </div>
      </div>
      
      <div className="text-sm leading-relaxed">
        <p className="whitespace-pre-wrap">{contentToShow}</p>
        
        {shouldShowExpansion && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline focus:outline-none"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      
      {message.leafUuid && (
        <p className="text-xs mt-2 opacity-75 font-mono">
          Leaf UUID: {message.leafUuid}
        </p>
      )}
    </div>
  );
}