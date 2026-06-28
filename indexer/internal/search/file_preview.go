package search

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// FilePreview represents a file preview response
type FilePreview struct {
	FileName    string
	FilePath    string
	TotalLines  int
	Content     []PreviewLine
	SearchQuery string
}

// PreviewLine represents a single line in the preview
type PreviewLine struct {
	LineNum  int
	Content  string
	IsMatch  bool
	MatchPos int // Position of match in line
}

// GetFilePreview returns a preview of a file with search highlights
func GetFilePreview(dataRoot string, filePath string, searchQuery string, maxLines int) (*FilePreview, error) {
	fullPath := filepath.Join(dataRoot, filePath)

	file, err := os.Open(fullPath)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer file.Close()

	preview := &FilePreview{
		FileName:    filepath.Base(filePath),
		FilePath:    filePath,
		SearchQuery: searchQuery,
		Content:     []PreviewLine{},
	}

	scanner := bufio.NewScanner(file)
	lineNum := 0
	queryLower := strings.ToLower(searchQuery)

	for scanner.Scan() && lineNum < maxLines {
		lineNum++
		content := scanner.Text()
		contentLower := strings.ToLower(content)

		isMatch := strings.Contains(contentLower, queryLower)
		matchPos := strings.Index(contentLower, queryLower)

		pLine := PreviewLine{
			LineNum:  lineNum,
			Content:  content,
			IsMatch:  isMatch,
			MatchPos: matchPos,
		}

		preview.Content = append(preview.Content, pLine)
	}

	preview.TotalLines = lineNum
	return preview, nil
}
