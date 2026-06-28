package searchapi

import (
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/intelforge/platform/indexer/internal/logger"
)

func Run() error {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// Placeholder endpoint until search service is wired to OpenSearch
	r.Get("/search", func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "search service not yet implemented", http.StatusNotImplemented)
	})

	addr := os.Getenv("SEARCH_API_ADDR")
	if addr == "" {
		addr = ":8090"
	}

	logger.Infof("search API listening on %s", addr)
	return http.ListenAndServe(addr, r)
}
