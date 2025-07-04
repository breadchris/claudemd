-- Claude Sessions table for storing synced Claude Code sessions
CREATE TABLE IF NOT EXISTS public.claude_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_claude_sessions_session_id ON public.claude_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_claude_sessions_user_id ON public.claude_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_sessions_created_at ON public.claude_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_sessions_title ON public.claude_sessions USING gin(to_tsvector('english', title));

-- Enable Row Level Security
ALTER TABLE public.claude_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view all public sessions and their own sessions
CREATE POLICY "Users can view claude sessions" ON public.claude_sessions
    FOR SELECT USING (
        user_id IS NULL OR 
        user_id = auth.uid()
    );

-- Policy: Authenticated users can insert their own sessions
CREATE POLICY "Authenticated users can insert claude sessions" ON public.claude_sessions
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND
        (user_id IS NULL OR user_id = auth.uid())
    );

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update their own claude sessions" ON public.claude_sessions
    FOR UPDATE USING (
        user_id = auth.uid()
    ) WITH CHECK (
        user_id = auth.uid()
    );

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete their own claude sessions" ON public.claude_sessions
    FOR DELETE USING (
        user_id = auth.uid()
    );

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_claude_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER trigger_update_claude_sessions_updated_at
    BEFORE UPDATE ON public.claude_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_claude_sessions_updated_at();

-- Grant appropriate permissions
GRANT SELECT ON public.claude_sessions TO anon;
GRANT ALL ON public.claude_sessions TO authenticated;
GRANT ALL ON public.claude_sessions TO service_role;