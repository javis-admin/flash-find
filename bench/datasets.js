/**
 * Deterministic dataset generation.
 *
 * Every run must produce byte-identical data for a given (size, shape, seed),
 * otherwise run-to-run deltas are dataset noise rather than code changes.
 * Math.random() is therefore never used here.
 */

/**
 * mulberry32 - small, fast, seedable PRNG.
 * @param {number} seed
 * @returns {function(): number} generator yielding floats in [0, 1)
 */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const FIRST_NAMES = [
    "Aarav", "Priya", "Rohan", "Nitish", "Ananya", "Vikram", "Meera", "Arjun",
    "Kavya", "Sanjay", "Divya", "Rahul", "Isha", "Karan", "Neha", "Aditya",
    "Pooja", "Manish", "Sneha", "Varun", "Ritu", "Amit", "Shreya", "Nikhil",
];

const LAST_NAMES = [
    "Sharma", "Patel", "Reddy", "Nair", "Iyer", "Kumar", "Singh", "Gupta",
    "Mehta", "Joshi", "Desai", "Rao", "Chopra", "Malhotra", "Bose", "Banerjee",
];

const DEPARTMENTS = [
    "Engineering", "Design", "Product", "Marketing", "Sales", "Support",
    "Finance", "Operations", "Legal", "Research",
];

const CITIES = [
    "Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Pune", "Chennai",
    "Kolkata", "Ahmedabad", "Jaipur", "Surat",
];

const WORDS = [
    "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
    "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
    "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
    "xray", "yankee", "zulu", "quartz", "nebula", "cascade", "harbor",
];

/**
 * A rare token planted at a known, fixed rate so "few hits" scenarios are
 * reproducible rather than dependent on whatever the PRNG happened to emit.
 */
export const RARE_TOKEN = "zyxwvu";

/** Roughly 1 in RARE_EVERY records carries RARE_TOKEN. */
export const RARE_EVERY = 5000;

function pick(rand, arr) {
    return arr[Math.floor(rand() * arr.length)];
}

/**
 * Builds a description string of approximately `wordCount` words.
 * Longer descriptions materially change Fuse cost, so this is a bench knob.
 */
function makeDescription(rand, wordCount) {
    const parts = [];
    for (let i = 0; i < wordCount; i++) parts.push(pick(rand, WORDS));
    return parts.join(" ");
}

/**
 * Dataset shapes. Each shape controls field count and text volume per record,
 * which are the two properties that drive Fuse indexing cost.
 *
 * - narrow: 3 short fields, closest to an autocomplete list
 * - typical: 6 fields with a short description, the common app case
 * - wide: 6 fields with a long description, stress case for indexing
 */
export const SHAPES = {
    narrow: { descriptionWords: 0, includeExtras: false },
    typical: { descriptionWords: 12, includeExtras: true },
    wide: { descriptionWords: 60, includeExtras: true },
};

/**
 * Generates a deterministic record set.
 *
 * @param {number} size - number of records
 * @param {string} shape - key of SHAPES
 * @param {number} seed - PRNG seed; same seed always yields the same data
 * @returns {Array<Object>} the dataset
 */
export function generateDataset(size, shape = "typical", seed = 20260910) {
    const cfg = SHAPES[shape];
    if (!cfg) throw new Error(`Unknown dataset shape: ${shape}`);

    const rand = mulberry32(seed);
    const out = new Array(size);

    for (let i = 0; i < size; i++) {
        const first = pick(rand, FIRST_NAMES);
        const last = pick(rand, LAST_NAMES);

        const record = {
            id: `REC-${String(i).padStart(7, "0")}`,
            name: `${first} ${last}`,
            department: pick(rand, DEPARTMENTS),
        };

        if (cfg.includeExtras) {
            record.city = pick(rand, CITIES);
            record.email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`;
        }

        if (cfg.descriptionWords > 0) {
            record.description = makeDescription(rand, cfg.descriptionWords);
        }

        // Plant the rare token at a fixed cadence for reproducible low-hit queries.
        if (i % RARE_EVERY === 0) {
            record.department = `${record.department} ${RARE_TOKEN}`;
        }

        out[i] = record;
    }

    return out;
}

/**
 * Fields searched by every candidate. Kept explicit and identical across
 * candidates so FlashFind and the baselines are not searching different
 * amounts of text - otherwise the comparison is meaningless.
 *
 * NOTE: the shipping worker defaults to Object.keys(data[0]) when no
 * fuseConfig is supplied, which would include the `id` field. We pass keys
 * explicitly to every candidate to keep the comparison fair and stable.
 */
export function keysForShape(shape) {
    const cfg = SHAPES[shape];
    const keys = ["name", "department"];
    if (cfg.includeExtras) keys.push("city", "email");
    if (cfg.descriptionWords > 0) keys.push("description");
    return keys;
}
