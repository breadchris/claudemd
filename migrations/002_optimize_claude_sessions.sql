-- Migration: Optimize claude_sessions table for better query performance
-- Date: 2025-07-04
-- Description: Add JSONB indexes and computed columns to improve session query performance

-- Add GIN index for JSONB message content search
-- This will dramatically improve search performance within message content
CREATE INDEX IF NOT EXISTS idx_claude_sessions_messages_gin 
ON claude_sessions USING gin(messages);

-- Add computed column for message count to avoid expensive jsonb_array_length() calls
-- This is a GENERATED ALWAYS AS column that automatically updates when messages change
ALTER TABLE claude_sessions 
ADD COLUMN IF NOT EXISTS message_count INTEGER 
GENERATED ALWAYS AS (jsonb_array_length(messages)) STORED;

-- Add index on the new message_count column for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_claude_sessions_message_count 
ON claude_sessions(message_count);

-- Add composite index for common query patterns (user_id + created_at + message_count)
-- This will help with getting recent sessions for a user ordered by creation date
CREATE INDEX IF NOT EXISTS idx_claude_sessions_user_created_count 
ON claude_sessions(user_id, created_at DESC, message_count);

-- Add index for session ordering by update time with message count
-- This helps with "recently active" session queries
CREATE INDEX IF NOT EXISTS idx_claude_sessions_updated_count 
ON claude_sessions(updated_at DESC, message_count);

-- Analyze table to update statistics after adding indexes
ANALYZE claude_sessions;

-- Display optimization results
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'claude_sessions'
ORDER BY indexname;

-- Show table size and row count after optimization
SELECT 
    pg_size_pretty(pg_total_relation_size('claude_sessions')) as table_size,
    count(*) as row_count,
    avg(message_count) as avg_message_count,
    max(message_count) as max_message_count
FROM claude_sessions;