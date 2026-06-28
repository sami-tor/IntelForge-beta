package opensearch

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"

	opensearch "github.com/opensearch-project/opensearch-go/v2"
)

type Client struct {
	*opensearch.Client
}

func NewClient(cfg *Config) (*Client, error) {
	// Create a custom dialer that prefers IPv4
	dialer := &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}

	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ResponseHeaderTimeout: 30 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	}
	if cfg.Insecure {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

	osCfg := opensearch.Config{
		Addresses: []string{cfg.Address},
		Transport: transport,
	}

	if cfg.Username != "" {
		osCfg.Username = cfg.Username
		osCfg.Password = cfg.Password
	}

	client, err := opensearch.NewClient(osCfg)
	if err != nil {
		return nil, err
	}

	return &Client{Client: client}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	res, err := c.Client.Ping(c.Client.Ping.WithContext(ctx))
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("opensearch ping error: %s", res.Status())
	}
	return nil
}
