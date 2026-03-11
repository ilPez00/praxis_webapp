-- Table for global system configuration
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read config (needed for services)
CREATE POLICY "Public read access for system_config" ON public.system_config FOR SELECT USING (true);

-- Policy: Only admins can edit config
CREATE POLICY "Admin write access for system_config" ON public.system_config 
  FOR ALL 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Insert default Axiom prompt
INSERT INTO public.system_config (key, value)
VALUES ('axiom_prompt', 'You are Axiom — a wise, warm, and practical life coach. Your tone is friendly and direct. You give practical, concrete guidance. You never cite books by name or author. You just give people what they need to move forward.')
ON CONFLICT (key) DO NOTHING;
