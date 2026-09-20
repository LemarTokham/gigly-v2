/**
 * Fetching other people's sites, carefully.
 *
 * Identifies as Gigly with a contact URL, obeys robots.txt for that name, and
 * never hits a host faster than once a second. robots.txt is per-user-agent:
 * a site that blocks ClaudeBot and thirty other AI crawlers by name has said
 * nothing about an app importing its gig listings, and this reads the rules
 * that actually apply to us rather than someone else's.
 */

export const USER_AGENT =
  "GiglyBot/0.1 (+https://gigly.app/about/bot; Liverpool gig listings)";

const MIN_GAP_MS = 1000;
const lastHit = new Map();
const robotsCache = new Map();

async function wait(host) {
  const since = Date.now() - (lastHit.get(host) ?? 0);
  if (since < MIN_GAP_MS) await new Promise((r) => setTimeout(r, MIN_GAP_MS - since));
  lastHit.set(host, Date.now());
}

/**
 * Minimal robots.txt: collects the rules for the most specific matching
 * user-agent group, falling back to *. Longest matching path wins, and an
 * equally long Allow beats Disallow, which is the usual convention.
 */
function parseRobots(text, agent) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const groups = [];
  let current = null;

  for (const line of lines) {
    const [rawField, ...rest] = line.split(":");
    if (!rawField || rest.length === 0) continue;
    const field = rawField.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (field === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      current.rules.push({ allow: field === "allow", path: value });
    }
  }

  const name = agent.toLowerCase();
  const exact = groups.find((g) => g.agents.some((a) => a !== "*" && name.startsWith(a)));
  const star = groups.find((g) => g.agents.includes("*"));
  return (exact ?? star)?.rules ?? [];
}

function allowedBy(rules, path) {
  let best = null;
  for (const rule of rules) {
    if (!rule.path) continue;
    // a bare * or $ is more than this needs; prefix matching covers real files
    const prefix = rule.path.replace(/\*$/, "");
    if (!path.startsWith(prefix)) continue;
    if (!best || prefix.length > best.len || (prefix.length === best.len && rule.allow)) {
      best = { allow: rule.allow, len: prefix.length };
    }
  }
  return best ? best.allow : true;
}

async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);

  let rules = [];
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } });
    // No robots.txt at all means no restrictions. A 5xx means we cannot tell,
    // so treat it as closed rather than helping ourselves.
    if (res.ok) rules = parseRobots(await res.text(), USER_AGENT);
    else if (res.status >= 500) rules = [{ allow: false, path: "/" }];
  } catch {
    rules = [{ allow: false, path: "/" }];
  }

  robotsCache.set(origin, rules);
  return rules;
}

/** True if robots.txt permits us to fetch this URL. */
export async function allowed(url) {
  const u = new URL(url);
  return allowedBy(await robotsFor(u.origin), u.pathname);
}

/**
 * Fetch, refusing anything robots.txt disallows and pausing between requests
 * to the same host.
 */
export async function politeFetch(url, init = {}) {
  const u = new URL(url);

  if (!(await allowed(url))) {
    throw new Error(`robots.txt disallows ${u.pathname} on ${u.host}`);
  }

  await wait(u.host);
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json", ...init.headers },
    redirect: "follow",
  });

  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}
