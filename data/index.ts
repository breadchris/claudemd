// Data Access Layer - Export all repositories
export { ClaudeDocRepository } from './ClaudeDocRepository';
export { StarRepository } from './StarRepository';
export { TagRepository } from './TagRepository';
export { UserRepository } from './UserRepository';
export { supabase, getCurrentUser, getCurrentSession } from './SupabaseClient';
export type { SupabaseClient } from './SupabaseClient';