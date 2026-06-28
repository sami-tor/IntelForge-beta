package search

import (
	"bufio"
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
	_ "github.com/lib/pq"
)

// InitDB initializes database connection
func InitDB(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return db, nil
}

// FileIndex stores metadata about indexed files
type FileIndex struct {
	FilePath    string
	FileName    string
	FileSize    int64
	LineCount   int
	ContentHash string
	IndexedAt   time.Time
	Lines       []string // First 100 lines for preview
}

// SearchResult represents a single search hit
type SearchResult struct {
	FilePath string
	FileName string
	LineNum  int
	Content  string
	Preview  string // Context around the match
}

// Indexer manages the search index
type Indexer struct {
	DataRoot    string
	db          *sql.DB
	dbSemaphore chan struct{} // Semaphore to limit concurrent DB operations
}

// NewIndexer creates a new search indexer
func NewIndexer(dataRoot string, db *sql.DB) *Indexer {
	return &Indexer{
		DataRoot:    dataRoot,
		db:           db,
		dbSemaphore: make(chan struct{}, 15), // Limit to 15 concurrent DB transactions
	}
}

// IndexFiles walks through the data directory and indexes all files in parallel
func (idx *Indexer) IndexFiles(ctx context.Context) error {
	logger.Infof("starting file indexing from %s", idx.DataRoot)

	// Collect all files first
	var filesToIndex []string
	err := filepath.Walk(idx.DataRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			logger.Warnf("error accessing file %s: %v", path, err)
			return nil
		}

		// Skip directories
		if info.IsDir() {
			name := info.Name()
			if name == ".git" || name == "node_modules" || name == ".next" ||
				name == "demo" || name == "test" || name == ".demo" ||
				name == "__pycache__" || name == ".cache" {
				return filepath.SkipDir
			}
			return nil
		}

		// Skip hidden files
		baseName := filepath.Base(path)
		if strings.HasPrefix(baseName, ".") {
			return nil
		}

		filesToIndex = append(filesToIndex, path)
		return nil
	})

	if err != nil {
		return fmt.Errorf("walk directory: %w", err)
	}

	logger.Infof("found %d files to index, starting parallel processing...", len(filesToIndex))

	// Use atomic counters for thread-safe counting
	var fileCount int64
	var errorCount int64
	var skippedCount int64

	// Worker pool: process files in parallel (reduced to avoid DB connection exhaustion)
	numWorkers := 4 // Process 4 files concurrently (reduced from 8)
	if len(filesToIndex) < numWorkers {
		numWorkers = len(filesToIndex)
	}

	fileChan := make(chan string, len(filesToIndex))
	var wg sync.WaitGroup

	// Start workers
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for path := range fileChan {
				idx.processFile(ctx, path, &fileCount, &errorCount, &skippedCount, workerID)
			}
		}(i)
	}

	// Send files to workers
	for _, path := range filesToIndex {
		fileChan <- path
	}
	close(fileChan)

	// Wait for all workers to finish
	wg.Wait()

	logger.Infof("indexing completed: %d files indexed, %d errors, %d skipped", 
		atomic.LoadInt64(&fileCount), 
		atomic.LoadInt64(&errorCount), 
		atomic.LoadInt64(&skippedCount))
	return nil
}

// processFile processes a single file (called by worker goroutines)
func (idx *Indexer) processFile(ctx context.Context, path string, fileCount, errorCount, skippedCount *int64, workerID int) {
	// Check if file exists
	if _, statErr := os.Stat(path); statErr != nil {
		logger.Warnf("[worker %d] error getting file info %s: %v", workerID, path, statErr)
		atomic.AddInt64(errorCount, 1)
		return
	}

	fileName := filepath.Base(path)
	ext := strings.ToLower(filepath.Ext(path))

	// ONLY index .7z and .rar files - skip everything else
	if ext != ".7z" && ext != ".rar" {
		logger.Infof("[worker %d] skipping %s (not a 7z or rar file)", workerID, fileName)
		atomic.AddInt64(skippedCount, 1)
		return
	}

	// Index file metadata
	if err := idx.indexFile(ctx, path); err != nil {
		logger.Warnf("[worker %d] error indexing file metadata %s: %v", workerID, fileName, err)
		atomic.AddInt64(errorCount, 1)
		return
	}

	// Index archive files (only .7z and .rar)
	if err := idx.IndexArchive(ctx, path); err != nil {
		logger.Warnf("[worker %d] error indexing archive %s: %v", workerID, fileName, err)
		atomic.AddInt64(errorCount, 1)
	} else {
		atomic.AddInt64(fileCount, 1)
		// Delete archive after successful indexing
		maxRetries := 3
		for i := 0; i < maxRetries; i++ {
			if err := os.Remove(path); err != nil {
				if i < maxRetries-1 {
					time.Sleep(time.Second * time.Duration(i+1))
				}
			} else {
				logger.Infof("[worker %d] deleted archive %s after successful indexing", workerID, fileName)
				break
			}
		}
	}
}

// indexFile indexes a single file
func (idx *Indexer) indexFile(ctx context.Context, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer file.Close()

	info, _ := file.Stat()
	scanner := bufio.NewScanner(file)

	var lines []string
	var lineCount int

	// Read file and store lines
	for scanner.Scan() && lineCount < 10000 {
		line := scanner.Text()
		lines = append(lines, line)
		lineCount++
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan file: %w", err)
	}

	// Store index in PostgreSQL
	relPath, _ := filepath.Rel(idx.DataRoot, filePath)
	fileName := filepath.Base(filePath)

	query := `
		INSERT INTO search_index (file_path, file_name, file_size, line_count, indexed_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (file_path) DO UPDATE SET
			file_size = $3,
			line_count = $4,
			indexed_at = $5
	`

	_, err = idx.db.ExecContext(ctx, query, relPath, fileName, info.Size(), lineCount, time.Now())
	if err != nil {
		return fmt.Errorf("insert into db: %w", err)
	}

	logger.Debugf("indexed file: %s (%d lines)", fileName, lineCount)
	return nil
}

// SearchFiles searches for a query across all indexed files
func (idx *Indexer) SearchFiles(ctx context.Context, query string, limit int) ([]SearchResult, error) {
	var results []SearchResult

	// Get all indexed files from database
	rows, err := idx.db.QueryContext(ctx, `
		SELECT file_path, file_name, line_count
		FROM search_index
		ORDER BY indexed_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("query index: %w", err)
	}
	defer rows.Close()

	queryLower := strings.ToLower(query)
	resultCount := 0
	maxResults := limit
	fileResultsCount := make(map[string]int) // Track results per file

	for rows.Next() {
		if resultCount >= maxResults {
			break
		}

		var filePath, fileName string
		var lineCount int
		if err := rows.Scan(&filePath, &fileName, &lineCount); err != nil {
			continue
		}

		fullPath := filepath.Join(idx.DataRoot, filePath)
		file, err := os.Open(fullPath)
		if err != nil {
			continue
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		lineNum := 0
		fileResults := 0

		for scanner.Scan() && resultCount < maxResults {
			lineNum++
			content := scanner.Text()
			contentLower := strings.ToLower(content)

			// Enforce per-file result limit (5 results per file for free users)
			if fileResults >= 5 && len(fileResultsCount) > 0 {
				continue
			}

			if strings.Contains(contentLower, queryLower) {
				result := SearchResult{
					FilePath: filePath,
					FileName: fileName,
					LineNum:  lineNum,
					Content:  content,
					Preview:  generatePreview(content, query),
				}
				results = append(results, result)
				resultCount++
				fileResults++
				fileResultsCount[filePath]++
			}
		}
	}

	return results, nil
}

// generatePreview creates a preview of the matching line
func generatePreview(line string, query string) string {
	if len(line) > 200 {
		// Find the query in the line and center around it
		idx := strings.Index(strings.ToLower(line), strings.ToLower(query))
		if idx >= 0 {
			start := idx - 50
			if start < 0 {
				start = 0
			}
			end := idx + len(query) + 50
			if end > len(line) {
				end = len(line)
			}
			return "..." + line[start:end] + "..."
		}
		return line[:200] + "..."
	}
	return line
}
