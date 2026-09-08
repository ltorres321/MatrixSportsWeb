-- Add optional street address line to subscribers, requested after the
-- initial signup form shipped without one.
--
-- Run once against the database DATABASE_URL points at:
--   psql "$DATABASE_URL" -f sql/002_add_address_to_subscribers.sql

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS address TEXT;
