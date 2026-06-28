package opensearch

import (
	"fmt"
	"os"
)

type Config struct {
	Address  string
	Username string
	Password string
	DataRoot string
	Insecure bool
}

func LoadConfig() (*Config, error) {
	cfg := &Config{
		Address:  os.Getenv("OPENSEARCH_URL"),
		Username: os.Getenv("OPENSEARCH_USERNAME"),
		Password: os.Getenv("OPENSEARCH_PASSWORD"),
		DataRoot: os.Getenv("DATA_DIRECTORY"),
	}

	if cfg.Address == "" {
		cfg.Address = "http://127.0.0.1:9200"
	}

	if insecure := os.Getenv("OPENSEARCH_INSECURE"); insecure == "1" || insecure == "true" {
		cfg.Insecure = true
	}

	if cfg.Username == "" && cfg.Password != "" {
		return nil, fmt.Errorf("opensearch password provided without username")
	}

	return cfg, nil
}
