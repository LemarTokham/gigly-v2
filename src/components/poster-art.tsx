/**
 * Generated poster art, ported from the prototype's `art()` SVG generator.
 *
 * Stands in for an artist photo until they upload one. Deterministic: the same
 * (seed, palette, band) always draws the same picture, so an artist looks the
 * same on the chart, on their page and in a shared Open Graph card.
 *
 * Pure and server-renderable — no hooks, no randomness beyond the seeded LCG.
 */

export const PALETTES = [
  { bg: "#FF5C9A", ink: "#1A1147", li: "#FFE0EC" },
  { bg: "#F8DF3A", ink: "#17130F", li: "#FFFBD6" },
  { bg: "#3EC6F0", ink: "#2A0F66", li: "#E0F8FF" },
  { bg: "#FF6B3D", ink: "#3B0A1E", li: "#FFE1D2" },
  { bg: "#4FD9A0", ink: "#0B3B33", li: "#E2FDF1" },
  { bg: "#9B7BFF", ink: "#150A33", li: "#ECE4FF" },
] as const;

export type BandPart = "guitar" | "mic" | "synth" | "bass" | "drums";

/** Same linear congruential generator as the prototype, so art matches it. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function limb(points: string, width = 6.5) {
  return `<polyline points="${points}" fill="none" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function torso(hair: number, seated = false) {
  let s = seated
    ? ""
    : '<path d="M-11 0 L-8 -52 L8 -52 L11 0 L4 0 L0 -38 L-4 0Z"/>';
  s +=
    '<path d="M-13 -50 Q-16 -80 -12 -93 L12 -93 Q16 -80 13 -50Z"/>' +
    '<rect x="-3.5" y="-98" width="7" height="7"/>' +
    '<circle cx="0" cy="-106" r="9.5"/>';
  if (hair === 1) s += '<circle cx="0" cy="-109" r="13.5"/>';
  if (hair === 2) s += '<path d="M-11 -110 Q0 -122 11 -110 L12 -86 L-12 -86Z"/>';
  if (hair === 3) s += '<path d="M-10 -110 Q0 -120 10 -110 L19 -108 L10 -105Z"/>';
  return s;
}

function figure(
  pose: BandPart,
  x: number,
  y: number,
  scale: number,
  flip: boolean,
  hair: number,
  li: string,
) {
  let g = `<g transform="translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})">`;

  if (pose === "guitar") {
    g +=
      torso(hair) +
      limb("12,-88 28,-76 38,-83") +
      `<g transform="translate(2 -66) rotate(-25)"><ellipse rx="16" ry="12"/><ellipse cx="12" cy="-1" rx="10" ry="8.5"/><rect x="14" y="-2.2" width="46" height="4.4"/><rect x="58" y="-4.5" width="10" height="9" rx="1.5"/><circle r="4" fill="${li}" stroke="none" opacity=".85"/></g>` +
      limb("-12,-88 -18,-70 -2,-63");
  } else if (pose === "mic") {
    g +=
      '<path d="M14 0 L14 -99" fill="none" stroke-width="2.5"/><path d="M4 0 L24 0" fill="none" stroke-width="3"/><rect x="8" y="-104" width="9" height="6" rx="3" transform="rotate(-20 12 -101)"/>' +
      torso(hair) +
      limb("12,-88 22,-82 14,-97") +
      limb(flip ? "-12,-88 -20,-70 -14,-54" : "-12,-88 -25,-100 -29,-124");
  } else if (pose === "synth") {
    g +=
      torso(hair) +
      limb("-12,-88 -24,-72 -20,-60") +
      limb("12,-88 24,-72 20,-60") +
      `<rect x="-48" y="-60" width="96" height="8" rx="2"/><rect x="-42" y="-72" width="34" height="12" rx="2"/><rect x="-2" y="-78" width="26" height="18" rx="2"/><rect x="1" y="-75" width="20" height="11" fill="${li}" stroke="none" opacity=".9"/><path d="M-40 -52 L-46 0 M40 -52 L46 0" fill="none" stroke-width="3.5"/>`;
  } else if (pose === "bass") {
    g +=
      torso(hair) +
      '<ellipse cx="24" cy="-34" rx="15" ry="22"/><ellipse cx="24" cy="-66" rx="11" ry="14"/><rect x="22.5" y="-120" width="3" height="44"/><circle cx="24" cy="-122" r="3.5"/><path d="M24 -12 L24 0" fill="none" stroke-width="2.5"/>' +
      limb("12,-88 27,-90 25,-103") +
      limb("-12,-88 -2,-66 18,-58");
  } else {
    // drums
    g +=
      `<g transform="translate(0 30)">${torso(hair, true)}${limb("-12,-88 -27,-82 -31,-98", 5.5)}${limb("12,-88 28,-80 25,-96", 5.5)}<path d="M-31 -98 L-42 -116 M25 -96 L15 -90" fill="none" stroke-width="2.2" stroke-linecap="round"/></g>` +
      `<circle cx="0" cy="-24" r="24"/><circle cx="0" cy="-24" r="17" fill="none" stroke="${li}" stroke-width="2" opacity=".7"/><ellipse cx="-15" cy="-54" rx="12" ry="8"/><ellipse cx="15" cy="-54" rx="12" ry="8"/><rect x="26" y="-44" width="22" height="30" rx="3"/><rect x="-48" y="-46" width="20" height="9" rx="2"/>` +
      '<path d="M-42 0 L-42 -84 M44 0 L44 -92 M-38 -37 L-38 0" fill="none" stroke-width="2"/><ellipse cx="-42" cy="-84" rx="21" ry="3.5"/><ellipse cx="44" cy="-92" rx="23" ry="3.5"/>';
  }

  return g + "</g>";
}

/** Builds the inner SVG markup for one artist. */
function buildArt(seed: number, palette: number, band: readonly string[], uid: string) {
  const p = PALETTES[palette % PALETTES.length];
  const r = rng(seed || 7);
  const parts = (band.length ? band : ["guitar", "mic", "drums"]) as BandPart[];

  let s =
    `<defs>` +
    `<radialGradient id="${uid}g" cx="50%" cy="50%" r="52%"><stop offset="0" stop-color="${p.li}"/><stop offset="1" stop-color="${p.li}" stop-opacity="0"/></radialGradient>` +
    `<pattern id="${uid}p" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><circle cx="3.5" cy="3.5" r="1.8" fill="${p.ink}"/></pattern>` +
    `<linearGradient id="${uid}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".7"/></linearGradient>` +
    `<mask id="${uid}m"><rect width="400" height="250" fill="url(#${uid}f)"/></mask>` +
    `</defs>` +
    `<rect width="400" height="250" fill="${p.bg}"/><rect width="400" height="250" fill="url(#${uid}g)"/>`;

  // light beams
  const nb = 3 + Math.floor(r() * 3);
  for (let i = 0; i < nb; i++) {
    const tx = 50 + r() * 300;
    const bx = tx + (r() - 0.5) * 280;
    const w = 60 + r() * 70;
    s += `<polygon points="${(tx - 5).toFixed(0)},0 ${(tx + 5).toFixed(0)},0 ${(bx + w / 2).toFixed(0)},250 ${(bx - w / 2).toFixed(0)},250" fill="${i % 3 === 2 ? p.ink : p.li}" opacity="${i % 3 === 2 ? 0.13 : 0.42}"/>`;
  }
  s += `<rect width="400" height="250" fill="url(#${uid}p)" mask="url(#${uid}m)" opacity=".6"/>`;

  if (parts.includes("synth") && parts.length < 3) {
    for (let i = 0; i < 7; i++) {
      s += `<path d="M200 96 L${i * 70 - 10} 250" stroke="${p.li}" stroke-width="1.6" opacity=".9"/>`;
    }
  }

  s += `<g fill="${p.ink}" stroke="${p.ink}" stroke-width="0">`;

  const front = parts.filter((x) => x !== "drums");
  const back = parts.filter((x) => x === "drums");

  back.forEach((_, k) => {
    const bx = back.length === 1 ? 200 : k ? 268 : 132;
    s += figure("drums", bx, 198, 0.74, false, Math.floor(r() * 4), p.li);
  });

  const solo = parts.length === 1;
  const n = front.length;
  front.forEach((x, k) => {
    const fx = solo ? 200 : 200 + (k - (n - 1) / 2) * (n > 3 ? 74 : n > 2 ? 96 : 120);
    s += figure(
      x,
      fx,
      solo ? 236 : 222,
      solo ? 1.45 : 1.02,
      k % 2 === 1 && x !== "bass",
      Math.floor(r() * 4),
      p.li,
    );
  });

  // crowd
  for (let i = 0; i < 17; i++) {
    const cx = i * 25 + r() * 12 - 6;
    const cy = (solo ? 240 : 232) + r() * 12;
    const cr = 9 + r() * 5;
    s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${cr.toFixed(1)}"/><rect x="${(cx - cr * 1.3).toFixed(1)}" y="${cy.toFixed(1)}" width="${(cr * 2.6).toFixed(1)}" height="40" rx="6"/>`;
    if (r() < 0.34) {
      const hx = cx + (r() - 0.5) * 26;
      const hy = cy - 24 - r() * 18;
      s += `<path d="M${(cx + cr * 0.8).toFixed(1)} ${(cy + 8).toFixed(1)} L${hx.toFixed(1)} ${hy.toFixed(1)}" fill="none" stroke-width="5.5" stroke-linecap="round"/>`;
      if (r() < 0.4) {
        s += `<rect x="${(hx - 4).toFixed(1)}" y="${(hy - 11).toFixed(1)}" width="8" height="12" rx="1.5" fill="${p.li}" stroke="none"/>`;
      }
    }
  }

  return s + '<rect y="246" width="400" height="4"/></g>';
}

export type PosterArtProps = {
  /** Stable per artist — their id or slug. Namespaces the SVG defs. */
  uid: string;
  seed: number;
  palette: number;
  band: readonly string[];
  className?: string;
};

export function PosterArt({ uid, seed, palette, band, className }: PosterArtProps) {
  // SVG ids must be unique per document or one artist's gradient bleeds into
  // another's. Derived from the artist slug rather than a counter, so server
  // and client markup agree and React does not warn about a mismatch.
  const safe = `a${uid.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      viewBox="0 0 400 250"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={className ?? "block h-full w-full"}
      dangerouslySetInnerHTML={{ __html: buildArt(seed, palette, band, safe) }}
    />
  );
}
