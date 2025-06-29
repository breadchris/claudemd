import React, { useState } from 'react';
import { AuthProvider } from '../auth';
import { ClaudeDocBrowser } from './ClaudeDocBrowser';
import { ClaudeDocEditor } from './ClaudeDocEditor';
import type { ClaudeDocResponse } from '../types/database';

type AppView = 'browser' | 'create' | 'edit';

export const ClaudeDocApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('browser');
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
    setCurrentView('browser');
    setEditingDocId(null);
  };

  const handleCancel = () => {
    setCurrentView('browser');
    setEditingDocId(null);
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        {currentView === 'browser' && (
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