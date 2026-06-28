package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/intelforge/platform/indexer/internal/logger"
	"github.com/intelforge/platform/indexer/internal/search"
)

// loadEnv loads environment variables from .env.local file
func loadEnv(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return fmt.Errorf("open .env file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var envCount int
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Remove BOM if present (UTF-8 BOM: \ufeff)
		if len(line) > 0 && rune(line[0]) == '\ufeff' {
			line = line[1:]
		}
		// Better: use strings.TrimPrefix for BOM
		line = strings.TrimPrefix(line, "\ufeff")
		line = strings.TrimSpace(line)

		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Parse KEY=VALUE
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Remove quotes if present
		if strings.HasPrefix(value, `"`) && strings.HasSuffix(value, `"`) {
			value = value[1 : len(value)-1]
		}

		// Set environment variable
		os.Setenv(key, value)
		envCount++

		// Log first 5 and DATABASE_URL
		if envCount <= 5 || key == "DATABASE_URL" {
			logger.Infof("  [%s] = %s", key, value)
		}
	}

	logger.Infof("loaded %d environment variables total", envCount)

	// Verify DATABASE_URL was set
	testURL := os.Getenv("DATABASE_URL")
	logger.Infof("verifying: DATABASE_URL after load = [%s]", testURL)

	return scanner.Err()
}

func main() {
	logger.Infof("starting file indexer")

	// Get current working directory
	cwd, _ := os.Getwd()
	logger.Infof("working directory: %s", cwd)

	// Load .env.local file - try multiple locations
	envPaths := []string{
		".env.local",
		filepath.Join(cwd, ".env.local"),
		"/app/.env.local",
		"C:\\Users\\Administrator\\Desktop\\code\\.env.local",
	}

	var envLoaded bool
	for _, envPath := range envPaths {
		if _, err := os.Stat(envPath); err == nil {
			logger.Infof("loading env from: %s", envPath)
			if err := loadEnv(envPath); err != nil {
				logger.Warnf("failed to load %s: %v", envPath, err)
			} else {
				envLoaded = true
				logger.Infof("✓ env file loaded successfully")
				break
			}
		}
	}

	if !envLoaded {
		logger.Warnf("could not load .env.local from any location")
	}

	// Get database URL from environment
	databaseURL := os.Getenv("DATABASE_URL")
	logger.Infof("DATABASE_URL from getenv: [%s] (len=%d)", databaseURL, len(databaseURL))
	if databaseURL == "" {
		logger.Errorf("DATABASE_URL environment variable not set")
		os.Exit(1)
	}

	// Get data directories from environment (comma-separated)
	dataDirsEnv := os.Getenv("DATA_DIRECTORIES")
	if dataDirsEnv == "" {
		// Default to ./data
		dataDirsEnv = "./data"
	}

	// Parse comma-separated directories
	dataDirs := strings.Split(dataDirsEnv, ",")
	var validDirs []string

	for _, dir := range dataDirs {
		dir = strings.TrimSpace(dir)
		// Resolve relative paths
		absDir, err := filepath.Abs(dir)
		if err != nil {
			logger.Warnf("failed to resolve directory %s: %v", dir, err)
			continue
		}

		// Check if directory exists
		if _, err := os.Stat(absDir); os.IsNotExist(err) {
			logger.Warnf("data directory does not exist: %s", absDir)
			continue
		}

		validDirs = append(validDirs, absDir)
		logger.Infof("indexing files from %s", absDir)
	}

	if len(validDirs) == 0 {
		logger.Errorf("no valid data directories found")
		os.Exit(1)
	}

	// Connect to database
	db, err := search.InitDB(databaseURL)
	if err != nil {
		logger.Errorf("failed to connect to database: %v", err)
		os.Exit(1)
	}
	defer db.Close()

	// Create indexer
	indexer := search.NewIndexer("", db) // Empty string means we'll process each dir separately

	// Index all valid directories
	for _, dataDir := range validDirs {
		indexer.DataRoot = dataDir
		logger.Infof("indexing files from %s", dataDir)
		if err := indexer.IndexFiles(context.Background()); err != nil {
			logger.Warnf("error indexing directory %s: %v", dataDir, err)
		}
	}

	logger.Infof("indexing complete")
}
