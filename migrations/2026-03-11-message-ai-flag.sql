-- Add is_ai column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT false;
