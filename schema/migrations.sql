-- Supabase SQL migrations for CLAUDE.md platform
-- Based on the Go GORM models from models/models.go

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  email TEXT
);

-- Tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT UNIQUE NOT NULL,
  color TEXT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
);

-- Claude documents table
CREATE TABLE IF NOT EXISTS public.claude_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT true,
  downloads INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0
);

-- Claude document tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS public.claude_doc_tags (
  claude_doc_id UUID NOT NULL REFERENCES public.claude_docs(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (claude_doc_id, tag_id)
);

-- Claude document stars table
CREATE TABLE IF NOT EXISTS public.claude_doc_stars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  claude_doc_id UUID NOT NULL REFERENCES public.claude_docs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  UNIQUE(claude_doc_id, user_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_claude_docs_user_id ON public.claude_docs(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_docs_is_public ON public.claude_docs(is_public);
CREATE INDEX IF NOT EXISTS idx_claude_docs_created_at ON public.claude_docs(created_at);
CREATE INDEX IF NOT EXISTS idx_claude_docs_stars ON public.claude_docs(stars);
CREATE INDEX IF NOT EXISTS idx_claude_docs_views ON public.claude_docs(views);
CREATE INDEX IF NOT EXISTS idx_claude_docs_downloads ON public.claude_docs(downloads);
CREATE INDEX IF NOT EXISTS idx_tags_name ON public.tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_doc_stars_doc_id ON public.claude_doc_stars(claude_doc_id);
CREATE INDEX IF NOT EXISTS idx_claude_doc_stars_user_id ON public.claude_doc_stars(user_id);

-- Full-text search index for documents
CREATE INDEX IF NOT EXISTS idx_claude_docs_search ON public.claude_docs 
USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claude_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claude_doc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claude_doc_stars ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Claude documents policies
CREATE POLICY "Public documents are viewable by everyone" ON public.claude_docs
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their own documents" ON public.claude_docs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create documents" ON public.claude_docs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON public.claude_docs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON public.claude_docs
  FOR DELETE USING (auth.uid() = user_id);

-- Tags policies
CREATE POLICY "Tags are viewable by everyone" ON public.tags
  FOR SELECT USING (true);

CREATE POLICY "Users can create tags" ON public.tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Claude document tags policies
CREATE POLICY "Document tags are viewable if document is accessible" ON public.claude_doc_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.claude_docs cd 
      WHERE cd.id = claude_doc_id 
      AND (cd.is_public = true OR cd.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage tags for their own documents" ON public.claude_doc_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.claude_docs cd 
      WHERE cd.id = claude_doc_id 
      AND cd.user_id = auth.uid()
    )
  );

-- Claude document stars policies
CREATE POLICY "Users can view stars for accessible documents" ON public.claude_doc_stars
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.claude_docs cd 
      WHERE cd.id = claude_doc_id 
      AND (cd.is_public = true OR cd.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can star/unstar documents" ON public.claude_doc_stars
  FOR ALL USING (auth.uid() = user_id);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.claude_docs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to handle user creation from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$ language 'plpgsql' security definer;

-- Trigger to create user profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update star count when stars are added/removed
CREATE OR REPLACE FUNCTION public.update_document_star_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.claude_docs 
    SET stars = stars + 1 
    WHERE id = NEW.claude_doc_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.claude_docs 
    SET stars = stars - 1 
    WHERE id = OLD.claude_doc_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger to maintain star count
CREATE TRIGGER update_star_count
  AFTER INSERT OR DELETE ON public.claude_doc_stars
  FOR EACH ROW EXECUTE FUNCTION public.update_document_star_count();