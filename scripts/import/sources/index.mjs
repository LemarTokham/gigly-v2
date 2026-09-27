/**
 * Import sources.
 *
 * A source turns somebody else's listings into gigs Gigly understands. Add one
 * here and the runner picks it up; nothing else changes.
 *
 *   export default {
 *     name: "skiddle",              // also the `source` column value
 *     label: "Skiddle",
 *     trusted: true,                // publish without review
 *     async fetch({ venues }) {     // venues: [{ id, slug, name }]
 *       return [{
 *         sourceRef: "12345",       // their id for this event — the dedupe key
 *         venueSlug: "future-yard",
 *         title: "Dock Leaf: Album Launch",
 *         artistName: "Dock Leaf",  // only if the feed names them; never guessed
 *         support: ["Nan's Carpet"],
 *         startsAt: new Date(...),
 *         pricePence: 800,
 *         ticketUrl: "https://...",
 *       }];
 *     },
 *   };
 *
 * A source that is not marked trusted lands as pending, so a new or shaky
 * adapter shows up in the approval queue rather than on the chart.
 *
 * Skiddle covers most Liverpool rooms and is where The Jacaranda's own
 * listings come from. Their API is documented as non-commercial use only.
 */
import skiddle from "./skiddle.mjs";

export const SOURCES = [skiddle];
