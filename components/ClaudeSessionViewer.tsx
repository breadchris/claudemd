import React, { useState, useEffect } from 'react';
import { useSessions, useSession } from '../hooks/useSessions';
import type { SessionSummary } from '../data/SessionRepository';
import type { ClaudeSession, SessionMessage, CategorizedMessage } from '../types/session';

// Enhanced message categorization utilities for Claude Code sessions
const categorizeMessage = (message: SessionMessage, index: number): CategorizedMessage => {
  const content = message.content || message.summary || '';
  const type = message.type.toLowerCase();
  
  // Determine message type and importance
  let messageType: CategorizedMessage['messageType'] = 'other';
  let category: CategorizedMessage['category'] = 'secondary';
  let importance: CategorizedMessage['importance'] = 'low';
  let isExitPlanMode = false;

  // Check for exit_plan_mode messages (finalized todo plans)
  if (content.includes('exit_plan_mode') || 
      (content.includes('plan') && content.includes('approval')) ||
      content.includes('exit plan mode')) {
    isExitPlanMode = true;
    messageType = 'todo_list';
    category = 'primary';
    importance = 'high';
  }
  // User messages (prompts)
  else if (type === 'user' || type === 'human') {
    messageType = 'user_prompt';
    category = 'primary';
    importance = 'high';
  }
  // Session summaries
  else if (type === 'summary') {
    messageType = 'summary';
    category = 'primary';
    importance = 'medium';
  }
  // Assistant messages
  else if (type === 'assistant') {
    // Check for todo-related content patterns
    if (content.includes('TodoWrite') || 
        content.includes('todo list') ||
        content.match(/\d+\. .+/g) || // Numbered list pattern
        (content.includes('plan') && (content.includes('implement') || content.includes('step')))) {
      messageType = 'todo_list';
      category = 'primary';
      importance = 'high';
    }
    // Check for tool usage patterns
    else if (content.includes('tool_use') || content.includes('function_calls') || 
             content.includes('<function_calls>') ||
             content.includes('Bash') || content.includes('Read') || content.includes('Edit') ||
             content.includes('Write') || content.includes('Grep') || content.includes('Glob')) {
      messageType = 'tool_call';
      category = 'secondary';
      importance = 'low';
    }
    // General planning and responses
    else {
      messageType = 'planning';
      category = 'primary';
      importance = 'medium';
    }
  }

  return {
    message,
    index,
    category,
    messageType,
    importance,
    isExitPlanMode
  };
};

const categorizeMessages = (messages: SessionMessage[]): CategorizedMessage[] => {
  return messages.map((message, index) => categorizeMessage(message, index));
};

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
  const [showSecondaryMessages, setShowSecondaryMessages] = useState(false);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading session...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
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

  const categorizedMessages = session.messages ? categorizeMessages(session.messages) : [];
  const primaryMessages = categorizedMessages.filter(m => m.category === 'primary');
  const secondaryMessages = categorizedMessages.filter(m => m.category === 'secondary');
  const userPrompts = primaryMessages.filter(m => m.messageType === 'user_prompt');
  const todoLists = primaryMessages.filter(m => m.messageType === 'todo_list');
  const finalizedPlans = categorizedMessages.filter(m => m.isExitPlanMode);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Back to Sessions
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={onCopyUrl}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Share Session
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Educational Overview */}
        <SessionOverview 
          session={session}
          userPrompts={userPrompts}
          todoLists={todoLists}
          finalizedPlans={finalizedPlans}
        />

        {/* Primary Content: Prompts & Planning */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Conversation Flow</h2>
            <span className="text-sm text-gray-500">
              {primaryMessages.length} key message{primaryMessages.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="space-y-4">
            {/* First show finalized plans */}
            {finalizedPlans.map((categorizedMsg) => (
              <EducationalMessageCard 
                key={categorizedMsg.index} 
                categorizedMessage={categorizedMsg}
              />
            ))}
            {/* Then show other primary messages */}
            {primaryMessages.filter(m => !m.isExitPlanMode).map((categorizedMsg) => (
              <EducationalMessageCard 
                key={categorizedMsg.index} 
                categorizedMessage={categorizedMsg}
              />
            ))}
          </div>
        </div>

        {/* Secondary Content: Implementation Details */}
        {secondaryMessages.length > 0 && (
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setShowSecondaryMessages(!showSecondaryMessages)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span className="text-lg font-medium">Implementation Details</span>
                <span className="text-sm">({secondaryMessages.length} technical messages)</span>
                <span className={`transform transition-transform ${showSecondaryMessages ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
            </div>
            
            {showSecondaryMessages && (
              <div className="space-y-2 bg-gray-50 rounded-lg p-4">
                {secondaryMessages.map((categorizedMsg) => (
                  <TechnicalMessageCard 
                    key={categorizedMsg.index} 
                    categorizedMessage={categorizedMsg}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionOverviewProps {
  session: ClaudeSession;
  userPrompts: CategorizedMessage[];
  todoLists: CategorizedMessage[];
  finalizedPlans: CategorizedMessage[];
}

interface EducationalMessageCardProps {
  categorizedMessage: CategorizedMessage;
}

interface TechnicalMessageCardProps {
  categorizedMessage: CategorizedMessage;
}

// Educational Session Overview Component
function SessionOverview({ session, userPrompts, todoLists, finalizedPlans }: SessionOverviewProps) {
  const [copied, setCopied] = useState(false);

  const copySessionSummary = () => {
    const summary = `Claude Code Session: ${session.title}

User Prompts:
${userPrompts.map((p, i) => `${i + 1}. ${p.message.content || p.message.summary}`).join('\n\n')}

${finalizedPlans.length > 0 ? `Finalized Plans:
${finalizedPlans.map((p, i) => `${i + 1}. ${p.message.content || p.message.summary}`).join('\n\n')}

` : ''}Key Planning & Todo Lists:
${todoLists.filter(t => !t.isExitPlanMode).map((t, i) => `${i + 1}. ${t.message.content || t.message.summary}`).join('\n\n')}

Session created: ${new Date(session.created_at).toLocaleString()}`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{session.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>{userPrompts.length} prompt{userPrompts.length !== 1 ? 's' : ''}</span>
            {finalizedPlans.length > 0 && (
              <span className="text-amber-600 font-medium">{finalizedPlans.length} finalized plan{finalizedPlans.length !== 1 ? 's' : ''}</span>
            )}
            <span>{todoLists.filter(t => !t.isExitPlanMode).length} planning message{todoLists.filter(t => !t.isExitPlanMode).length !== 1 ? 's' : ''}</span>
            <span>Created: {new Date(session.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <button
          onClick={copySessionSummary}
          className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
        >
          {copied ? '✓ Copied!' : 'Copy Summary'}
        </button>
      </div>

      {/* Quick Overview Cards */}
      <div className={`grid gap-4 ${finalizedPlans.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 mb-2">📝 User Prompts</h3>
          <div className="space-y-2">
            {userPrompts.slice(0, 2).map((prompt, i) => (
              <p key={i} className="text-sm text-green-700 line-clamp-2">
                {prompt.message.content || prompt.message.summary}
              </p>
            ))}
            {userPrompts.length > 2 && (
              <p className="text-xs text-green-600">+{userPrompts.length - 2} more prompts</p>
            )}
          </div>
        </div>

        {finalizedPlans.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4 ring-1 ring-amber-100">
            <h3 className="font-semibold text-amber-800 mb-2">🎯 Finalized Plans</h3>
            <div className="space-y-2">
              {finalizedPlans.slice(0, 2).map((plan, i) => (
                <p key={i} className="text-sm text-amber-700 line-clamp-2">
                  {plan.message.content || plan.message.summary}
                </p>
              ))}
              {finalizedPlans.length > 2 && (
                <p className="text-xs text-amber-600">+{finalizedPlans.length - 2} more finalized plans</p>
              )}
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">✅ Planning & Todos</h3>
          <div className="space-y-2">
            {todoLists.filter(t => !t.isExitPlanMode).slice(0, 2).map((todo, i) => (
              <p key={i} className="text-sm text-blue-700 line-clamp-2">
                {todo.message.content || todo.message.summary}
              </p>
            ))}
            {todoLists.filter(t => !t.isExitPlanMode).length > 2 && (
              <p className="text-xs text-blue-600">+{todoLists.filter(t => !t.isExitPlanMode).length - 2} more planning messages</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Educational Message Card for Primary Content
function EducationalMessageCard({ categorizedMessage }: EducationalMessageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const { message, messageType, importance, isExitPlanMode } = categorizedMessage;
  
  const content = message.content || message.summary || '';
  const PREVIEW_LENGTH = 300;
  const shouldShowExpansion = content.length > PREVIEW_LENGTH;
  const contentToShow = isExpanded || !shouldShowExpansion ? content : content.substring(0, PREVIEW_LENGTH) + '...';

  const getMessageStyle = () => {
    // Special styling for exit_plan_mode messages (finalized plans)
    if (isExitPlanMode) {
      return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-amber-400 shadow-md ring-1 ring-amber-200';
    }
    
    switch (messageType) {
      case 'user_prompt':
        return 'bg-green-50 border-l-4 border-green-400 shadow-sm';
      case 'todo_list':
        return 'bg-blue-50 border-l-4 border-blue-400 shadow-sm';
      case 'planning':
        return 'bg-purple-50 border-l-4 border-purple-400 shadow-sm';
      case 'summary':
        return 'bg-orange-50 border-l-4 border-orange-400 shadow-sm';
      default:
        return 'bg-gray-50 border-l-4 border-gray-400 shadow-sm';
    }
  };

  const getMessageIcon = () => {
    if (isExitPlanMode) {
      return '🎯'; // Special icon for finalized plans
    }
    
    switch (messageType) {
      case 'user_prompt': return '🗨️';
      case 'todo_list': return '✅';
      case 'planning': return '🧠';
      case 'summary': return '📋';
      default: return '💬';
    }
  };

  const getMessageLabel = () => {
    if (isExitPlanMode) {
      return 'Finalized Plan';
    }
    
    switch (messageType) {
      case 'user_prompt': return 'User Prompt';
      case 'todo_list': return 'Todo List & Planning';
      case 'planning': return 'Claude Planning';
      case 'summary': return 'Summary';
      default: return 'Message';
    }
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyJsonMessage = () => {
    const jsonData = message.raw || message;
    navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };

  return (
    <div className={`rounded-lg p-6 ${getMessageStyle()}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getMessageIcon()}</span>
          <span className="font-semibold text-gray-900">{getMessageLabel()}</span>
          {isExitPlanMode && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded font-medium animate-pulse">Approved Plan</span>
          )}
          {importance === 'high' && !isExitPlanMode && (
            <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded">Key</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded hover:bg-opacity-70 transition-colors"
          >
            {showRawJson ? 'Hide JSON' : 'View JSON'}
          </button>
          <button
            onClick={copyMessage}
            className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded hover:bg-opacity-70 transition-colors"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>
      
      <div className="prose prose-sm max-w-none">
        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
          {contentToShow}
        </div>
        
        {shouldShowExpansion && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Raw JSON View */}
      {showRawJson && (
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Raw Message Data</h4>
            <button
              onClick={copyJsonMessage}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
            >
              {jsonCopied ? '✓ Copied' : 'Copy JSON'}
            </button>
          </div>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(message.raw || message, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// Technical Message Card for Secondary Content
function TechnicalMessageCard({ categorizedMessage }: TechnicalMessageCardProps) {
  const { message, index } = categorizedMessage;
  const [showRawJson, setShowRawJson] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const content = message.content || message.summary || '';
  
  const copyJsonMessage = () => {
    const jsonData = message.raw || message;
    navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };
  
  return (
    <div className="bg-white border border-gray-200 rounded p-3 text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase">
          {message.type} #{index + 1}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
          >
            {showRawJson ? 'Hide' : 'JSON'}
          </button>
          {message.timestamp && (
            <span className="text-xs text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      <p className="text-gray-700 line-clamp-2">{content}</p>
      
      {/* Raw JSON View */}
      {showRawJson && (
        <div className="mt-3 border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-600">Raw Data</h4>
            <button
              onClick={copyJsonMessage}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
            >
              {jsonCopied ? '✓' : 'Copy'}
            </button>
          </div>
          <div className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-auto max-h-64">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(message.raw || message, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}