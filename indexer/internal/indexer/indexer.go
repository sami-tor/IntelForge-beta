package indexer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
	osconfig "github.com/intelforge/platform/indexer/internal/opensearch"
	opensearch "github.com/opensearch-project/opensearch-go/v2"
	"github.com/opensearch-project/opensearch-go/v2/opensearchapi"
)

type Indexer struct {
	client *opensearch.Client
	root   string
}

func Run() error {
	cfg, err := osconfig.LoadConfig()
	if err != nil {
		return fmt.Errorf("load opensearch config: %w", err)
	}

	client, err := osconfig.NewClient(cfg)
	if err != nil {
		return fmt.Errorf("connect opensearch: %w", err)
	}

	dataRoot := cfg.DataRoot
	if dataRoot == "" {
		cwd, _ := os.Getwd()
		dataRoot = filepath.Join(cwd, "data")
	}

	idx := &Indexer{client: client.Client, root: dataRoot}

	logger.Infof("starting indexer root=%s", idx.root)
	return idx.walk()
}

func (i *Indexer) walk() error {
	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// TODO: replace with full ingestion pipeline
	// Use ping request with context
	req := &opensearchapi.PingRequest{}
	res, err := req.Do(ctx, i.client)
	if err != nil {
		return fmt.Errorf("ping opensearch: %w", err)
	}
	defer res.Body.Close()
	if res.IsError() {
		return fmt.Errorf("ping opensearch returned status %s", res.Status())
	}
	logger.Info("opensearch connection verified (placeholder ingestion)")
	return nil
}
