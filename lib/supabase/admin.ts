import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * A database client that bypasses the access rules. Only for jobs that run
 * with no signed-in user (the nightly email). Never import this from a page
 * or a route that a browser can call.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
