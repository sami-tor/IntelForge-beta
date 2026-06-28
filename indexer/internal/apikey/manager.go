package apikey

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
)

// APIKey represents an API key
type APIKey struct {
	ID         int
	UserID     int
	Key        string
	Name       string
	Active     bool
	LastUsedAt *time.Time
	CreatedAt  time.Time
	ExpiresAt  *time.Time
	RateLimit  int // Requests per minute
}

// APIKeyUsage tracks API key usage
type APIKeyUsage struct {
	ID        int
	KeyID     int
	UserID    int
	Endpoint  string
	Status    int
	UsedAt    time.Time
	IPAddress string
}

// APIKeyManager manages API keys
type APIKeyManager struct {
	db *sql.DB
}

// NewAPIKeyManager creates a new API key manager
func NewAPIKeyManager(db *sql.DB) *APIKeyManager {
	return &APIKeyManager{db: db}
}

// GenerateAPIKey creates a new API key for a user
func (akm *APIKeyManager) GenerateAPIKey(userID int, name string, expiresInDays int) (*APIKey, error) {
	// Generate random key
	keyBytes := make([]byte, 32)
	_, err := rand.Read(keyBytes)
	if err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}
	key := hex.EncodeToString(keyBytes)

	// Default rate limit: 100 requests per minute for premium users
	rateLimit := 100

	// Get user's subscription to set appropriate limits
	var searchLimit int
	err = akm.db.QueryRow(`
		SELECT COALESCE(u.search_limit, 50)
		FROM users u
		WHERE u.id = $1
	`, userID).Scan(&searchLimit)

	if err == nil {
		// Higher limits for premium users
		if searchLimit >= 1000 {
			rateLimit = 500 // API tier: 500 req/min
		} else if searchLimit >= 500 {
			rateLimit = 200 // Starter tier: 200 req/min
		}
	}

	// Set expiration
	var expiresAt *time.Time
	if expiresInDays > 0 {
		exp := time.Now().AddDate(0, 0, expiresInDays)
		expiresAt = &exp
	}

	// Insert into database
	var keyID int
	err = akm.db.QueryRow(`
		INSERT INTO api_keys (user_id, key, name, rate_limit, expires_at, active, created_at)
		VALUES ($1, $2, $3, $4, $5, true, NOW())
		RETURNING id
	`, userID, key, name, rateLimit, expiresAt).Scan(&keyID)

	if err != nil {
		return nil, fmt.Errorf("insert key: %w", err)
	}

	logger.Infof("API key generated - User: %d, KeyID: %d, Name: %s", userID, keyID, name)

	return &APIKey{
		ID:        keyID,
		UserID:    userID,
		Key:       key,
		Name:      name,
		Active:    true,
		CreatedAt: time.Now(),
		ExpiresAt: expiresAt,
		RateLimit: rateLimit,
	}, nil
}

// GetAPIKeyByKey retrieves API key by its value
func (akm *APIKeyManager) GetAPIKeyByKey(key string) (*APIKey, error) {
	apiKey := &APIKey{}

	err := akm.db.QueryRow(`
		SELECT id, user_id, key, name, active, last_used_at, created_at, expires_at, rate_limit
		FROM api_keys
		WHERE key = $1
	`, key).Scan(
		&apiKey.ID, &apiKey.UserID, &apiKey.Key, &apiKey.Name,
		&apiKey.Active, &apiKey.LastUsedAt, &apiKey.CreatedAt,
		&apiKey.ExpiresAt, &apiKey.RateLimit,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("key not found")
	}

	if err != nil {
		return nil, fmt.Errorf("query key: %w", err)
	}

	// Check if expired
	if apiKey.ExpiresAt != nil && time.Now().After(*apiKey.ExpiresAt) {
		return nil, fmt.Errorf("key expired")
	}

	// Check if active
	if !apiKey.Active {
		return nil, fmt.Errorf("key inactive")
	}

	return apiKey, nil
}

// GetUserAPIKeys gets all API keys for a user
func (akm *APIKeyManager) GetUserAPIKeys(userID int) ([]APIKey, error) {
	rows, err := akm.db.Query(`
		SELECT id, user_id, key, name, active, last_used_at, created_at, expires_at, rate_limit
		FROM api_keys
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("query keys: %w", err)
	}
	defer rows.Close()

	var keys []APIKey
	for rows.Next() {
		var key APIKey
		err := rows.Scan(
			&key.ID, &key.UserID, &key.Key, &key.Name, &key.Active,
			&key.LastUsedAt, &key.CreatedAt, &key.ExpiresAt, &key.RateLimit,
		)
		if err != nil {
			logger.Warnf("scan key: %v", err)
			continue
		}
		// Don't return full key in list view
		key.Key = key.Key[:8] + "***"
		keys = append(keys, key)
	}

	return keys, nil
}

// RevokeAPIKey deactivates an API key
func (akm *APIKeyManager) RevokeAPIKey(keyID, userID int) error {
	// Verify ownership
	var existingUserID int
	err := akm.db.QueryRow(`
		SELECT user_id FROM api_keys WHERE id = $1
	`, keyID).Scan(&existingUserID)

	if err != nil {
		return fmt.Errorf("query key owner: %w", err)
	}

	if existingUserID != userID {
		return fmt.Errorf("unauthorized: key does not belong to user")
	}

	// Deactivate
	_, err = akm.db.Exec(`
		UPDATE api_keys SET active = false WHERE id = $1
	`, keyID)

	if err != nil {
		return fmt.Errorf("revoke key: %w", err)
	}

	logger.Infof("API key revoked - KeyID: %d, UserID: %d", keyID, userID)
	return nil
}

// RecordUsage records an API key usage
func (akm *APIKeyManager) RecordUsage(keyID int, endpoint string, statusCode int, ipAddress string) error {
	// Update last_used_at
	_, err := akm.db.Exec(`
		UPDATE api_keys SET last_used_at = NOW() WHERE id = $1
	`, keyID)
	if err != nil {
		logger.Warnf("update last_used: %v", err)
	}

	// Get user ID
	var userID int
	err = akm.db.QueryRow(`
		SELECT user_id FROM api_keys WHERE id = $1
	`, keyID).Scan(&userID)
	if err != nil {
		return fmt.Errorf("get user: %w", err)
	}

	// Record usage
	_, err = akm.db.Exec(`
		INSERT INTO api_key_usage (key_id, user_id, endpoint, status, ip_address, used_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`, keyID, userID, endpoint, statusCode, ipAddress)

	if err != nil {
		logger.Warnf("record usage: %v", err)
		// Don't fail on usage recording
	}

	return nil
}

// CheckRateLimit checks if API key is within rate limit
func (akm *APIKeyManager) CheckRateLimit(keyID int) (bool, int, error) {
	var rateLimit int
	err := akm.db.QueryRow(`
		SELECT rate_limit FROM api_keys WHERE id = $1
	`, keyID).Scan(&rateLimit)

	if err != nil {
		return false, 0, fmt.Errorf("get rate limit: %w", err)
	}

	// Count requests in last minute
	var count int
	err = akm.db.QueryRow(`
		SELECT COUNT(*) FROM api_key_usage
		WHERE key_id = $1 AND used_at > NOW() - INTERVAL '1 minute'
	`, keyID).Scan(&count)

	if err != nil {
		return false, 0, fmt.Errorf("count usage: %w", err)
	}

	allowed := count < rateLimit
	remaining := rateLimit - count
	if remaining < 0 {
		remaining = 0
	}

	return allowed, remaining, nil
}

// GetAPIKeyStats returns statistics for an API key
func (akm *APIKeyManager) GetAPIKeyStats(keyID int, days int) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total requests
	var totalRequests int
	err := akm.db.QueryRow(`
		SELECT COUNT(*) FROM api_key_usage
		WHERE key_id = $1 AND used_at > NOW() - INTERVAL '%d days'
	`, keyID, days).Scan(&totalRequests)
	if err != nil {
		logger.Warnf("count requests: %v", err)
	}
	stats["total_requests"] = totalRequests

	// Successful requests (2xx)
	var successfulRequests int
	err = akm.db.QueryRow(`
		SELECT COUNT(*) FROM api_key_usage
		WHERE key_id = $1 AND status >= 200 AND status < 300
		AND used_at > NOW() - INTERVAL '%d days'
	`, keyID, days).Scan(&successfulRequests)
	if err != nil {
		logger.Warnf("count successful: %v", err)
	}
	stats["successful_requests"] = successfulRequests

	// Error requests (4xx, 5xx)
	var errorRequests int
	err = akm.db.QueryRow(`
		SELECT COUNT(*) FROM api_key_usage
		WHERE key_id = $1 AND status >= 400
		AND used_at > NOW() - INTERVAL '%d days'
	`, keyID, days).Scan(&errorRequests)
	if err != nil {
		logger.Warnf("count errors: %v", err)
	}
	stats["error_requests"] = errorRequests

	// Most used endpoints
	rows, err := akm.db.Query(`
		SELECT endpoint, COUNT(*) as count
		FROM api_key_usage
		WHERE key_id = $1 AND used_at > NOW() - INTERVAL '%d days'
		GROUP BY endpoint
		ORDER BY count DESC
		LIMIT 10
	`, keyID, days)

	if err == nil {
		endpoints := make(map[string]int)
		defer rows.Close()
		for rows.Next() {
			var endpoint string
			var count int
			if err := rows.Scan(&endpoint, &count); err == nil {
				endpoints[endpoint] = count
			}
		}
		stats["endpoints"] = endpoints
	}

	return stats, nil
}
