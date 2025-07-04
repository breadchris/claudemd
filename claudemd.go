package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/google/uuid"
	"github.com/urfave/cli/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type SessionMessage struct {
	Type     string `json:"type"`
	Summary  string `json:"summary,omitempty"`
	LeafUUID string `json:"leafUuid,omitempty"`
}

// ClaudeSession represents a Claude Code session stored in PostgreSQL
type ClaudeSession struct {
	ID        string                 `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	SessionID string                 `json:"session_id" gorm:"uniqueIndex;not null"`
	UserID    *string                `json:"user_id,omitempty" gorm:"type:uuid"`
	Title     string                 `json:"title" gorm:"not null"`
	Messages  []SessionMessage       `json:"messages" gorm:"type:jsonb;serializer:json"`
	Metadata  map[string]interface{} `json:"metadata,omitempty" gorm:"type:jsonb;serializer:json"`
	CreatedAt time.Time              `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time              `json:"updated_at" gorm:"autoUpdateTime"`
}

type ClaudeSessionSync struct {
	db          *gorm.DB
	claudeDir   string
	syncedFiles map[string]time.Time
}

func NewClaudeSessionSync(db *gorm.DB) *ClaudeSessionSync {
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
	lineCount := 0
	for scanner.Scan() {
		lineCount++
		var msg SessionMessage
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			log.Printf("Failed to parse line %d in %s: %v", lineCount, filePath, err)
			continue
		}
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
	// Check if session already exists
	var existing ClaudeSession
	result := c.db.Where("session_id = ?", session.SessionID).First(&existing)

	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			// Create new session
			session.ID = uuid.NewString()
			return c.db.Create(&session).Error
		}
		return result.Error
	}

	// Update existing session
	session.ID = existing.ID
	session.CreatedAt = existing.CreatedAt
	return c.db.Model(&existing).Updates(session).Error
}

// SyncAll performs a full sync of all Claude sessions
func (c *ClaudeSessionSync) SyncAll() error {
	return c.syncExistingFiles()
}

// InitializeDatabase sets up the database connection and runs migrations
func InitializeDatabase(config *Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(config.DatabaseURL), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto-migrate the schema
	if err := db.AutoMigrate(&ClaudeSession{}); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database connection established and migrations completed")
	return db, nil
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