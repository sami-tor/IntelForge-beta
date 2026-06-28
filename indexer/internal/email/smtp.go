package email

import (
	"crypto/tls"
	"database/sql"
	"fmt"
	"net/mail"
	"net/smtp"
	"strings"
	"time"

	"github.com/intelforge/platform/indexer/internal/logger"
)

// SMTPConfig represents SMTP server configuration
type SMTPConfig struct {
	Host      string
	Port      int
	Username  string
	Password  string
	Secure    bool
	FromEmail string
}

// EmailService handles sending emails via SMTP
type EmailService struct {
	config *SMTPConfig
	db     *sql.DB
}

// NewEmailService creates a new email service
func NewEmailService(db *sql.DB) (*EmailService, error) {
	es := &EmailService{db: db}

	// Load SMTP config from database
	err := es.loadSMTPConfig()
	if err != nil {
		logger.Warnf("failed to load SMTP config: %v", err)
		// Continue with nil config - emails will be logged only
	}

	return es, nil
}

// loadSMTPConfig loads SMTP configuration from database
func (es *EmailService) loadSMTPConfig() error {
	var cfg SMTPConfig

	err := es.db.QueryRow(`
		SELECT host, port, username, password, secure, from_email
		FROM smtp_settings
		LIMIT 1
	`).Scan(
		&cfg.Host, &cfg.Port, &cfg.Username, &cfg.Password,
		&cfg.Secure, &cfg.FromEmail,
	)

	if err == sql.ErrNoRows {
		logger.Warnf("no SMTP configuration found")
		return nil
	}

	if err != nil {
		return fmt.Errorf("query smtp: %w", err)
	}

	es.config = &cfg
	logger.Infof("SMTP config loaded: %s:%d", cfg.Host, cfg.Port)
	return nil
}

// UpdateSMTPConfig updates SMTP configuration
func (es *EmailService) UpdateSMTPConfig(host string, port int, username, password, fromEmail string, secure bool) error {
	_, err := es.db.Exec(`
		DELETE FROM smtp_settings
	`)
	if err != nil {
		return fmt.Errorf("clear smtp: %w", err)
	}

	_, err = es.db.Exec(`
		INSERT INTO smtp_settings (host, port, username, password, secure, from_email)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, host, port, username, password, secure, fromEmail)

	if err != nil {
		return fmt.Errorf("update smtp: %w", err)
	}

	// Reload config
	es.config = &SMTPConfig{
		Host:      host,
		Port:      port,
		Username:  username,
		Password:  password,
		Secure:    secure,
		FromEmail: fromEmail,
	}

	logger.Infof("SMTP config updated: %s:%d", host, port)
	return nil
}

// SendLoginAlert sends a login alert email
func (es *EmailService) SendLoginAlert(toEmail, username, ipAddress, deviceInfo string) error {
	subject := "⚠️ Login Alert - New IP Address Detected"
	body := fmt.Sprintf(`
Dear %s,

We detected a login attempt from a new IP address:

IP Address: %s
Device: %s
Time: %s

If this was you, you can approve this login in your security settings.
If this wasn't you, please change your password immediately.

Best regards,
Intel Forge Security Team
`, username, ipAddress, deviceInfo, formatTime())

	return es.sendEmail(toEmail, subject, body)
}

// SendSubscriptionConfirmation sends subscription confirmation email
func (es *EmailService) SendSubscriptionConfirmation(toEmail, username, planName string, amount float64) error {
	subject := "✅ Subscription Confirmation"
	body := fmt.Sprintf(`
Dear %s,

Thank you for subscribing to the %s plan!

Amount Charged: $%.2f
Date: %s

You now have access to all %s features.

Best regards,
Intel Forge
`, username, planName, amount, formatTime(), planName)

	return es.sendEmail(toEmail, subject, body)
}

// SendAdminNotification sends notification to admin
func (es *EmailService) SendAdminNotification(title, message string) error {
	// Get admin email
	var adminEmail string
	err := es.db.QueryRow(`
		SELECT email FROM users WHERE role = 'admin' LIMIT 1
	`).Scan(&adminEmail)

	if err != nil {
		return fmt.Errorf("get admin email: %w", err)
	}

	subject := fmt.Sprintf("[ADMIN] %s", title)
	body := fmt.Sprintf("Admin Notification:\n\n%s\n\nTime: %s", message, formatTime())

	return es.sendEmail(adminEmail, subject, body)
}

// SendPasswordReset sends password reset email
func (es *EmailService) SendPasswordReset(toEmail, resetToken string) error {
	subject := "🔐 Password Reset Request"
	body := fmt.Sprintf(`
Please reset your password using this link:

https://intel-forge.com/reset-password?token=%s

This link will expire in 24 hours.

If you didn't request this, ignore this email.

Best regards,
Intel Forge
`, resetToken)

	return es.sendEmail(toEmail, subject, body)
}

// SendEmail sends a generic email
func (es *EmailService) sendEmail(to, subject, body string) error {
	// If SMTP not configured, just log
	if es.config == nil {
		logger.Infof("EMAIL (not sent - no SMTP): To=%s, Subject=%s", to, subject)
		return nil
	}

	// Validate email
	if _, err := mail.ParseAddress(to); err != nil {
		return fmt.Errorf("invalid email: %w", err)
	}

	// Prepare message
	message := fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", to, subject, body)

	// Connect to SMTP server
	var conn *smtp.Client
	var err error

	addr := fmt.Sprintf("%s:%d", es.config.Host, es.config.Port)

	if es.config.Secure {
		tlsConfig := &tls.Config{
			ServerName: es.config.Host,
			MinVersion: tls.VersionTLS12,
		}

		tlsConn, dialErr := tls.Dial("tcp", addr, tlsConfig)
		if dialErr != nil {
			return fmt.Errorf("dial smtp tls: %w", dialErr)
		}

		conn, err = smtp.NewClient(tlsConn, es.config.Host)
	} else {
		conn, err = smtp.Dial(addr)
	}

	if err != nil {
		return fmt.Errorf("dial smtp: %w", err)
	}
	defer conn.Close()

	// Authenticate if credentials provided
	if es.config.Username != "" && es.config.Password != "" {
		auth := smtp.PlainAuth("", es.config.Username, es.config.Password, es.config.Host)
		if err := conn.Auth(auth); err != nil {
			return fmt.Errorf("auth smtp: %w", err)
		}
	}

	// Send email
	if err := conn.Mail(es.config.FromEmail); err != nil {
		return fmt.Errorf("mail from: %w", err)
	}

	if err := conn.Rcpt(to); err != nil {
		return fmt.Errorf("rcpt to: %w", err)
	}

	w, err := conn.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	defer w.Close()

	if _, err := w.Write([]byte(message)); err != nil {
		return fmt.Errorf("write message: %w", err)
	}

	if err := conn.Quit(); err != nil {
		return fmt.Errorf("quit: %w", err)
	}

	logger.Infof("Email sent to %s: %s", to, subject)
	return nil
}

// GetSMTPConfig returns current SMTP configuration (password masked)
func (es *EmailService) GetSMTPConfig() map[string]interface{} {
	if es.config == nil {
		return map[string]interface{}{
			"configured": false,
		}
	}

	return map[string]interface{}{
		"configured": true,
		"host":       es.config.Host,
		"port":       es.config.Port,
		"username":   es.config.Username,
		"from_email": es.config.FromEmail,
		"secure":     es.config.Secure,
		// Password not returned for security
	}
}

// formatTime returns formatted current time
func formatTime() string {
	return fmt.Sprintf("%s UTC", strings.Split(fmt.Sprintf("%v", time.Now()), ".")[0])
}
