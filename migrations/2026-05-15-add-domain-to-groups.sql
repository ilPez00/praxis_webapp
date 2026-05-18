-- Migration to add domain field to chat_rooms table
-- Run: psql -h <host> -U postgres -d praxis -f migrations/2026-05-15-add-domain-to-groups.sql

-- Add domain column if it doesn't exist
ALTER TABLE IF EXISTS chat_rooms
ADD COLUMN IF NOT EXISTS domain VARCHAR(255);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_chat_rooms_domain ON chat_rooms (domain);
