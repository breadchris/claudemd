import { SessionRepository, type SessionSummary } from '../data/SessionRepository';
import type { ClaudeSession } from '../types/session';

describe('SessionRepository', () => {
  let repository: SessionRepository;

  beforeEach(() => {
    repository = new SessionRepository();
  });

  describe('getFirstUserMessage', () => {
    it('should return first user message from ClaudeSession with messages', () => {
      const session: ClaudeSession = {
        id: '1',
        session_id: 'session-1',
        title: 'Test Session',
        messages: [
          { type: 'system', content: 'System message' },
          { type: 'user', summary: 'First user message', content: 'Hello' },
          { type: 'assistant', content: 'Response' }
        ],
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const result = repository.getFirstUserMessage(session);
      expect(result).toBe('First user message');
    });

    it('should return title when no user messages in ClaudeSession', () => {
      const session: ClaudeSession = {
        id: '1',
        session_id: 'session-1',
        title: 'Test Session',
        messages: [
          { type: 'system', content: 'System message' },
          { type: 'assistant', content: 'Response' }
        ],
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const result = repository.getFirstUserMessage(session);
      expect(result).toBe('Test Session');
    });

    it('should handle SessionSummary without messages gracefully', () => {
      const summary: SessionSummary = {
        id: '1',
        session_id: 'session-1',
        title: 'Summary Session',
        message_count: 5,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const result = repository.getFirstUserMessage(summary);
      expect(result).toBe('Summary Session');
    });

    it('should return fallback message for SessionSummary without title', () => {
      const summary: SessionSummary = {
        id: '1',
        session_id: 'session-1',
        title: '',
        message_count: 0,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const result = repository.getFirstUserMessage(summary);
      expect(result).toBe('No message preview available');
    });

    it('should handle undefined messages array safely', () => {
      const session: any = {
        id: '1',
        session_id: 'session-1',
        title: 'Test Session',
        messages: undefined,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const result = repository.getFirstUserMessage(session);
      expect(result).toBe('Test Session');
    });
  });
});