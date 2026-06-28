package search

import (
	"context"
	"crypto/md5"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
)

// IndexArchive indexes all files inside an archive (ZIP, RAR, 7Z)
func (idx *Indexer) IndexArchive(ctx context.Context, archivePath string) error {
	relPath, _ := filepath.Rel(idx.DataRoot, archivePath)
	archiveName := filepath.Base(archivePath)

	logger.Infof("indexing archive: %s", archiveName)

	// Extract archive files
	extractedFiles, err := ExtractArchive(archivePath, 1000) // Limit to 1000 files per archive
	if err != nil {
		return fmt.Errorf("extract archive: %w", err)
	}

	if len(extractedFiles) == 0 {
		logger.Warnf("archive %s contains no extractable files", archiveName)
		return nil
	}

	logger.Infof("extracted %d files from archive %s", len(extractedFiles), archiveName)

	// Index each extracted file
	for _, extractedFile := range extractedFiles {
		// Skip binary files
		entryExt := strings.ToLower(filepath.Ext(extractedFile.Name))
		binaryExts := []string{".jpg", ".jpeg", ".png", ".gif", ".bmp", ".exe", ".dll", ".so", ".bin", ".pdf"}
		isBinary := false
		for _, be := range binaryExts {
			if entryExt == be {
				isBinary = true
				break
			}
		}
		if isBinary {
			continue
		}

		// Create archive entry path: archive.zip::file.txt
		archiveEntryPath := fmt.Sprintf("%s::%s", relPath, extractedFile.Name)
		entryFileName := filepath.Base(extractedFile.Name)
		entryFileType := strings.ToLower(strings.TrimPrefix(entryExt, "."))
		if entryFileType == "" {
			entryFileType = "txt"
		}

		// Extract country from archive path
		country := extractCountryFromPath(relPath)

		// Index lines from extracted file
		content := string(extractedFile.Content)
		lines := strings.Split(content, "\n")

		batchSize := 5000
		var batch []map[string]interface{}

		for lineNum, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			// Remove null bytes and validate UTF-8
			line = strings.ReplaceAll(line, "\x00", "")
			if !isValidUTF8(line) {
				continue
			}

			// Create content hash
			hash := md5.Sum([]byte(line + archiveEntryPath + fmt.Sprintf("%d", lineNum+1)))
			contentHash := fmt.Sprintf("%x", hash)

			batch = append(batch, map[string]interface{}{
				"file_path":    archiveEntryPath,
				"file_name":    entryFileName,
				"line_number":  lineNum + 1,
				"content":      line,
				"content_hash": contentHash,
				"file_type":    entryFileType,
				"country":      country,
				"indexed_at":   time.Now(),
			})

			// Insert batch when full
			if len(batch) >= batchSize {
				if err := idx.insertBatchWithTransaction(ctx, batch); err != nil {
					logger.Warnf("error inserting archive batch: %v", err)
				}
				batch = batch[:0]
			}
		}

		// Insert remaining batch
		if len(batch) > 0 {
			if err := idx.insertBatchWithTransaction(ctx, batch); err != nil {
				logger.Warnf("error inserting final archive batch: %v", err)
			}
		}

		logger.Infof("indexed %d lines from %s in archive %s", len(lines), entryFileName, archiveName)
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
	info, _ := os.Stat(archivePath)
	totalLines := 0
	for _, ef := range extractedFiles {
		lines := strings.Split(string(ef.Content), "\n")
		totalLines += len(lines)
	}
	_, err = idx.db.ExecContext(ctx, query, relPath, archiveName, info.Size(), totalLines, time.Now())
	if err != nil {
		logger.Warnf("error updating archive metadata: %v", err)
	}

	logger.Infof("successfully indexed archive %s with %d files, %d total lines", archiveName, len(extractedFiles), totalLines)
	return nil
}

