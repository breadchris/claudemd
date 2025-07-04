package main

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/urfave/cli/v2"
)

type SessionMessage struct {
	Type      string                 `json:"type"`
	Summary   string                 `json:"summary,omitempty"`
	LeafUUID  string                 `json:"leafUuid,omitempty"`
	Message   map[string]interface{} `json:"message,omitempty"`
	Content   string                 `json:"content,omitempty"`   // Extracted content for easy access
	UUID      string                 `json:"uuid,omitempty"`
	Timestamp string                 `json:"timestamp,omitempty"`
}

// ClaudeSession represents a Claude Code session stored in PostgreSQL
type ClaudeSession struct {
	ID        string                 `json:"id"`
	SessionID string                 `json:"session_id"`
	UserID    *string                `json:"user_id,omitempty"`
	Title     string                 `json:"title"`
	Messages  []SessionMessage       `json:"messages"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

type ClaudeSessionSync struct {
	db          *sql.DB
	claudeDir   string
	syncedFiles map[string]time.Time
}

func NewClaudeSessionSync(db *sql.DB) *ClaudeSessionSync {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("Failed to get home directory: %v", err)
	}

	return &ClaudeSessionSync{
		db:          db,
		claudeDir:   filepath.Join(homeDir, ".claude"),
		syncedFiles: make(map[string]time.Time),
	}
}

func (c *ClaudeSessionSync) Start() error {
	// Initial sync of existing files
	if err := c.syncExistingFiles(); err != nil {
		return fmt.Errorf("failed to sync existing files: %w", err)
	}

	// Set up file watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("failed to create watcher: %w", err)
	}
	defer watcher.Close()

	// Watch all project directories
	projectsDir := filepath.Join(c.claudeDir, "projects")
	dirs, err := os.ReadDir(projectsDir)
	if err != nil {
		return fmt.Errorf("failed to read projects directory: %w", err)
	}

	for _, dir := range dirs {
		if dir.IsDir() {
			dirPath := filepath.Join(projectsDir, dir.Name())
			if err := watcher.Add(dirPath); err != nil {
				log.Printf("Failed to watch directory %s: %v", dirPath, err)
			}
		}
	}

	// Also watch the projects directory itself for new projects
	if err := watcher.Add(projectsDir); err != nil {
		return fmt.Errorf("failed to watch projects directory: %w", err)
	}

	log.Println("Claude session sync started, watching for changes...")

	// Process events
	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return nil
			}

			if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create {
				if strings.HasSuffix(event.Name, ".jsonl") {
					log.Printf("File changed: %s", event.Name)
					if err := c.syncFile(event.Name); err != nil {
						log.Printf("Failed to sync file %s: %v", event.Name, err)
					}
				} else if event.Op&fsnotify.Create == fsnotify.Create {
					// Check if it's a new directory
					info, err := os.Stat(event.Name)
					if err == nil && info.IsDir() {
						if err := watcher.Add(event.Name); err != nil {
							log.Printf("Failed to watch new directory %s: %v", event.Name, err)
						}
					}
				}
			}

		case err, ok := <-watcher.Errors:
			if !ok {
				return nil
			}
			log.Printf("Watcher error: %v", err)
		}
	}
}

func (c *ClaudeSessionSync) syncExistingFiles() error {
	projectsDir := filepath.Join(c.claudeDir, "projects")

	return filepath.Walk(projectsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && strings.HasSuffix(path, ".jsonl") {
			if err := c.syncFile(path); err != nil {
				log.Printf("Failed to sync file %s: %v", path, err)
			}
		}

		return nil
	})
}

// extractMessageContent extracts readable content from complex message structures
func extractMessageContent(msg SessionMessage) string {
	// If summary exists (for summary type), use it
	if msg.Summary != "" {
		return msg.Summary
	}
	
	// If no message data, return empty
	if msg.Message == nil {
		return ""
	}
	
	// Extract content from message field
	if content, ok := msg.Message["content"]; ok {
		switch c := content.(type) {
		case string:
			// User messages have content as string
			return c
		case []interface{}:
			// Assistant messages have content as array of content blocks
			var textParts []string
			for _, item := range c {
				if block, ok := item.(map[string]interface{}); ok {
					if blockType, ok := block["type"].(string); ok {
						switch blockType {
						case "text":
							if text, ok := block["text"].(string); ok {
								textParts = append(textParts, text)
							}
						case "tool_use":
							// Extract tool name and input for tool_use messages
							toolName := "unknown tool"
							if name, ok := block["name"].(string); ok {
								toolName = name
							}
							var inputDesc string
							if input, ok := block["input"].(map[string]interface{}); ok {
								// Try to extract meaningful description from input
								if desc, ok := input["description"].(string); ok {
									inputDesc = desc
								} else if prompt, ok := input["prompt"].(string); ok {
									inputDesc = prompt
								} else {
									inputDesc = "with parameters"
								}
							}
							textParts = append(textParts, fmt.Sprintf("Used %s %s", toolName, inputDesc))
						case "tool_result":
							// Extract tool result content
							if result, ok := block["content"].(string); ok {
								// Truncate very long results
								if len(result) > 200 {
									result = result[:200] + "..."
								}
								textParts = append(textParts, fmt.Sprintf("Tool result: %s", result))
							} else if _, ok := block["content"].([]interface{}); ok {
								// Handle structured results
								textParts = append(textParts, "Tool result received")
							}
						}
					}
				}
			}
			return strings.Join(textParts, " ")
		}
	}
	
	return ""
}

func (c *ClaudeSessionSync) syncFile(filePath string) error {
	// Check if file was recently synced
	if lastSync, ok := c.syncedFiles[filePath]; ok {
		info, err := os.Stat(filePath)
		if err != nil {
			return err
		}
		if !info.ModTime().After(lastSync) {
			return nil // File hasn't changed since last sync
		}
	}

	// Extract session ID from filename
	baseName := filepath.Base(filePath)
	sessionID := strings.TrimSuffix(baseName, ".jsonl")

	// Read the file
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	var messages []SessionMessage
	var title string

	scanner := bufio.NewScanner(file)
	// Increase buffer size to handle large JSON lines (10MB max)
	const maxTokenSize = 10 * 1024 * 1024 // 10MB
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, maxTokenSize)
	
	lineCount := 0
	for scanner.Scan() {
		lineCount++
		var msg SessionMessage
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			log.Printf("Failed to parse line %d in %s: %v", lineCount, filePath, err)
			continue
		}
		
		// Extract content for easy access
		msg.Content = extractMessageContent(msg)
		
		messages = append(messages, msg)

		// Use the first summary as the title
		if title == "" && msg.Type == "summary" && msg.Summary != "" {
			title = msg.Summary
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// If no title found, use a default
	if title == "" {
		title = fmt.Sprintf("Session %s", sessionID)
	}

	// Create or update the session in PostgreSQL
	session := ClaudeSession{
		SessionID: sessionID,
		Title:     title,
		Messages:  messages,
		Metadata: map[string]interface{}{
			"source_file": filePath,
			"last_synced": time.Now().Format(time.RFC3339),
			"line_count":  lineCount,
		},
	}

	// Try to upsert the session
	if err := c.upsertSession(session); err != nil {
		return fmt.Errorf("failed to save session to database: %w", err)
	}

	// Update sync timestamp
	c.syncedFiles[filePath] = time.Now()

	log.Printf("Synced session %s with %d messages", sessionID, len(messages))
	return nil
}

func (c *ClaudeSessionSync) upsertSession(session ClaudeSession) error {
	// Serialize messages and metadata to JSON
	messagesJSON, err := json.Marshal(session.Messages)
	if err != nil {
		return fmt.Errorf("failed to marshal messages: %w", err)
	}

	metadataJSON, err := json.Marshal(session.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Use PostgreSQL UPSERT (INSERT ... ON CONFLICT)
	query := `
		INSERT INTO claude_sessions (id, session_id, user_id, title, messages, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (session_id) DO UPDATE SET
			title = EXCLUDED.title,
			messages = EXCLUDED.messages,
			metadata = EXCLUDED.metadata,
			updated_at = EXCLUDED.updated_at
		RETURNING id, created_at`

	now := time.Now()
	sessionID := session.ID
	if sessionID == "" {
		sessionID = uuid.NewString()
	}

	var returnedID string
	var createdAt time.Time
	err = c.db.QueryRow(query, sessionID, session.SessionID, session.UserID, session.Title, string(messagesJSON), string(metadataJSON), now, now).Scan(&returnedID, &createdAt)
	if err != nil {
		return fmt.Errorf("failed to upsert session: %w", err)
	}

	return nil
}

// SyncAll performs a full sync of all Claude sessions
func (c *ClaudeSessionSync) SyncAll() error {
	return c.syncExistingFiles()
}

// InitializeDatabase sets up the database connection and runs migrations
func InitializeDatabase(config *Config) (*sql.DB, error) {
	db, err := sql.Open("postgres", config.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Create the table if it doesn't exist
	if err := createClaudeSessionsTable(db); err != nil {
		return nil, fmt.Errorf("failed to create table: %w", err)
	}

	log.Println("Database connection established and migrations completed")
	return db, nil
}

// createClaudeSessionsTable creates the claude_sessions table if it doesn't exist
func createClaudeSessionsTable(db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS claude_sessions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			session_id VARCHAR(255) UNIQUE NOT NULL,
			user_id UUID,
			title TEXT NOT NULL,
			messages JSONB NOT NULL DEFAULT '[]',
			metadata JSONB DEFAULT '{}',
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		);

		-- Create indexes for better performance
		CREATE INDEX IF NOT EXISTS idx_claude_sessions_session_id ON claude_sessions(session_id);
		CREATE INDEX IF NOT EXISTS idx_claude_sessions_user_id ON claude_sessions(user_id);
		CREATE INDEX IF NOT EXISTS idx_claude_sessions_created_at ON claude_sessions(created_at);
		CREATE INDEX IF NOT EXISTS idx_claude_sessions_title_gin ON claude_sessions USING gin(to_tsvector('english', title));

		-- Create trigger for updating updated_at timestamp
		CREATE OR REPLACE FUNCTION update_updated_at_column()
		RETURNS TRIGGER AS $$
		BEGIN
			NEW.updated_at = NOW();
			RETURN NEW;
		END;
		$$ language 'plpgsql';

		DROP TRIGGER IF EXISTS update_claude_sessions_updated_at ON claude_sessions;
		CREATE TRIGGER update_claude_sessions_updated_at
			BEFORE UPDATE ON claude_sessions
			FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
	`

	_, err := db.Exec(query)
	return err
}

// CLI command to sync Claude sessions
func syncSessionsCommand(c *cli.Context) error {
	// Load configuration
	config, err := LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Initialize database
	db, err := InitializeDatabase(config)
	if err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}

	sync := NewClaudeSessionSync(db)

	if c.Bool("watch") {
		log.Println("Starting Claude session sync in watch mode...")
		return sync.Start()
	} else {
		log.Println("Performing one-time sync of all Claude sessions...")
		return sync.SyncAll()
	}
}