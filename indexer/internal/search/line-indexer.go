package search

import (
	"bufio"
	"context"
	"crypto/md5"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
)

// IndexFileLines indexes every line from a file into the database
// This allows instant search without scanning files
func (idx *Indexer) IndexFileLines(ctx context.Context, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer file.Close()

	info, _ := file.Stat()
	relPath, _ := filepath.Rel(idx.DataRoot, filePath)
	fileName := filepath.Base(filePath)

	// Extract file type
	fileType := strings.TrimPrefix(filepath.Ext(fileName), ".")
	if fileType == "" {
		fileType = "txt"
	}

	// Extract country from path (e.g., Countries/India/file.csv -> India)
	country := extractCountryFromPath(relPath)

	// Create scanner with larger buffer to handle very long lines (up to 10MB per line)
	scanner := bufio.NewScanner(file)
	buf := make([]byte, 0, 64*1024) // Initial buffer 64KB
	maxCapacity := 10 * 1024 * 1024 // Max 10MB per line
	scanner.Buffer(buf, maxCapacity)

	lineNum := 0
	batchSize := 5000 // Increased batch size for faster indexing (was 1000)
	var batch []map[string]interface{}

	// Use smaller transactions to avoid full abort on errors
	// Process in smaller batches with individual transactions

	// Track inserted hashes in this transaction to avoid duplicates within same file
	insertedHashes := make(map[string]bool)

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		// Clean the line: remove null bytes and trim
		line = strings.ReplaceAll(line, "\x00", "") // Remove null bytes
		line = strings.TrimSpace(line)

		// Skip empty lines
		if line == "" {
			continue
		}

		// Validate UTF-8 encoding (skip invalid lines)
		if !isValidUTF8(line) {
			logger.Warnf("skipping line %d in %s: invalid UTF-8", lineNum, fileName)
			continue
		}

		// Create hash for deduplication (includes file path to allow same content in different files)
		hash := md5.Sum([]byte(line + relPath + fmt.Sprintf("%d", lineNum)))
		contentHash := fmt.Sprintf("%x", hash)

		// Skip if already in this batch (same file, same line)
		if insertedHashes[contentHash] {
			continue
		}

		insertedHashes[contentHash] = true

		// Note: Duplicate check is done in INSERT statement (WHERE NOT EXISTS)

		// Add to batch
		batch = append(batch, map[string]interface{}{
			"file_path":    relPath,
			"file_name":    fileName,
			"line_number":  lineNum,
			"content":      line,
			"content_hash": contentHash,
			"file_type":    fileType,
			"country":      country,
			"indexed_at":   time.Now(),
		})

		// Insert batch when full (use individual transactions per batch)
		if len(batch) >= batchSize {
			// Acquire semaphore before database operation
			idx.dbSemaphore <- struct{}{}
			if err := idx.insertBatchWithTransaction(ctx, batch); err != nil {
				logger.Warnf("error inserting batch: %v (continuing with next batch)", err)
			}
			<-idx.dbSemaphore // Release semaphore
			batch = batch[:0] // Clear batch
		}
	}

	// Insert remaining batch
	if len(batch) > 0 {
		// Acquire semaphore before database operation
		idx.dbSemaphore <- struct{}{}
		if err := idx.insertBatchWithTransaction(ctx, batch); err != nil {
			logger.Warnf("error inserting final batch: %v", err)
		}
		<-idx.dbSemaphore // Release semaphore
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan file: %w", err)
	}

	// Also update the file metadata in search_index table
	query := `
		INSERT INTO search_index (file_path, file_name, file_size, line_count, indexed_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (file_path) DO UPDATE SET
			file_size = $3,
			line_count = $4,
			indexed_at = $5
	`
	_, err = idx.db.ExecContext(ctx, query, relPath, fileName, info.Size(), lineNum, time.Now())
	if err != nil {
		logger.Warnf("error updating file metadata: %v", err)
	}

	logger.Infof("indexed %d lines from %s", lineNum, fileName)
	return nil
}

// insertBatchWithTransaction inserts a batch using a new transaction
// Optimized for speed with larger batches and single transaction
func (idx *Indexer) insertBatchWithTransaction(ctx context.Context, batch []map[string]interface{}) error {
	if len(batch) == 0 {
		return nil
	}

	// Start new transaction for this batch
	tx, err := idx.db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Prepare statement once for the entire batch
	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO search_index_lines 
			(file_path, file_name, line_number, content, content_hash, file_type, country, indexed_at)
		SELECT $1, $2, $3, $4, $5, $6, $7, $8
		WHERE NOT EXISTS (
			SELECT 1 FROM search_index_lines 
			WHERE file_path = $1 
			AND line_number = $3 
			AND content_hash = $5
		)
	`)
	if err != nil {
		return fmt.Errorf("prepare statement: %w", err)
	}
	defer stmt.Close()

	successCount := 0
	errorCount := 0

	// Insert all lines in the batch (single transaction = faster)
	for _, item := range batch {
		_, err := stmt.ExecContext(ctx,
			item["file_path"],
			item["file_name"],
			item["line_number"],
			item["content"],
			item["content_hash"],
			item["file_type"],
			item["country"],
			item["indexed_at"],
		)
		if err != nil {
			errorCount++
			// Skip errors for duplicates and invalid UTF-8
			if !strings.Contains(err.Error(), "duplicate") &&
				!strings.Contains(err.Error(), "already exists") &&
				!strings.Contains(err.Error(), "invalid byte sequence") {
				// Only log non-expected errors
			}
		} else {
			successCount++
		}
	}

	// Commit if at least some succeeded
	if successCount > 0 {
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit transaction: %w", err)
		}
	} else {
		tx.Rollback()
		if errorCount > 0 {
			return fmt.Errorf("all %d inserts failed", errorCount)
		}
	}

	return nil
}

// isValidUTF8 checks if a string is valid UTF-8
func isValidUTF8(s string) bool {
	return strings.ToValidUTF8(s, "") == s
}

// IndexFileLinesChunked indexes large files in chunks to avoid memory issues
func (idx *Indexer) IndexFileLinesChunked(ctx context.Context, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer file.Close()

	info, _ := file.Stat()
	relPath, _ := filepath.Rel(idx.DataRoot, filePath)
	fileName := filepath.Base(filePath)
	fileType := strings.ToLower(strings.TrimPrefix(filepath.Ext(fileName), "."))
	country := extractCountryFromPath(relPath)

	// Use larger buffer for chunked reading
	scanner := bufio.NewScanner(file)
	buf := make([]byte, 0, 64*1024)
	maxCapacity := 10 * 1024 * 1024
	scanner.Buffer(buf, maxCapacity)

	lineNum := 0
	batchSize := 10000 // Larger batches for chunked indexing
	var batch []map[string]interface{}

	insertedHashes := make(map[string]bool)

	// Process in chunks
	chunkCount := 0
	maxChunks := 100 // Limit chunks to prevent infinite processing

	for scanner.Scan() && chunkCount < maxChunks {
		lineNum++
		line := scanner.Text()

		// Clean the line
		line = strings.ReplaceAll(line, "\x00", "")
		line = strings.TrimSpace(line)

		if line == "" {
			continue
		}

		if !isValidUTF8(line) {
			continue
		}

		hash := md5.Sum([]byte(line + relPath + fmt.Sprintf("%d", lineNum)))
		contentHash := fmt.Sprintf("%x", hash)

		if insertedHashes[contentHash] {
			continue
		}
		insertedHashes[contentHash] = true

		batch = append(batch, map[string]interface{}{
			"file_path":    relPath,
			"file_name":    fileName,
			"line_number":  lineNum,
			"content":      line,
			"content_hash": contentHash,
			"file_type":    fileType,
			"country":      country,
			"indexed_at":   time.Now(),
		})

		// Insert batch when full
		if len(batch) >= batchSize {
			if err := idx.insertBatchWithTransaction(ctx, batch); err != nil {
				logger.Warnf("error inserting chunked batch: %v", err)
			}
			batch = batch[:0]
			chunkCount++
		}
	}

	// Insert remaining batch
	if len(batch) > 0 {
		if err := idx.insertBatchWithTransaction(ctx, batch); err != nil {
			logger.Warnf("error inserting final chunked batch: %v", err)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan file: %w", err)
	}

	// Update file metadata
	query := `
		INSERT INTO search_index (file_path, file_name, file_size, line_count, indexed_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (file_path) DO UPDATE SET
			file_size = $3,
			line_count = $4,
			indexed_at = $5
	`
	_, err = idx.db.ExecContext(ctx, query, relPath, fileName, info.Size(), lineNum, time.Now())
	if err != nil {
		logger.Warnf("error updating file metadata: %v", err)
	}

	logger.Infof("chunked indexed %d lines from %s", lineNum, fileName)
	return nil
}

// IndexFileLinesChunkedParallel indexes large files in parallel chunks for maximum speed
func (idx *Indexer) IndexFileLinesChunkedParallel(ctx context.Context, filePath string) error {
	info, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("stat file: %w", err)
	}
	relPath, _ := filepath.Rel(idx.DataRoot, filePath)
	fileName := filepath.Base(filePath)
	fileType := strings.ToLower(strings.TrimPrefix(filepath.Ext(fileName), "."))
	country := extractCountryFromPath(relPath)

	// Read file in large chunks and process in parallel
	fileSize := info.Size()
	chunkSize := int64(100 * 1024 * 1024) // 100MB chunks
	numChunks := (fileSize + chunkSize - 1) / chunkSize

	// Limit chunks to avoid too many DB connections (max 5 chunks in parallel)
	maxParallelChunks := int64(5)
	if numChunks > maxParallelChunks {
		numChunks = maxParallelChunks
	}

	logger.Infof("processing %s in %d parallel chunks (%.2f MB each)", fileName, numChunks, float64(chunkSize)/(1024*1024))

	var wg sync.WaitGroup
	var mu sync.Mutex
	var totalLines int64
	var allErrors []error

	// Use the indexer's shared semaphore to limit concurrent database operations
	dbSemaphore := idx.dbSemaphore

	// Process chunks in parallel
	for chunkIdx := int64(0); chunkIdx < numChunks; chunkIdx++ {
		wg.Add(1)
		go func(chunk int64) {
			defer wg.Done()

			logger.Infof("[chunk %d/%d] starting processing for %s", chunk+1, numChunks, fileName)

			startPos := chunk * chunkSize
			endPos := startPos + chunkSize
			if endPos > fileSize {
				endPos = fileSize
			}

			// Open separate file handle for this chunk (required for parallel reading)
			chunkFile, err := os.Open(filePath)
			if err != nil {
				mu.Lock()
				allErrors = append(allErrors, fmt.Errorf("open chunk %d: %w", chunk, err))
				mu.Unlock()
				return
			}
			defer chunkFile.Close()

			// Read chunk
			logger.Infof("[chunk %d/%d] reading %d bytes from position %d", chunk+1, numChunks, endPos-startPos, startPos)
			chunkData := make([]byte, endPos-startPos)
			chunkFile.Seek(startPos, 0)
			n, err := chunkFile.Read(chunkData)
			if err != nil && err.Error() != "EOF" {
				mu.Lock()
				allErrors = append(allErrors, fmt.Errorf("read chunk %d: %w", chunk, err))
				mu.Unlock()
				return
			}
			chunkData = chunkData[:n]
			logger.Infof("[chunk %d/%d] read %d bytes, processing lines...", chunk+1, numChunks, n)

			// Process chunk lines
			logger.Infof("[chunk %d/%d] splitting into lines...", chunk+1, numChunks)
			lines := strings.Split(string(chunkData), "\n")
			logger.Infof("[chunk %d/%d] found %d lines, processing...", chunk+1, numChunks, len(lines))
			batchSize := 10000
			var batch []map[string]interface{}
			insertedHashes := make(map[string]bool)

			// Calculate starting line number for this chunk (more accurate)
			startLineNum := int64(chunk * (fileSize / numChunks / 200)) // Rough estimate

			processedLines := 0
			for i, line := range lines {
				if len(batch) >= batchSize {
					// Acquire semaphore before database operation
					dbSemaphore <- struct{}{}
					if err := idx.insertBatchWithTransaction(ctx, batch); err != nil {
						logger.Warnf("error inserting parallel chunk batch: %v", err)
					}
					<-dbSemaphore // Release semaphore
					batch = batch[:0]
				}

				line = strings.ReplaceAll(line, "\x00", "")
				line = strings.TrimSpace(line)
				if line == "" || !isValidUTF8(line) {
					continue
				}

				lineNum := startLineNum + int64(i) + 1
				hash := md5.Sum([]byte(line + relPath + fmt.Sprintf("%d", lineNum)))
				contentHash := fmt.Sprintf("%x", hash)

				if insertedHashes[contentHash] {
					continue
				}
				insertedHashes[contentHash] = true

				batch = append(batch, map[string]interface{}{
					"file_path":    relPath,
					"file_name":    fileName,
					"line_number":  lineNum,
					"content":      line,
					"content_hash": contentHash,
					"file_type":    fileType,
					"country":      country,
					"indexed_at":   time.Now(),
				})
				processedLines++
			}

			logger.Infof("[chunk %d/%d] processed %d lines, inserting batches...", chunk+1, numChunks, processedLines)

			// Insert remaining batch
			if len(batch) > 0 {
				// Acquire semaphore before database operation
				logger.Infof("[chunk %d/%d] waiting for DB semaphore...", chunk+1, numChunks)
				dbSemaphore <- struct{}{}
				logger.Infof("[chunk %d/%d] acquired DB semaphore, inserting %d records...", chunk+1, numChunks, len(batch))
				if err := idx.insertBatchWithTransaction(ctx, batch); err != nil {
					logger.Warnf("error inserting final parallel chunk batch: %v", err)
				}
				<-dbSemaphore // Release semaphore
				logger.Infof("[chunk %d/%d] released DB semaphore", chunk+1, numChunks)
			}

			mu.Lock()
			totalLines += int64(len(lines))
			mu.Unlock()
			logger.Infof("[chunk %d/%d] completed processing", chunk+1, numChunks)
		}(chunkIdx)
	}

	wg.Wait()

	if len(allErrors) > 0 {
		return fmt.Errorf("errors in parallel processing: %v", allErrors[0])
	}

	// Update file metadata
	query := `
		INSERT INTO search_index (file_path, file_name, file_size, line_count, indexed_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (file_path) DO UPDATE SET
			file_size = $3,
			line_count = $4,
			indexed_at = $5
	`
	_, err = idx.db.ExecContext(ctx, query, relPath, fileName, info.Size(), totalLines, time.Now())
	if err != nil {
		logger.Warnf("error updating file metadata: %v", err)
	}

	logger.Infof("parallel chunked indexed %d lines from %s", totalLines, fileName)
	return nil
}

// extractCountryFromPath extracts country name from file path
// Examples:
//
//	Countries/India/file.csv -> India
//	Countries/USA/data.txt -> USA
//	India/phones.csv -> India
func extractCountryFromPath(path string) string {
	parts := strings.Split(strings.ReplaceAll(path, "\\", "/"), "/")

	// Look for "Countries" folder
	for i, part := range parts {
		if strings.ToLower(part) == "countries" && i+1 < len(parts) {
			return parts[i+1]
		}
	}

	// Check if any part is a known country
	countries := []string{"India", "USA", "UK", "Canada", "Australia", "Germany", "France", "Japan", "China", "Brazil"}
	for _, part := range parts {
		for _, country := range countries {
			if strings.EqualFold(part, country) {
				return country
			}
		}
	}

	return ""
}
