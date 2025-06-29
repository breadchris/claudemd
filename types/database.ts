import type { Database, Tables, TablesInsert, TablesUpdate } from './database.types';

// Base table types from generated schema
export type User = Tables<'users'>;
export type ClaudeDoc = Tables<'claude_docs'>;
export type Tag = Tables<'tags'>;
export type ClaudeDocStar = Tables<'claude_doc_stars'>;
export type ClaudeDocTag = Tables<'claude_doc_tags'>;

// Insert types
export type UserInsert = TablesInsert<'users'>;
export type ClaudeDocInsert = TablesInsert<'claude_docs'>;
export type TagInsert = TablesInsert<'tags'>;
export type ClaudeDocStarInsert = TablesInsert<'claude_doc_stars'>;
export type ClaudeDocTagInsert = TablesInsert<'claude_doc_tags'>;

// Update types
export type UserUpdate = TablesUpdate<'users'>;
export type ClaudeDocUpdate = TablesUpdate<'claude_docs'>;
export type TagUpdate = TablesUpdate<'tags'>;
export type ClaudeDocStarUpdate = TablesUpdate<'claude_doc_stars'>;
export type ClaudeDocTagUpdate = TablesUpdate<'claude_doc_tags'>;

// Extended response types with computed fields
export interface ClaudeDocResponse extends ClaudeDoc {
  author_name: string;
  author_username: string;
  is_starred: boolean;
  tag_names: string[];
}

export interface TagWithCount extends Tag {
  doc_count: number;
}

export interface UserWithStats extends User {
  total_docs: number;
  public_docs: number;
  private_docs: number;
  total_stars: number;
  total_views: number;
  total_downloads: number;
}

// Request types for API operations
export interface CreateClaudeDocRequest {
  title: string;
  description?: string;
  content?: string;
  is_public?: boolean;
  tag_names: string[];
}

export interface UpdateClaudeDocRequest {
  title?: string;
  description?: string;
  content?: string;
  is_public?: boolean;
  tag_names: string[];
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
}

// Response types for list operations
export interface ClaudeDocListResponse {
  docs: ClaudeDocResponse[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface TagListResponse {
  tags: TagWithCount[];
  total: number;
}

// Search and filter types
export interface SearchParams {
  query?: string;
  tags?: string[];
  page?: number;
  per_page?: number;
  sort_by?: 'created_at' | 'updated_at' | 'title' | 'stars' | 'views' | 'downloads';
  sort_order?: 'asc' | 'desc';
  user_id?: string;
  is_public?: boolean;
}

// Auth types
export interface AuthUser {
  id: string;
  username: string;
  created_at: string;
}

// Error types
export interface DatabaseError {
  message: string;
  code?: string;
  details?: any;
}

// Activity types
export interface UserActivity {
  id: string;
  title: string;
  created_at: string;
  action: 'created' | 'updated';
}

// Statistics types
export interface UserStats {
  total_docs: number;
  public_docs: number;
  private_docs: number;
  total_stars: number;
  total_views: number;
  total_downloads: number;
}

export interface DocumentStats {
  views: number;
  downloads: number;
  stars: number;
}

// Star statistics
export interface StarStats {
  count: number;
  isStarred: boolean;
}

export type StarStatsMap = Record<string, StarStats>;

// Export database type for direct access
export type { Database } from './database.types';