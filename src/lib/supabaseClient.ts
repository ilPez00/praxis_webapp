import { createClient } from '@supabase/supabase-js';

// Must be the service_role key (sb_secret_... or eyJ... format), NOT the anon/publishable key.
// Service role key bypasses RLS so the backend can read/write any row.
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('[supabase] WARNING: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not set — all DB operations will fail until env vars are configured.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder-service-role-key'
);
