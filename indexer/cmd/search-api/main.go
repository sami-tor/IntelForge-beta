package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
	"github.com/intelforge/platform/indexer/internal/search"
	_ "github.com/lib/pq"
)

func main() {
	logger.Infof("starting custom search API server")

	// Get database URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable not set")
	}

	// Connect to database
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	// Get data directory
	dataRoot := os.Getenv("DATA_DIRECTORY")
	if dataRoot == "" {
		cwd, _ := os.Getwd()
		dataRoot = filepath.Join(cwd, "data")
	}

	// Create search indexer
	indexer := search.NewIndexer(dataRoot, db)

	// Create quota manager
	quotaManager := search.NewQuotaManager(db)

	// API routes
	http.HandleFunc("/api/search", func(w http.ResponseWriter, r *http.Request) {
		handleSearch(w, r, indexer, quotaManager)
	})

	http.HandleFunc("/api/file-preview", func(w http.ResponseWriter, r *http.Request) {
		handleFilePreview(w, r, dataRoot)
	})

	http.HandleFunc("/api/search/index", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			handleIndexFiles(w, r, indexer)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/api/quota/status", func(w http.ResponseWriter, r *http.Request) {
		handleQuotaStatus(w, r, quotaManager)
	})

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	logger.Infof("listening on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func handleSearch(w http.ResponseWriter, r *http.Request, indexer *search.Indexer, quotaManager *search.QuotaManager) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "missing query parameter", http.StatusBadRequest)
		return
	}

	// Get user ID from header or session (for now, use demo user ID 1)
	userID := 1
	if u := r.Header.Get("X-User-ID"); u != "" {
		if parsed, err := strconv.Atoi(u); err == nil {
			userID = parsed
		}
	}

	// Check if user can search
	canSearch, msg, err := quotaManager.CanSearch(userID)
	if err != nil {
		logger.Errorf("quota check error: %v", err)
		http.Error(w, fmt.Sprintf("quota check error: %v", err), http.StatusInternalServerError)
		return
	}

	if !canSearch {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": msg,
			"code":  "QUOTA_EXCEEDED",
		})
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 1000 {
			limit = parsed
		}
	}

	// Get quota limits for result filtering
	quotaLimits, err := quotaManager.GetQuotaLimits(userID)
	if err != nil {
		logger.Warnf("get quota limits: %v", err)
		quotaLimits = &search.QuotaLimit{
			SearchesPerMonth: 50,
			ResultsPerSearch: 10,
			ResultsPerFile:   5,
		}
	}

	// Apply quota result limit
	if limit > quotaLimits.ResultsPerSearch {
		limit = quotaLimits.ResultsPerSearch
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	results, err := indexer.SearchFiles(ctx, query, limit)
	if err != nil {
		logger.Errorf("search error: %v", err)
		http.Error(w, fmt.Sprintf("search error: %v", err), http.StatusInternalServerError)
		return
	}

	// Record the search for quota tracking
	if err := quotaManager.RecordSearch(userID, len(results)); err != nil {
		logger.Warnf("failed to record search: %v", err)
	}

	// Get updated quota stats
	stats, err := quotaManager.GetUserStats(userID)
	if err != nil {
		stats = map[string]interface{}{"error": "Could not fetch quota stats"}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"query":   query,
		"count":   len(results),
		"results": results,
		"quota":   stats,
	})
}

func handleFilePreview(w http.ResponseWriter, r *http.Request, dataRoot string) {
	filePath := r.URL.Query().Get("file")
	if filePath == "" {
		http.Error(w, "missing file parameter", http.StatusBadRequest)
		return
	}

	query := r.URL.Query().Get("q")
	maxLines := 500
	if m := r.URL.Query().Get("maxLines"); m != "" {
		if parsed, err := strconv.Atoi(m); err == nil && parsed > 0 && parsed <= 10000 {
			maxLines = parsed
		}
	}

	preview, err := search.GetFilePreview(dataRoot, filePath, query, maxLines)
	if err != nil {
		logger.Errorf("preview error: %v", err)
		http.Error(w, fmt.Sprintf("preview error: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(preview)
}

func handleIndexFiles(w http.ResponseWriter, r *http.Request, indexer *search.Indexer) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*60) // 5 minute timeout
	defer cancel()

	if err := indexer.IndexFiles(ctx); err != nil {
		logger.Errorf("indexing error: %v", err)
		http.Error(w, fmt.Sprintf("indexing error: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "indexing complete"})
}

func handleQuotaStatus(w http.ResponseWriter, r *http.Request, quotaManager *search.QuotaManager) {
	userID := 1 // Demo user ID
	if u := r.Header.Get("X-User-ID"); u != "" {
		if parsed, err := strconv.Atoi(u); err == nil {
			userID = parsed
		}
	}

	stats, err := quotaManager.GetUserStats(userID)
	if err != nil {
		logger.Errorf("failed to get quota stats: %v", err)
		http.Error(w, "Could not fetch quota stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
