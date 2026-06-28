package search

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
)

// QuotaLimit defines the limits for a subscription tier
type QuotaLimit struct {
	SearchesPerMonth int // Monthly search limit
	ResultsPerSearch int // Max results per search
	ResultsPerFile   int // Max results from single file
}

// UserQuota represents a user's current quota usage
type UserQuota struct {
	UserID        int
	YearMonth     string // YYYY-MM
	SearchesUsed  int
	ResultsViewed int
	SearchLimit   int
	HasExceeded   bool
}

// QuotaManager handles quota enforcement and tracking
type QuotaManager struct {
	db *sql.DB
}

// NewQuotaManager creates a new quota manager
func NewQuotaManager(db *sql.DB) *QuotaManager {
	return &QuotaManager{db: db}
}

// GetQuotaLimits returns the quota limits for a user based on their subscription
func (qm *QuotaManager) GetQuotaLimits(userID int) (*QuotaLimit, error) {
	var searchLimit int
	var subscriptionType string

	// Get user's subscription
	err := qm.db.QueryRow(`
		SELECT COALESCE(u.search_limit, s.monthly_search_limit, 50),
		       COALESCE(u.subscription_type, 'free')
		FROM users u
		LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
		LEFT JOIN subscription_plans s ON us.plan_id = s.id
		WHERE u.id = $1
	`, userID).Scan(&searchLimit, &subscriptionType)

	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("query quota: %w", err)
	}

	// Define limits per subscription type
	limits := &QuotaLimit{
		SearchesPerMonth: searchLimit,
		ResultsPerSearch: 10, // Default: 10 results max per search
		ResultsPerFile:   5,  // Default: 5 results per file
	}

	// Adjust limits based on subscription type
	switch subscriptionType {
	case "starter":
		limits.ResultsPerSearch = 50
		limits.ResultsPerFile = 5
	case "professional":
		limits.ResultsPerSearch = 200
		limits.ResultsPerFile = 20
	case "api_access":
		limits.ResultsPerSearch = 1000
		limits.ResultsPerFile = 100
	case "enterprise":
		limits.ResultsPerSearch = 10000
		limits.ResultsPerFile = 1000
	default: // free
		limits.ResultsPerSearch = 10
		limits.ResultsPerFile = 5
	}

	return limits, nil
}

// GetCurrentQuota returns the user's current quota usage for this month
func (qm *QuotaManager) GetCurrentQuota(userID int) (*UserQuota, error) {
	yearMonth := time.Now().Format("2006-01")

	quota := &UserQuota{
		UserID:    userID,
		YearMonth: yearMonth,
	}

	// Get quota limits
	limits, err := qm.GetQuotaLimits(userID)
	if err != nil {
		return nil, err
	}
	quota.SearchLimit = limits.SearchesPerMonth

	// Get current usage
	err = qm.db.QueryRow(`
		SELECT COALESCE(searches_used, 0), COALESCE(results_viewed, 0)
		FROM user_monthly_quota
		WHERE user_id = $1 AND year_month = $2
	`, userID, yearMonth).Scan(&quota.SearchesUsed, &quota.ResultsViewed)

	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("query usage: %w", err)
	}

	quota.HasExceeded = quota.SearchesUsed >= quota.SearchLimit

	return quota, nil
}

// CanSearch checks if user can perform another search
func (qm *QuotaManager) CanSearch(userID int) (bool, string, error) {
	// Admin users have unlimited searches
	var role string
	err := qm.db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&role)
	if err != nil {
		return false, "", fmt.Errorf("get user role: %w", err)
	}

	if role == "admin" {
		return true, "", nil
	}

	quota, err := qm.GetCurrentQuota(userID)
	if err != nil {
		return false, "", err
	}

	if quota.HasExceeded {
		remaining := quota.SearchLimit - quota.SearchesUsed
		msg := fmt.Sprintf("Monthly search limit exceeded. Limit: %d, Used: %d, Remaining: %d",
			quota.SearchLimit, quota.SearchesUsed, remaining)
		return false, msg, nil
	}

	return true, "", nil
}

// RecordSearch records a search attempt for quota tracking
func (qm *QuotaManager) RecordSearch(userID int, resultCount int) error {
	yearMonth := time.Now().Format("2006-01")

	// Upsert quota record
	_, err := qm.db.Exec(`
		INSERT INTO user_monthly_quota (user_id, year_month, searches_used, results_viewed, last_search, created_at, updated_at)
		VALUES ($1, $2, 1, $3, NOW(), NOW(), NOW())
		ON CONFLICT (user_id, year_month) DO UPDATE SET
			searches_used = searches_used + 1,
			results_viewed = results_viewed + $3,
			last_search = NOW(),
			updated_at = NOW()
	`, userID, yearMonth, resultCount)

	if err != nil {
		logger.Errorf("record search: %v", err)
		return fmt.Errorf("record search: %w", err)
	}

	return nil
}

// ResetMonthlyQuota resets all monthly quotas (typically run on month change)
func (qm *QuotaManager) ResetMonthlyQuota(allUsers bool) error {
	if allUsers {
		_, err := qm.db.Exec(`
			UPDATE user_monthly_quota
			SET searches_used = 0, results_viewed = 0, last_reset = NOW()
			WHERE year_month < $1
		`, time.Now().Format("2006-01"))
		if err != nil {
			return fmt.Errorf("reset monthly quota: %w", err)
		}
	}
	return nil
}

// GetRemainingSearches returns how many searches the user has left this month
func (qm *QuotaManager) GetRemainingSearches(userID int) (int, error) {
	quota, err := qm.GetCurrentQuota(userID)
	if err != nil {
		return 0, err
	}

	remaining := quota.SearchLimit - quota.SearchesUsed
	if remaining < 0 {
		remaining = 0
	}

	return remaining, nil
}

// GetUserStats returns detailed quota statistics for a user
func (qm *QuotaManager) GetUserStats(userID int) (map[string]interface{}, error) {
	quota, err := qm.GetCurrentQuota(userID)
	if err != nil {
		return nil, err
	}

	limits, err := qm.GetQuotaLimits(userID)
	if err != nil {
		return nil, err
	}

	remaining := quota.SearchLimit - quota.SearchesUsed
	if remaining < 0 {
		remaining = 0
	}

	percentUsed := 0
	if quota.SearchLimit > 0 {
		percentUsed = (quota.SearchesUsed * 100) / quota.SearchLimit
	}

	stats := map[string]interface{}{
		"month":              quota.YearMonth,
		"searches_limit":     quota.SearchLimit,
		"searches_used":      quota.SearchesUsed,
		"searches_remaining": remaining,
		"percent_used":       percentUsed,
		"results_viewed":     quota.ResultsViewed,
		"results_per_search": limits.ResultsPerSearch,
		"results_per_file":   limits.ResultsPerFile,
		"status":             map[string]bool{"has_exceeded": quota.HasExceeded},
	}

	return stats, nil
}
