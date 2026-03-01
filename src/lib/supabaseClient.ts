import { createClient } from '@supabase/supabase-js';

// Must be the service_role key (eyJ... JWT format), NOT the anon/publishable key.
// Service role key bypasses RLS so the backend can read/write any row.
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Log startup diagnostics so Railway logs confirm env var state
const keyPrefix = supabaseServiceRoleKey.slice(0, 12);
const keyType = supabaseServiceRoleKey.startsWith('eyJ') ? 'service_role_jwt' : supabaseServiceRoleKey.startsWith('sb_') ? 'WRONG_anon_key' : 'missing';
console.log(`[supabase] URL set: ${!!supabaseUrl} | key type: ${keyType} | key prefix: ${keyPrefix}`);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('[supabase] FATAL: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not set — all DB writes will fail.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder-service-role-key',
  {
    auth: {
      // Server-side: never persist sessions or auto-refresh tokens.
      // Without these, the singleton client can have its auth state
      // overridden, causing RLS violations on subsequent requests.
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
