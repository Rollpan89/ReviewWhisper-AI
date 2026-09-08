import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from './env';

let cached: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the service role key.
 * Returns null when Supabase is not configured (demo mode).
 */
export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
