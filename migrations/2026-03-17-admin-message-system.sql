-- Add last_seen_message_id to profiles to track global login messages
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_message_id TEXT;

-- Update the system_config table to ensure we have a place for the global message
INSERT INTO public.system_config (key, value)
VALUES ('global_login_message', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_config (key, value)
VALUES ('global_login_message_id', '')
ON CONFLICT (key) DO NOTHING;
