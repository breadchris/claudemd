import React, { useState } from 'react';
import { AuthProvider } from '../auth';
import { ClaudeDocBrowser } from './ClaudeDocBrowser';
import { ClaudeSessionBrowser } from './ClaudeSessionBrowser';
import { ClaudeDocEditor } from './ClaudeDocEditor';
import type { ClaudeDocResponse } from '../types/database';

type AppView = 'sessions' | 'documents' | 'create' | 'edit';

export const ClaudeDocApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('sessions');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setEditingDocId(null);
    setCurrentView('create');
  };

  const handleEdit = (docId: string) => {
    setEditingDocId(docId);
    setCurrentView('edit');
  };

  const handleSave = (doc: ClaudeDocResponse) => {
    console.log('Document saved:', doc);
    setCurrentView('sessions');
    setEditingDocId(null);
  };

  const handleCancel = () => {
    setCurrentView('sessions');
    setEditingDocId(null);
  };

  const handleViewSession = (sessionId: string) => {
    console.log('Viewing session:', sessionId);
    // Session viewing is handled within the ClaudeSessionBrowser component
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView('sessions')}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  currentView === 'sessions' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sessions
              </button>
              <button
                onClick={() => setCurrentView('documents')}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  currentView === 'documents' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Documents
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {currentView === 'sessions' && (
          <ClaudeSessionBrowser
            onViewSession={handleViewSession}
          />
        )}
        
        {currentView === 'documents' && (
          <ClaudeDocBrowser
            onCreateNew={handleCreateNew}
            onEdit={handleEdit}
          />
        )}
        
        {(currentView === 'create' || currentView === 'edit') && (
          <ClaudeDocEditor
            docId={editingDocId || undefined}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      </div>
    </AuthProvider>
  );
};

export default ClaudeDocApp;