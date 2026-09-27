import { createClient } from "@supabase/supabase-js";
import type { Database } from "@gigly/shared";

/**
 * Service-role client. Bypasses RLS entirely, so it never goes near a request
 * handler a user can reach — admin tooling and scripts only.
 *
 * SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so Next never inlines
 * it into a client bundle; imported into a Client Component it is simply
 * undefined and this throws. The `server-only` package would turn that into a
 * build-time error instead, if you want to add it later.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never run in the browser");
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
