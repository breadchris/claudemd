// Mock Supabase client for testing without actual Supabase dependencies

export interface MockUser {
  id: string;
  email?: string;
  user_metadata?: any;
}

export interface MockSession {
  user: MockUser;
  access_token: string;
}

export interface MockAuthResponse {
  data: { user: MockUser | null; session: MockSession | null };
  error: any;
}

export interface MockSubscription {
  unsubscribe: () => void;
}

class MockSupabaseClient {
  private currentUser: MockUser | null = null;
  private currentSession: MockSession | null = null;
  private authCallbacks: Array<(event: string, session: MockSession | null) => void> = [];

  auth = {
    getUser: async (): Promise<{ data: { user: MockUser | null }; error: any }> => {
      return {
        data: { user: this.currentUser },
        error: null
      };
    },

    getSession: async (): Promise<{ data: { session: MockSession | null }; error: any }> => {
      return {
        data: { session: this.currentSession },
        error: null
      };
    },

    signInWithOAuth: async ({ provider }: { provider: string }): Promise<{ data: any; error: any }> => {
      // Simulate GitHub OAuth
      if (provider === 'github') {
        const mockUser: MockUser = {
          id: 'mock-user-id',
          email: 'user@example.com',
          user_metadata: {
            user_name: 'mockuser',
            avatar_url: 'https://github.com/mockuser.png'
          }
        };

        const mockSession: MockSession = {
          user: mockUser,
          access_token: 'mock-access-token'
        };

        this.currentUser = mockUser;
        this.currentSession = mockSession;

        // Notify callbacks
        this.authCallbacks.forEach(callback => {
          callback('SIGNED_IN', mockSession);
        });

        return { data: mockSession, error: null };
      }

      return { data: null, error: { message: 'Unsupported provider' } };
    },

    signOut: async (): Promise<{ error: any }> => {
      this.currentUser = null;
      this.currentSession = null;

      // Notify callbacks
      this.authCallbacks.forEach(callback => {
        callback('SIGNED_OUT', null);
      });

      return { error: null };
    },

    onAuthStateChange: (callback: (event: string, session: MockSession | null) => void) => {
      this.authCallbacks.push(callback);
      
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const index = this.authCallbacks.indexOf(callback);
              if (index > -1) {
                this.authCallbacks.splice(index, 1);
              }
            }
          }
        }
      };
    }
  };

  from(table: string) {
    return new MockQueryBuilder(table);
  }

  channel(name: string) {
    return new MockRealtimeChannel(name);
  }

  removeChannel(channel: any) {
    // Mock implementation
  }
}

class MockQueryBuilder {
  constructor(private table: string) {}

  select(columns: string = '*') {
    return this;
  }

  insert(data: any) {
    return this;
  }

  update(data: any) {
    return this;
  }

  delete() {
    return this;
  }

  eq(column: string, value: any) {
    return this;
  }

  in(column: string, values: any[]) {
    return this;
  }

  ilike(column: string, pattern: string) {
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    return this;
  }

  range(from: number, to: number) {
    return this;
  }

  limit(count: number) {
    return this;
  }

  single() {
    return this;
  }

  async then(resolve: (result: any) => void, reject?: (error: any) => void) {
    // Mock implementation - return empty data
    const result = {
      data: this.table === 'users' ? mockUsers : 
            this.table === 'claude_docs' ? mockDocs : 
            this.table === 'tags' ? mockTags : [],
      error: null,
      count: 0
    };
    
    if (resolve) {
      resolve(result);
    }
    
    return result;
  }
}

class MockRealtimeChannel {
  constructor(private name: string) {}

  on(event: string, options: any, callback: (payload: any) => void) {
    // Mock implementation - don't actually subscribe
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    // Mock successful subscription
    if (callback) {
      setTimeout(() => callback('SUBSCRIBED'), 100);
    }
    return this;
  }
}

// Mock data
const mockUsers = [
  {
    id: 'mock-user-id',
    username: 'mockuser',
    avatar_url: 'https://github.com/mockuser.png',
    email: 'user@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const mockDocs = [
  {
    id: 'doc-1',
    title: 'React TypeScript Setup',
    description: 'Complete guide for setting up React with TypeScript',
    content: '# React TypeScript Setup\n\nThis guide will help you...',
    user_id: 'mock-user-id',
    is_public: true,
    stars: 42,
    views: 150,
    downloads: 25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const mockTags = [
  { id: 'tag-1', name: 'react', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_id: 'mock-user-id' },
  { id: 'tag-2', name: 'typescript', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_id: 'mock-user-id' },
  { id: 'tag-3', name: 'supabase', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_id: 'mock-user-id' }
];

// Export the mock client instance
export const mockSupabase = new MockSupabaseClient();

// Mock functions
export const getCurrentUser = async () => {
  const { data } = await mockSupabase.auth.getUser();
  return data.user;
};

export const getCurrentSession = async () => {
  const { data } = await mockSupabase.auth.getSession();
  return data.session;
};

export type { MockUser as User, MockSession as Session };