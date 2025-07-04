export interface SessionMessage {
  type: string;
  summary?: string;
  leafUuid?: string;
}

export interface ClaudeSession {
  id: string;
  session_id: string;
  user_id?: string;
  title: string;
  messages: SessionMessage[];
  metadata?: {
    source_file?: string;
    last_synced?: string;
    line_count?: number;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface ClaudeSessionInsert {
  id: string;
  session_id: string;
  user_id?: string;
  title: string;
  messages: SessionMessage[];
  metadata?: {
    source_file?: string;
    last_synced?: string;
    line_count?: number;
    [key: string]: any;
  };
}

export interface ClaudeSessionUpdate {
  title?: string;
  messages?: SessionMessage[];
  metadata?: {
    source_file?: string;
    last_synced?: string;
    line_count?: number;
    [key: string]: any;
  };
}