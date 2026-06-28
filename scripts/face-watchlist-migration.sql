-- Face Identity Watchlist
-- Add 'face' entity_type support to the existing user_watchlists table

ALTER TABLE user_watchlists
DROP CONSTRAINT IF EXISTS user_watchlists_entity_type_check;

ALTER TABLE user_watchlists
ADD CONSTRAINT user_watchlists_entity_type_check
CHECK (entity_type IN ('cve', 'domain', 'actor', 'hash', 'ip', 'keyword', 'face'));
