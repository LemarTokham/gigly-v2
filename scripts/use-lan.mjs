/**
 * Points the dev setup at this machine's LAN address so a phone on the same
 * network can use it.
 *
 *   pnpm dev:lan
 *
 * 127.0.0.1 in NEXT_PUBLIC_SUPABASE_URL is baked into the JavaScript sent to
 * the browser, and on a phone that means the phone itself — so the page loads
 * and every request then fails. The LAN address works from both machines, so
 * there is no mode to switch between.
 *
 * Re-run it if your router hands out a different address.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const lan = Object.values(networkInterfaces())
  .flat()
  .find((n) => n && n.family === "IPv4" && !n.internal)?.address;

if (!lan) {
  console.error("No LAN address found. Are you on wifi?");
  process.exit(1);
}

// --- .env.local: only the two URLs, everything else left alone -------------
const envPath = "apps/web/.env.local";
let env = readFileSync(envPath, "utf8");
const before = env;

env = env.replace(
  /^NEXT_PUBLIC_SUPABASE_URL=.*$/m,
  `NEXT_PUBLIC_SUPABASE_URL=http://${lan}:54321`,
);
env = env.replace(
  /^NEXT_PUBLIC_SITE_URL=.*$/m,
  `NEXT_PUBLIC_SITE_URL=http://${lan}:3000`,
);
if (env !== before) writeFileSync(envPath, env);

// --- config.toml: auth redirects have to allow the same origin -------------
const tomlPath = "supabase/config.toml";
let toml = readFileSync(tomlPath, "utf8");
const tomlBefore = toml;

toml = toml.replace(/^site_url = ".*"$/m, `site_url = "http://${lan}:3000"`);
toml = toml.replace(
  /^additional_redirect_urls = \[.*\]$/m,
  `additional_redirect_urls = ["http://${lan}:3000", "http://${lan}:3000/**", "http://localhost:3000", "http://localhost:3000/**"]`,
);
const tomlChanged = toml !== tomlBefore;
if (tomlChanged) writeFileSync(tomlPath, toml);

console.log(`\nLAN address: ${lan}\n`);
console.log(`  On your phone:  http://${lan}:3000`);
console.log(`  Supabase:       http://${lan}:54321`);
if (tomlChanged) {
  console.log(`\nAuth redirects changed, so restart the stack:\n  pnpm db:stop && pnpm db:start`);
}
console.log(
  `\nGoogle Maps will refuse to draw until you add this to the key's\n` +
    `HTTP referrer restrictions:  http://${lan}:3000/*\n`,
);
