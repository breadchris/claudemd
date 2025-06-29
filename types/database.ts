export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          username: string;
          avatar_url?: string;
          email?: string;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string;
          username: string;
          avatar_url?: string;
          email?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          username?: string;
          avatar_url?: string;
          email?: string;
        };
      };
      claude_docs: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          title: string;
          description?: string;
          content: string;
          user_id: string;
          is_public: boolean;
          downloads: number;
          stars: number;
          views: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          title: string;
          description?: string;
          content: string;
          user_id: string;
          is_public?: boolean;
          downloads?: number;
          stars?: number;
          views?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          title?: string;
          description?: string;
          content?: string;
          user_id?: string;
          is_public?: boolean;
          downloads?: number;
          stars?: number;
          views?: number;
        };
      };
      tags: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          color?: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          color?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name?: string;
          color?: string;
          user_id?: string;
        };
      };
      claude_doc_tags: {
        Row: {
          claude_doc_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          claude_doc_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          claude_doc_id?: string;
          tag_id?: string;
          created_at?: string;
        };
      };
      claude_doc_stars: {
        Row: {
          id: string;
          created_at: string;
          claude_doc_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          claude_doc_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          claude_doc_id?: string;
          user_id?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Application types that match the Go models
export interface User {
  id: string;
  created_at: string;
  updated_at: string;
  username: string;
  avatar_url?: string;
  email?: string;
}

export interface ClaudeDoc {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description?: string;
  content: string;
  user_id: string;
  is_public: boolean;
  downloads: number;
  stars: number;
  views: number;
}

export interface Tag {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  color?: string;
  user_id: string;
}

export interface ClaudeDocTag {
  claude_doc_id: string;
  tag_id: string;
  created_at: string;
}

export interface ClaudeDocStar {
  id: string;
  created_at: string;
  claude_doc_id: string;
  user_id: string;
}

// Extended types for API responses (matches Go ClaudeDocResponse)
export interface ClaudeDocResponse extends ClaudeDoc {
  author_name: string;
  author_username: string;
  is_starred: boolean;
  tag_names: string[];
}

export interface ClaudeDocListResponse {
  docs: ClaudeDocResponse[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Request types for API operations
export interface CreateClaudeDocRequest {
  title: string;
  description?: string;
  content: string;
  tag_names: string[];
  is_public: boolean;
}

export interface UpdateClaudeDocRequest {
  title: string;
  description?: string;
  content: string;
  tag_names: string[];
  is_public: boolean;
}

export interface SearchParams {
  query?: string;
  tags?: string[];
  page?: number;
  per_page?: number;
  sort_by?: 'created_at' | 'stars' | 'views' | 'downloads';
}