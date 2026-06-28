package security

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
)

// IPLockPolicy represents IP locking settings
type IPLockPolicy struct {
	UserID          int
	LockedIP        string
	AllowNewIPs     bool
	RequireApproval bool
	NotifyOnNewIP   bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// LoginActivity represents a login attempt
type LoginActivity struct {
	ID               int
	UserID           int
	IP               string
	Device           string
	Status           string // success, blocked, suspicious
	Reason           string // why it was blocked/flagged
	CreatedAt        time.Time
	IsApprvedByAdmin bool
}

// LoginAlert represents an alert for unusual login
type LoginAlert struct {
	ID         int
	UserID     int
	IPAddress  string
	DeviceInfo string
	AlertedAt  time.Time
	Status     string // pending, approved, denied
	ApprovedBy *int
	ApprovedAt *time.Time
}

// SecurityManager handles IP locking and login security
type SecurityManager struct {
	db *sql.DB
}

// NewSecurityManager creates a new security manager
func NewSecurityManager(db *sql.DB) *SecurityManager {
	return &SecurityManager{db: db}
}

// LockIPAddress locks a user to a specific IP
func (sm *SecurityManager) LockIPAddress(userID int, ipAddress string) error {
	_, err := sm.db.Exec(`
		INSERT INTO ip_lock_policies (user_id, locked_ip, allow_new_ips, notify_on_new_ip, created_at, updated_at)
		VALUES ($1, $2, false, true, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			locked_ip = $2,
			updated_at = NOW()
	`, userID, ipAddress)

	if err != nil {
		return fmt.Errorf("lock ip: %w", err)
	}

	logger.Infof("IP locked for user %d to %s", userID, ipAddress)
	return nil
}

// UnlockIPAddress removes IP locking for a user
func (sm *SecurityManager) UnlockIPAddress(userID int) error {
	_, err := sm.db.Exec(`
		DELETE FROM ip_lock_policies
		WHERE user_id = $1
	`, userID)

	if err != nil {
		return fmt.Errorf("unlock ip: %w", err)
	}

	logger.Infof("IP unlocked for user %d", userID)
	return nil
}

// IsIPAllowed checks if an IP is allowed for a user
func (sm *SecurityManager) IsIPAllowed(userID int, ipAddress string) (bool, error) {
	var lockedIP string
	var allowNewIPs bool

	err := sm.db.QueryRow(`
		SELECT locked_ip, allow_new_ips
		FROM ip_lock_policies
		WHERE user_id = $1
	`, userID).Scan(&lockedIP, &allowNewIPs)

	if err == sql.ErrNoRows {
		// No IP lock policy, allow login
		return true, nil
	}

	if err != nil {
		return false, fmt.Errorf("check ip: %w", err)
	}

	// If IP matches locked IP, allow
	if ipAddress == lockedIP {
		return true, nil
	}

	// If new IPs are allowed, allow
	if allowNewIPs {
		return true, nil
	}

	// Otherwise deny
	return false, nil
}

// RecordLoginActivity records a login attempt
func (sm *SecurityManager) RecordLoginActivity(userID int, ip, device, status, reason string) error {
	_, err := sm.db.Exec(`
		INSERT INTO login_activity (user_id, ip_address, device, status, reason, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`, userID, ip, device, status, reason)

	if err != nil {
		return fmt.Errorf("record login: %w", err)
	}

	logger.Infof("Login activity recorded - User: %d, IP: %s, Status: %s", userID, ip, status)
	return nil
}

// CreateLoginAlert creates an alert for unusual login
func (sm *SecurityManager) CreateLoginAlert(userID int, ipAddress, deviceInfo string) error {
	_, err := sm.db.Exec(`
		INSERT INTO login_alerts (user_id, ip_address, device_info, alerted_at, status)
		VALUES ($1, $2, $3, NOW(), 'pending')
	`, userID, ipAddress, deviceInfo)

	if err != nil {
		return fmt.Errorf("create alert: %w", err)
	}

	logger.Warnf("Login alert created - User: %d, IP: %s", userID, ipAddress)
	return nil
}

// GetLoginAlerts gets pending login alerts for a user
func (sm *SecurityManager) GetLoginAlerts(userID int) ([]LoginAlert, error) {
	rows, err := sm.db.Query(`
		SELECT id, user_id, ip_address, device_info, alerted_at, status, approved_by, approved_at
		FROM login_alerts
		WHERE user_id = $1 AND status = 'pending'
		ORDER BY alerted_at DESC
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("query alerts: %w", err)
	}
	defer rows.Close()

	var alerts []LoginAlert
	for rows.Next() {
		var alert LoginAlert
		var approvedBy sql.NullInt64
		var approvedAt sql.NullTime

		err := rows.Scan(
			&alert.ID, &alert.UserID, &alert.IPAddress, &alert.DeviceInfo,
			&alert.AlertedAt, &alert.Status, &approvedBy, &approvedAt,
		)
		if err != nil {
			logger.Warnf("scan alert: %v", err)
			continue
		}

		if approvedBy.Valid {
			intVal := int(approvedBy.Int64)
			alert.ApprovedBy = &intVal
		}
		if approvedAt.Valid {
			alert.ApprovedAt = &approvedAt.Time
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// ApproveLoginAlert approves a login from a new IP
func (sm *SecurityManager) ApproveLoginAlert(alertID, adminID int) error {
	_, err := sm.db.Exec(`
		UPDATE login_alerts
		SET status = 'approved', approved_by = $1, approved_at = NOW()
		WHERE id = $2
	`, adminID, alertID)

	if err != nil {
		return fmt.Errorf("approve alert: %w", err)
	}

	// Get alert details to update IP lock
	var userID int
	var ipAddress string
	err = sm.db.QueryRow(`
		SELECT user_id, ip_address FROM login_alerts WHERE id = $1
	`, alertID).Scan(&userID, &ipAddress)

	if err == nil {
		// Update IP lock to allow this new IP
		_ = sm.LockIPAddress(userID, ipAddress)
	}

	logger.Infof("Login alert approved - Alert: %d, Admin: %d", alertID, adminID)
	return nil
}

// DenyLoginAlert denies a login from a new IP
func (sm *SecurityManager) DenyLoginAlert(alertID int) error {
	_, err := sm.db.Exec(`
		UPDATE login_alerts
		SET status = 'denied'
		WHERE id = $1
	`, alertID)

	if err != nil {
		return fmt.Errorf("deny alert: %w", err)
	}

	logger.Warnf("Login alert denied - Alert: %d", alertID)
	return nil
}

// GetLoginHistory gets user's login history
func (sm *SecurityManager) GetLoginHistory(userID int, limit int) ([]LoginActivity, error) {
	rows, err := sm.db.Query(`
		SELECT id, user_id, ip_address, device, status, reason, created_at
		FROM login_activity
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)

	if err != nil {
		return nil, fmt.Errorf("query history: %w", err)
	}
	defer rows.Close()

	var activities []LoginActivity
	for rows.Next() {
		var activity LoginActivity
		err := rows.Scan(
			&activity.ID, &activity.UserID, &activity.IP, &activity.Device,
			&activity.Status, &activity.Reason, &activity.CreatedAt,
		)
		if err != nil {
			logger.Warnf("scan activity: %v", err)
			continue
		}
		activities = append(activities, activity)
	}

	return activities, nil
}

// GetSecurityScore calculates security score for a user (0-100)
func (sm *SecurityManager) GetSecurityScore(userID int) (int, error) {
	score := 100 // Start at 100

	// Check if IP is locked
	var lockedIP string
	err := sm.db.QueryRow(`
		SELECT locked_ip FROM ip_lock_policies WHERE user_id = $1
	`, userID).Scan(&lockedIP)

	if err == nil && lockedIP != "" {
		score -= 5 // IP locking reduces score slightly (good practice)
	}

	// Check for recent suspicious activity
	var suspiciousCount int
	err = sm.db.QueryRow(`
		SELECT COUNT(*) FROM login_activity
		WHERE user_id = $1 AND status = 'blocked'
		AND created_at > NOW() - INTERVAL '30 days'
	`, userID).Scan(&suspiciousCount)

	if err == nil {
		score -= (suspiciousCount * 5) // Each suspicious activity -5 points
	}

	// Check for pending alerts
	var pendingAlerts int
	err = sm.db.QueryRow(`
		SELECT COUNT(*) FROM login_alerts
		WHERE user_id = $1 AND status = 'pending'
	`, userID).Scan(&pendingAlerts)

	if err == nil {
		score -= (pendingAlerts * 10) // Each pending alert -10 points
	}

	if score < 0 {
		score = 0
	}

	return score, nil
}
