import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync("/Users/lemar/projects/gigly-v2/gigly-prototype.html", "utf8");

// pull out `var NAME=[ ... ];` array literals from the prototype's script block
function grab(name) {
  const start = html.indexOf(`var ${name}=[`);
  if (start < 0) throw new Error(`${name} not found`);
  const open = html.indexOf("[", start);
  let depth = 0, i = open;
  for (; i < html.length; i++) {
    if (html[i] === "[") depth++;
    else if (html[i] === "]") { depth--; if (depth === 0) break; }
  }
  return eval(html.slice(open, i + 1));
}

const out = { VENUES: grab("VENUES"), ARTISTS: grab("ARTISTS"), GIGS: grab("GIGS"), GROUPS: grab("GROUPS") };
writeFileSync(`${process.argv[2]}/prototype-data.json`, JSON.stringify(out, null, 2));

const up = out.GIGS.filter(g => g.day >= 0), past = out.GIGS.filter(g => g.day < 0);
console.log(`venues   ${out.VENUES.length}`);
console.log(`artists  ${out.ARTISTS.length}   total seed hypes ${out.ARTISTS.reduce((n,a)=>n+a.hypes,0)}`);
console.log(`gigs     ${out.GIGS.length}  (${up.length} upcoming, ${past.length} past)`);
console.log(`groups   ${out.GROUPS.join(", ")}`);
console.log(`\ndistinct genres -> group mapping:`);
for (const a of out.ARTISTS) console.log(`  ${a.genre.padEnd(20)} -> ${a.group}`);
console.log(`\nartists with no upcoming gig (ineligible for chart):`);
const withGig = new Set(up.flatMap(g => g.lineup));
console.log("  " + (out.ARTISTS.filter(a=>!withGig.has(a.id)).map(a=>a.name).join(", ") || "(none)"));
