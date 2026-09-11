/**
 * Query scenarios.
 *
 * Query character drives cost as much as dataset size does: a query matching
 * nothing exits Fuse's scoring early, while one matching 40% of the corpus
 * pays full scoring cost AND serializes a huge result array back over
 * postMessage. These are separate code paths and are reported separately.
 */

import { RARE_TOKEN } from "./datasets.js";

/**
 * Single-shot query scenarios. `expect` documents intent only; it is not
 * asserted, because Fuse's fuzzy threshold makes exact counts brittle.
 */
export const QUERY_SCENARIOS = [
    {
        id: "exact-common",
        query: "Engineering",
        description: "Exact token matching a large share of records",
        expect: "many hits",
    },
    {
        id: "exact-name",
        query: "Priya Sharma",
        description: "Two-token exact-ish name match",
        expect: "moderate hits",
    },
    {
        id: "prefix",
        query: "Engin",
        description: "Prefix of a common token, the search-as-you-type case",
        expect: "many hits",
    },
    {
        id: "fuzzy-typo",
        query: "Enginnering",
        description: "Single transposed-letter typo; exercises fuzzy scoring",
        expect: "many hits",
    },
    {
        id: "single-char",
        query: "a",
        description: "One character; worst case for candidate set size",
        expect: "very many hits",
    },
    {
        id: "rare-token",
        query: RARE_TOKEN,
        description: "Planted rare token; few hits, full corpus still scanned",
        expect: "few hits",
    },
    {
        id: "zero-hits",
        query: "qqqqzzzzjjjj",
        description: "Matches nothing; measures the floor cost of a search",
        expect: "no hits",
    },
    {
        id: "long-phrase",
        query: "alpha bravo charlie delta echo",
        description: "Long multi-token phrase; heaviest per-record scoring",
        expect: "varies",
    },
];

/**
 * Typing simulation.
 *
 * Fires one search per keystroke at a fixed interval, WITHOUT waiting for the
 * previous search to complete. This is what a real search-as-you-type input
 * does, and it is the only way to observe FlashFind's concurrent-search
 * guard (src/index.js:71) dropping queries on the floor.
 *
 * `intervalMs` of 80 approximates a fast typist (~150 wpm). Slower typists
 * drop fewer queries, so this is a deliberate stress case, not an average.
 */
export const TYPING_SCENARIOS = [
    {
        id: "typing-fast",
        target: "Engineering",
        intervalMs: 80,
        description: "Types 'Engineering' one char at a time at 80ms intervals",
    },
    {
        id: "typing-relaxed",
        target: "Engineering",
        intervalMs: 200,
        description: "Types 'Engineering' at a relaxed 200ms cadence",
    },
];

/**
 * Expands a target string into its cumulative prefixes, i.e. the sequence of
 * query values an input element would actually hold as the user types.
 * @param {string} target
 * @returns {string[]}
 */
export function keystrokesFor(target) {
    const out = [];
    for (let i = 1; i <= target.length; i++) out.push(target.slice(0, i));
    return out;
}
