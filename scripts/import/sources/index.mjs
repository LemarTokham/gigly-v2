/**
 * Import sources.
 *
 * A source turns somebody else's listings into gigs Gigly understands. Add one
 * here and the runner picks it up; nothing else changes.
 *
 *   export default {
 *     name: "skiddle",              // also the `source` column value
 *     label: "Skiddle",
 *     async fetch({ venues }) {     // venues: [{ id, slug, name }]
 *       return [{
 *         sourceRef: "12345",       // their id for this event — the dedupe key
 *         venueSlug: "future-yard",
 *         artistName: "Dock Leaf",
 *         support: ["Nan's Carpet"],
 *         startsAt: new Date(...),
 *         pricePence: 800,
 *         ticketUrl: "https://...",
 *       }];
 *     },
 *   };
 *
 * Everything a source returns lands as pending, so a broken adapter shows up
 * in the approval queue rather than on the chart.
 *
 * Skiddle covers most Liverpool rooms and is where The Jacaranda's own
 * listings come from. Their API is documented as non-commercial use only.
 */
import skiddle from "./skiddle.mjs";

export const SOURCES = [skiddle];
