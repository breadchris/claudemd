// Main Supabase CLAUDE.md Platform Entry Point
// Self-contained application with DOM rendering logic

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClaudeDocApp } from './components/ClaudeDocApp';

// Types
export type * from './types/database';

// Data Access Layer
export * from './data';

// Service Layer
export * from './services';

// Authentication Layer
export * from './auth';

// Custom Hooks
export * from './hooks';

// React Components
export * from './components';

// Default export - Main App Component
export { ClaudeDocApp as default } from './components/ClaudeDocApp';

// Auto-render application when module loads (for production builds)
if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    console.log('🚀 Initializing Supabase CLAUDE.md Platform...');
    
    try {
      const root = createRoot(rootElement);
      root.render(React.createElement(ClaudeDocApp));
      console.log('✅ Supabase CLAUDE.md Platform rendered successfully!');
    } catch (error) {
      console.error('❌ Failed to render Supabase CLAUDE.md Platform:', error);
      
      rootElement.innerHTML = `
        <div style="padding: 20px; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; margin: 20px; border-radius: 8px; font-family: monospace;">
          <h3>🚨 Error Loading Supabase CLAUDE.md Platform</h3>
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <pre>${error instanceof Error && error.stack ? error.stack : ''}</pre>
          <h4>🔧 Troubleshooting:</h4>
          <ul>
            <li>Check that all components are properly exported</li>
            <li>Verify Supabase configuration</li>
            <li>Check browser console for additional error details</li>
            <li>Try rebuilding the application</li>
          </ul>
        </div>
      `;
    }
  }
}