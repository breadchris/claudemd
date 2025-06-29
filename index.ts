// Main Supabase CLAUDE.md Platform Entry Point
// Export everything from all layers

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