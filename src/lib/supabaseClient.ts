import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Must be the service_role key (sb_secret_... or eyJ... format), NOT the anon/publishable key.
// Service role key bypasses RLS so the backend can read/write any row.
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Add the service_role key (not the anon key) to .env.");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
