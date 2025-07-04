package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Config struct {
	DatabaseURL string `json:"database_url"`
}

// LoadConfig loads configuration from data/config.json
func LoadConfig() (*Config, error) {
	configPath := filepath.Join("ignored", "config.json")
	
	// Check if config file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("config file not found at %s", configPath)
	}
	
	// Read config file
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}
	
	// Parse JSON
	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config JSON: %w", err)
	}
	
	// Validate required fields
	if config.DatabaseURL == "" {
		return nil, fmt.Errorf("database_url is required in config")
	}
	
	return &config, nil
}
