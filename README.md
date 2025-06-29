# Supabase CLAUDE.md Platform

A complete CLAUDE.md sharing platform built with Supabase, React, and TypeScript featuring stratified architecture with clear separation of concerns.

## 🏗️ Architecture Overview

### Stratified Design Layers

1. **Data Access Layer** (`/data/`)
   - `SupabaseClient.ts` - Centralized Supabase client configuration
   - `ClaudeDocRepository.ts` - Document CRUD operations
   - `TagRepository.ts` - Tag management operations
   - `UserRepository.ts` - User profile operations
   - `StarRepository.ts` - Document starring operations

2. **Service Layer** (`/services/`)
   - `ClaudeDocService.ts` - Business logic for documents
   - `AuthService.ts` - Authentication and user management
   - `SearchService.ts` - Search and filtering logic
   - `TagService.ts` - Tag assignment and discovery

3. **Authentication Layer** (`/auth/`)
   - `AuthProvider.tsx` - React context for auth state
   - `useAuth.ts` - Custom hook for authentication
   - GitHub OAuth integration

4. **Custom Hooks** (`/hooks/`)
   - `useClaudeDocs.ts` - Document operations and state
   - `useTags.ts` - Tag management
   - `useSearch.ts` - Search functionality
   - `useRealtime.ts` - Real-time subscriptions

5. **UI Components** (`/components/`)
   - `ClaudeDocBrowser.tsx` - Document discovery interface
   - `ClaudeDocEditor.tsx` - Create/edit documents
   - `UserProfile.tsx` - User profile and document management
   - `ClaudeDocApp.tsx` - Main application wrapper

6. **Database Schema** (`/schema/`)
   - `migrations.sql` - Complete database schema with RLS policies

## 🚀 Quick Start

### 1. Database Setup

Run the SQL migrations in your Supabase dashboard:

```sql
-- Copy and paste the contents of schema/migrations.sql
-- This will create all tables, indexes, RLS policies, and triggers
```

### 2. Environment Configuration

The Supabase client is already configured with the provided credentials:

```typescript
// Already configured in data/SupabaseClient.ts
const SUPABASE_URL = 'https://qxbfhpisnafbwtrhekyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 3. GitHub OAuth Setup

1. Configure GitHub OAuth provider in Supabase Dashboard
2. Add your domain to allowed redirect URLs
3. The auth system will automatically handle user creation

### 4. Usage

```typescript
import { ClaudeDocApp } from './supabase';

// Main app component with everything included
export default function App() {
  return <ClaudeDocApp />;
}
```

## 📊 Database Schema

### Core Tables

- **`users`** - User profiles (extends Supabase auth.users)
- **`claude_docs`** - CLAUDE.md documents
- **`tags`** - Available tags
- **`claude_doc_tags`** - Many-to-many document-tag relationships
- **`claude_doc_stars`** - User starring records

### Key Features

- **Row Level Security (RLS)** - Automatic data access control
- **Automatic timestamps** - Created/updated timestamps
- **Cascading deletes** - Clean data removal
- **Full-text search** - Efficient document search
- **Star count maintenance** - Automatic counter updates

## 🔧 API Usage Examples

### Document Operations

```typescript
import { useClaudeDocs } from './supabase/hooks';

function DocumentList() {
  const {
    docs,
    loading,
    createDoc,
    updateDoc,
    deleteDoc,
    toggleStar
  } = useClaudeDocs({
    initialParams: { sort_by: 'stars' }
  });

  const handleCreate = async () => {
    await createDoc({
      title: 'My CLAUDE.md',
      content: '# Project Setup\n\nInstructions...',
      tag_names: ['typescript', 'react'],
      is_public: true
    });
  };

  // ... component implementation
}
```

### Authentication

```typescript
import { useAuth } from './supabase/auth';

function AuthButton() {
  const { user, signInWithGithub, signOut } = useAuth();

  return user ? (
    <button onClick={signOut}>Sign out @{user.username}</button>
  ) : (
    <button onClick={() => signInWithGithub()}>
      Sign in with GitHub
    </button>
  );
}
```

### Tag Management

```typescript
import { useTags } from './supabase/hooks';

function TagSelector() {
  const {
    tags,
    suggestions,
    getSuggestions,
    validateTagNames,
    getRecommendedTags
  } = useTags();

  // ... component implementation
}
```

### Real-time Features

```typescript
import { useDocumentRealtime } from './supabase/hooks';

function DocumentViewer({ docId }) {
  useDocumentRealtime(docId, (updatedDoc) => {
    console.log('Document updated:', updatedDoc);
    // Handle real-time updates
  });

  // ... component implementation
}
```

## 🔒 Security Features

### Row Level Security Policies

- **Users**: Can only view/edit their own profiles
- **Documents**: Public documents viewable by all, private by owner only
- **Tags**: Viewable by all, manageable by creator
- **Stars**: Users can only star/unstar for themselves

### Data Validation

- Input sanitization at service layer
- Type-safe operations with TypeScript
- Business logic validation before database operations

## 🎨 UI Features

### Responsive Design

- Mobile-first approach with Tailwind CSS
- Collapsible tag panels for mobile
- Responsive action buttons and layouts

### User Experience

- Optimistic updates for immediate feedback
- Loading states and error handling
- Tag suggestions and auto-complete
- Keyboard shortcuts and accessibility

## 🔄 Real-time Capabilities

### Live Updates

- Document view counts
- Star count changes
- New document notifications
- User activity tracking

### Subscriptions

```typescript
// Real-time document updates
useDocumentRealtime(docId, handleUpdate);

// Real-time star changes
useStarRealtime(docId, handleStarChange);

// Real-time document list updates
useDocumentListRealtime(handleListChange);
```

## 📈 Performance Optimizations

### Database

- Optimized indexes for search and filtering
- Efficient pagination with proper limits
- Full-text search indexes

### Frontend

- React lazy loading for components
- Optimistic updates for better UX
- Debounced search and tag suggestions
- Memoized hooks and callbacks

## 🛠️ Development

### Architecture Benefits

- **Clear separation of concerns** - Each layer has a single responsibility
- **Type safety** - Full TypeScript coverage
- **Testability** - Pure functions and isolated business logic
- **Scalability** - Easy to extend and modify individual layers
- **Maintainability** - Consistent patterns throughout

### Adding New Features

1. **Database**: Add tables/columns in schema
2. **Data Layer**: Create/update repository methods
3. **Service Layer**: Add business logic validation
4. **Hooks**: Create custom hooks for state management
5. **Components**: Build UI components with hooks

## 📝 License

This implementation is part of the CLAUDE.md sharing platform project.