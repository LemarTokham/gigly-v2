/**
 * Grants or revokes the admin flag, which is what gates /admin.
 *
 *   npm run make:admin -- you@example.com
 *   npm run make:admin -- you@example.com --revoke
 *
 * is_admin is not writable by its owner (see the profiles column grants), so
 * this runs as the service role.
 */
import { createClient } from "@supabase/supabase-js";

const revoke = process.argv.includes("--revoke");
// ADMIN_EMAIL in .env.local saves retyping it after every db:reset, which
// wipes auth.users and takes the admin flag with it.
const email = process.argv.find((a) => a.includes("@")) ?? process.env.ADMIN_EMAIL;

if (!email) {
  console.error("Usage: npm run make:admin -- you@example.com [--revoke]");
  console.error("Or set ADMIN_EMAIL in .env.local and run it with no argument.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let user = null;
for (let page = 1; !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  user = (data?.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  if ((data?.users ?? []).length < 200) break;
}

if (!user) {
  console.error(`No account for ${email}. Sign in once first, then run this.`);
  process.exit(1);
}

const { error } = await db.from("profiles").update({ is_admin: !revoke }).eq("id", user.id);
if (error) throw error;

console.log(`${email} is ${revoke ? "no longer" : "now"} an admin.`);
console.log(revoke ? "/admin will 404 for them." : "Open /admin to see the approval queue.");
