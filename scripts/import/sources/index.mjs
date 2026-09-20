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
 * Nothing registered yet: of the eight venues, two have sites that are
 * realistically scrapeable and neither publishes structured event data, so a
 * feed like Skiddle is the first adapter worth writing.
 */
export const SOURCES = [];
