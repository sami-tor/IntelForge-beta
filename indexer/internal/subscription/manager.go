package subscription

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
)

// Plan represents a subscription plan
type Plan struct {
	ID               int
	Name             string
	Description      string
	Price            float64
	SearchLimit      int
	ResultsPerSearch int
	ResultsPerFile   int
	DataSources      []string
	SupportLevel     string
	APIAccess        bool
	IsActive         bool
}

// UserSubscription represents an active subscription
type UserSubscription struct {
	ID        int
	UserID    int
	PlanID    int
	PlanName  string
	StartedAt time.Time
	ExpiresAt *time.Time
	Status    string // active, canceled, expired
	Price     float64
}

// BillingRecord represents a payment record
type BillingRecord struct {
	ID          int
	UserID      int
	PlanID      int
	Amount      float64
	PaidAt      time.Time
	PeriodStart time.Time
	PeriodEnd   time.Time
	Status      string // paid, pending, failed
	InvoiceID   string
}

// SubscriptionManager handles subscription operations
type SubscriptionManager struct {
	db *sql.DB
}

// NewSubscriptionManager creates a new subscription manager
func NewSubscriptionManager(db *sql.DB) *SubscriptionManager {
	return &SubscriptionManager{db: db}
}

// GetAllPlans returns all active subscription plans
func (sm *SubscriptionManager) GetAllPlans() ([]Plan, error) {
	rows, err := sm.db.Query(`
		SELECT id, name, description, price, monthly_search_limit,
		       50 as results_per_search, 5 as results_per_file,
		       data_sources, support_level, api_access, is_active
		FROM subscription_plans
		WHERE is_active = true
		ORDER BY sort_order ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("query plans: %w", err)
	}
	defer rows.Close()

	var plans []Plan
	for rows.Next() {
		var plan Plan
		var sources sql.NullString
		err := rows.Scan(
			&plan.ID, &plan.Name, &plan.Description, &plan.Price,
			&plan.SearchLimit, &plan.ResultsPerSearch, &plan.ResultsPerFile,
			&sources, &plan.SupportLevel, &plan.APIAccess, &plan.IsActive,
		)
		if err != nil {
			logger.Warnf("scan plan: %v", err)
			continue
		}

		// Parse data sources
		if sources.Valid {
			// In real implementation, parse pgsql array or JSON
			plan.DataSources = []string{"logs", "ulp", "stealer"}
		}

		plans = append(plans, plan)
	}

	return plans, nil
}

// GetPlan gets a specific plan by ID
func (sm *SubscriptionManager) GetPlan(planID int) (*Plan, error) {
	plan := &Plan{}
	var sources sql.NullString

	err := sm.db.QueryRow(`
		SELECT id, name, description, price, monthly_search_limit,
		       50 as results_per_search, 5 as results_per_file,
		       data_sources, support_level, api_access, is_active
		FROM subscription_plans
		WHERE id = $1
	`, planID).Scan(
		&plan.ID, &plan.Name, &plan.Description, &plan.Price,
		&plan.SearchLimit, &plan.ResultsPerSearch, &plan.ResultsPerFile,
		&sources, &plan.SupportLevel, &plan.APIAccess, &plan.IsActive,
	)

	if err != nil {
		return nil, fmt.Errorf("query plan: %w", err)
	}

	return plan, nil
}

// GetUserSubscription gets active subscription for a user
func (sm *SubscriptionManager) GetUserSubscription(userID int) (*UserSubscription, error) {
	sub := &UserSubscription{}

	err := sm.db.QueryRow(`
		SELECT us.id, us.user_id, us.plan_id, sp.name, us.started_at,
		       us.expires_at, us.status, sp.price
		FROM user_subscriptions us
		LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
		WHERE us.user_id = $1 AND us.status = 'active'
		AND (us.expires_at IS NULL OR us.expires_at > NOW())
		ORDER BY us.started_at DESC
		LIMIT 1
	`, userID).Scan(
		&sub.ID, &sub.UserID, &sub.PlanID, &sub.PlanName, &sub.StartedAt,
		&sub.ExpiresAt, &sub.Status, &sub.Price,
	)

	if err == sql.ErrNoRows {
		// User is on free plan
		return &UserSubscription{
			UserID:   userID,
			PlanName: "Free",
			Status:   "active",
			Price:    0,
		}, nil
	}

	if err != nil {
		return nil, fmt.Errorf("query subscription: %w", err)
	}

	return sub, nil
}

// CreateSubscription creates a new subscription for a user
func (sm *SubscriptionManager) CreateSubscription(userID, planID int, months int) (*UserSubscription, error) {
	expiresAt := time.Now().AddDate(0, months, 0)

	result, err := sm.db.Exec(`
		INSERT INTO user_subscriptions (user_id, plan_id, started_at, expires_at, status)
		VALUES ($1, $2, NOW(), $3, 'active')
		RETURNING id
	`, userID, planID, expiresAt)

	if err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}

	var subID int64
	subID, err = result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("get subscription id: %w", err)
	}

	// Update user's subscription type
	_, err = sm.db.Exec(`
		UPDATE users
		SET subscription_type = (SELECT name FROM subscription_plans WHERE id = $1)
		WHERE id = $2
	`, planID, userID)

	if err != nil {
		logger.Warnf("update user subscription type: %v", err)
	}

	return &UserSubscription{
		ID:        int(subID),
		UserID:    userID,
		PlanID:    planID,
		Status:    "active",
		StartedAt: time.Now(),
		ExpiresAt: &expiresAt,
	}, nil
}

// UpgradeSubscription upgrades user to a new plan
func (sm *SubscriptionManager) UpgradeSubscription(userID, newPlanID int) (*UserSubscription, error) {
	// Cancel existing subscription
	_, err := sm.db.Exec(`
		UPDATE user_subscriptions
		SET status = 'canceled'
		WHERE user_id = $1 AND status = 'active'
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("cancel old subscription: %w", err)
	}

	// Create new subscription (12 months)
	return sm.CreateSubscription(userID, newPlanID, 12)
}

// CancelSubscription cancels a user's subscription
func (sm *SubscriptionManager) CancelSubscription(userID int) error {
	_, err := sm.db.Exec(`
		UPDATE user_subscriptions
		SET status = 'canceled', expires_at = NOW()
		WHERE user_id = $1 AND status = 'active'
	`, userID)

	if err != nil {
		return fmt.Errorf("cancel subscription: %w", err)
	}

	// Revert user to free plan
	_, err = sm.db.Exec(`
		UPDATE users
		SET subscription_type = 'free'
		WHERE id = $1
	`, userID)

	return err
}

// RecordPayment records a billing transaction
func (sm *SubscriptionManager) RecordPayment(userID, planID int, amount float64, invoiceID string) error {
	periodStart := time.Now()
	periodEnd := periodStart.AddDate(0, 1, 0)

	_, err := sm.db.Exec(`
		INSERT INTO billing_records (user_id, plan_id, amount, paid_at, period_start, period_end, status, invoice_id)
		VALUES ($1, $2, $3, NOW(), $4, $5, 'paid', $6)
	`, userID, planID, amount, periodStart, periodEnd, invoiceID)

	if err != nil {
		return fmt.Errorf("record payment: %w", err)
	}

	logger.Infof("Payment recorded - User: %d, Plan: %d, Amount: %.2f, Invoice: %s", userID, planID, amount, invoiceID)
	return nil
}

// GetBillingHistory gets user's payment history
func (sm *SubscriptionManager) GetBillingHistory(userID int, limit int) ([]BillingRecord, error) {
	rows, err := sm.db.Query(`
		SELECT id, user_id, plan_id, amount, paid_at, period_start, period_end, status, invoice_id
		FROM billing_records
		WHERE user_id = $1
		ORDER BY paid_at DESC
		LIMIT $2
	`, userID, limit)

	if err != nil {
		return nil, fmt.Errorf("query billing: %w", err)
	}
	defer rows.Close()

	var records []BillingRecord
	for rows.Next() {
		var rec BillingRecord
		err := rows.Scan(
			&rec.ID, &rec.UserID, &rec.PlanID, &rec.Amount, &rec.PaidAt,
			&rec.PeriodStart, &rec.PeriodEnd, &rec.Status, &rec.InvoiceID,
		)
		if err != nil {
			logger.Warnf("scan billing record: %v", err)
			continue
		}
		records = append(records, rec)
	}

	return records, nil
}

// GetSubscriptionStats returns subscription statistics
func (sm *SubscriptionManager) GetSubscriptionStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total subscribers per plan
	rows, err := sm.db.Query(`
		SELECT sp.name, COUNT(us.id) as count
		FROM subscription_plans sp
		LEFT JOIN user_subscriptions us ON sp.id = us.plan_id AND us.status = 'active'
		WHERE sp.is_active = true
		GROUP BY sp.id, sp.name
		ORDER BY sp.sort_order ASC
	`)

	if err != nil {
		return nil, fmt.Errorf("query stats: %w", err)
	}
	defer rows.Close()

	planStats := make(map[string]int)
	for rows.Next() {
		var name string
		var count int
		if err := rows.Scan(&name, &count); err != nil {
			continue
		}
		planStats[name] = count
	}

	stats["subscribers_per_plan"] = planStats

	// Total revenue this month
	var revenue float64
	err = sm.db.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM billing_records
		WHERE status = 'paid'
		AND paid_at >= date_trunc('month', NOW())
	`).Scan(&revenue)

	if err != nil {
		logger.Warnf("query revenue: %v", err)
		revenue = 0
	}

	stats["monthly_revenue"] = revenue

	// Active subscriptions
	var activeCount int
	err = sm.db.QueryRow(`
		SELECT COUNT(*) FROM user_subscriptions
		WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
	`).Scan(&activeCount)

	if err != nil {
		logger.Warnf("query active count: %v", err)
		activeCount = 0
	}

	stats["active_subscriptions"] = activeCount

	return stats, nil
}
