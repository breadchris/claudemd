export interface SessionMessage {
  type: string;
  summary?: string;
  content?: string;
  leafUuid?: string;
  timestamp?: string;
  // Raw message data for JSON view
  raw?: any; // Complete original message data from Claude session files
}

export interface CategorizedMessage {
  message: SessionMessage;
  index: number;
  category: 'primary' | 'secondary';
  messageType: 'user_prompt' | 'todo_list' | 'planning' | 'tool_call' | 'summary' | 'other';
  importance: 'high' | 'medium' | 'low';
  isExitPlanMode?: boolean; // Indicates finalized todo plans
}

export interface ClaudeSession {
  id: string;
  session_id: string;
  user_id?: string;
  title: string;
  messages: SessionMessage[];
  message_count?: number; // Computed field for optimization
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