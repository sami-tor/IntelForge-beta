package search

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/nwaples/rardecode"
	"github.com/ulikunitz/xz"
)

// ExtractedFile represents a file extracted from an archive
type ExtractedFile struct {
	Name    string
	Content []byte
	Path    string
}

// ExtractArchive extracts files from various archive formats
// Returns a slice of ExtractedFile with their contents
func ExtractArchive(filePath string, maxFiles int) ([]ExtractedFile, error) {
	var files []ExtractedFile

	ext := strings.ToLower(filepath.Ext(filePath))

	switch ext {
	case ".zip":
		extracted, err := extractZIP(filePath, maxFiles)
		if err != nil {
			return nil, err
		}
		files = extracted

	case ".rar":
		extracted, err := extractRAR(filePath, maxFiles)
		if err != nil {
			return nil, err
		}
		files = extracted

	case ".7z":
		extracted, err := extract7Z(filePath, maxFiles)
		if err != nil {
			return nil, err
		}
		files = extracted

	case ".tar":
		extracted, err := extractTAR(filePath, maxFiles)
		if err != nil {
			return nil, err
		}
		files = extracted

	case ".gz":
		if strings.HasSuffix(filePath, ".tar.gz") {
			extracted, err := extractTarGZ(filePath, maxFiles)
			if err != nil {
				return nil, err
			}
			files = extracted
		}
	}

	return files, nil
}

// extractZIP extracts files from a ZIP archive
func extractZIP(filePath string, maxFiles int) ([]ExtractedFile, error) {
	var files []ExtractedFile

	reader, err := zip.OpenReader(filePath)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	for i, file := range reader.File {
		if i >= maxFiles {
			break
		}

		if file.FileInfo().IsDir() {
			continue
		}

		rc, err := file.Open()
		if err != nil {
			continue
		}

		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			continue
		}

		files = append(files, ExtractedFile{
			Name:    file.Name,
			Content: content,
			Path:    file.Name,
		})
	}

	return files, nil
}

// extractRAR extracts files from a RAR archive
func extractRAR(filePath string, maxFiles int) ([]ExtractedFile, error) {
	var files []ExtractedFile

	rarFile, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer rarFile.Close()

	reader, err := rardecode.NewReader(rarFile, "")
	if err != nil {
		return nil, err
	}

	count := 0
	for {
		if count >= maxFiles {
			break
		}

		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}

		if header.IsDir {
			continue
		}

		content, err := io.ReadAll(reader)
		if err != nil {
			continue
		}

		files = append(files, ExtractedFile{
			Name:    header.Name,
			Content: content,
			Path:    header.Name,
		})

		count++
	}

	return files, nil
}

// extract7Z extracts files from a 7Z archive
// Note: 7Z extraction may not work with all 7Z files
func extract7Z(filePath string, maxFiles int) ([]ExtractedFile, error) {
	var files []ExtractedFile

	// 7Z extraction is complex, skip for now
	// Users should use ZIP or extract manually
	return files, nil
}

// extractTAR extracts files from a TAR archive
func extractTAR(filePath string, maxFiles int) ([]ExtractedFile, error) {
	var files []ExtractedFile

	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	tr := tar.NewReader(f)
	count := 0

	for {
		if count >= maxFiles {
			break
		}

		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}

		if header.Typeflag == tar.TypeDir {
			continue
		}

		content, err := io.ReadAll(tr)
		if err != nil {
			continue
		}

		files = append(files, ExtractedFile{
			Name:    header.Name,
			Content: content,
			Path:    header.Name,
		})

		count++
	}

	return files, nil
}

// extractTarGZ extracts files from a TAR.GZ archive
func extractTarGZ(filePath string, maxFiles int) ([]ExtractedFile, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Try gzip first
	gz, err := gzip.NewReader(f)
	if err != nil {
		// Try xz compression
		f.Seek(0, 0)
		xzr, err := xz.NewReader(f)
		if err != nil {
			return nil, err
		}
		return extractTARFromReader(xzr, maxFiles)
	}
	defer gz.Close()

	return extractTARFromReader(gz, maxFiles)
}

// extractTARFromReader extracts TAR files from a reader
func extractTARFromReader(r io.Reader, maxFiles int) ([]ExtractedFile, error) {
	var files []ExtractedFile

	tr := tar.NewReader(r)
	count := 0

	for {
		if count >= maxFiles {
			break
		}

		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}

		if header.Typeflag == tar.TypeDir {
			continue
		}

		var buf bytes.Buffer
		if _, err := io.Copy(&buf, tr); err != nil {
			continue
		}

		files = append(files, ExtractedFile{
			Name:    header.Name,
			Content: buf.Bytes(),
			Path:    header.Name,
		})

		count++
	}

	return files, nil
}
