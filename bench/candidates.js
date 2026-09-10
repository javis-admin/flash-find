/**
 * Search candidates behind one async interface.
 *
 * Every candidate exposes:
 *   setup(dataset, keys) -> Promise<handle>
 *   search(handle, query) -> Promise<results>
 *   teardown(handle)      -> void
 *
 * FlashFind is used exactly as it ships (the UMD bundle from dist/), with no
 * patches. Worker count is varied by overriding navigator.hardwareConcurrency
 * in the page before construction, since src/index.js reads it directly.
 */

/**
 * Fuse options shared by every Fuse-based candidate so that FlashFind and the
 * single-threaded baseline are doing identical work per record. These mirror
 * the worker's built-in defaults (public/worker.js) except that keys are
 * passed explicitly rather than derived from Object.keys(data[0]).
 */
export function fuseOptionsFor(keys) {
    return {
        threshold: 0.3,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        includeScore: true,
        keys,
    };
}

/**
 * Builds a FlashFind-backed candidate from a given constructor.
 *
 * The callback API (search() returns void; results arrive via the callback
 * registered in init()) is adapted to a promise. Crucially, the callback may
 * NEVER fire - both when the concurrent-search guard drops a query and when
 * a worker throws - so the harness always applies a timeout guard.
 */
function makeFlashFindCandidate({ id, label, getCtor }) {
    return {
        id,
        label,

        async setup(dataset, keys) {
            const Ctor = getCtor();
            const instance = new Ctor(dataset, fuseOptionsFor(keys));
            // Queue of resolvers for searches the library actually accepted,
            // in dispatch order. FlashFind serializes searches (it refuses a
            // new one while another is in flight), so at most one is ever
            // outstanding - but a queue keeps this robust either way.
            const state = { queue: [], instance, inFlight: false };
            instance.init((results) => {
                state.inFlight = false;
                const resolve = state.queue.shift();
                if (resolve) resolve(results || []);
            });
            return state;
        },

        /**
         * Resolves with results, or with DROPPED_SYNC if the library refused
         * the search outright.
         *
         * The refusal is detected synchronously rather than by timeout:
         * FlashFind's guard (src/index.js:71) returns before dispatching any
         * worker when a search is already in flight. We mirror that state, so
         * a dropped query is identified instantly instead of costing a full
         * timeout. This is what makes the typing simulation tractable.
         *
         * A timeout guard still applies in the harness to catch the OTHER
         * failure mode - a search that dispatches but whose workers throw,
         * which is exactly what the broken bundle does.
         */
        search(state, query) {
            // Empty query is special-cased by the library: it invokes the
            // callback synchronously and never sets the in-flight flag.
            const isEmpty = query?.trim() === "";

            if (state.inFlight && !isEmpty) {
                return Promise.resolve(DROPPED_SYNC);
            }

            return new Promise((resolve) => {
                state.queue.push(resolve);
                if (!isEmpty) state.inFlight = true;
                state.instance.search(query);
            });
        },

        teardown(state) {
            if (state?.instance?.destroy) state.instance.destroy();
            state.queue.length = 0;
            state.inFlight = false;
        },
    };
}

/**
 * Sentinel returned when the library synchronously refused a search.
 * Distinct from a timeout, which means the search started but never finished.
 */
export const DROPPED_SYNC = Symbol("dropped-sync");

/**
 * Candidate 1: FlashFind loaded from ES source (untranspiled).
 *
 * This runs the library's real algorithm - worker fan-out, per-query Fuse
 * index construction, chunking, result merge - without the Babel spread-helper
 * defect that breaks the shipped bundle. This is the candidate that produces
 * meaningful performance numbers for the library's DESIGN.
 */
export const flashFindCandidate = makeFlashFindCandidate({
    id: "flashfind",
    label: "FlashFind (ES source)",
    getCtor: () => self.FlashFindESM,
});

/**
 * Candidate 1b: the actual shipped dist/bundle.js.
 *
 * Expected to time out on every Fuse-path search because each worker throws
 * `ReferenceError: s is not defined`. Included deliberately so the defect
 * appears in the results table rather than being papered over by the ES
 * source workaround. Run it with few iterations - every call costs a full
 * timeout.
 */
export const flashFindBundleCandidate = makeFlashFindCandidate({
    id: "flashfind-bundle",
    label: "FlashFind (shipped dist/bundle.js)",
    getCtor: () => self.FlashFind,
});

/**
 * Candidate 2: plain Fuse.js on the main thread, index rebuilt per query.
 *
 * This is the apples-to-apples control for FlashFind, which also rebuilds its
 * index every query (public/worker.js:38). Any FlashFind win here is a real
 * parallelism win, not an indexing-strategy artifact.
 */
export const fuseSyncRebuildCandidate = {
    id: "fuse-sync-rebuild",
    label: "Fuse.js sync, index rebuilt per query",

    async setup(dataset, keys) {
        return { dataset, options: fuseOptionsFor(keys) };
    },

    async search(state, query) {
        const fuse = new self.Fuse(state.dataset, state.options);
        return fuse.search(query).map((r) => ({ ...r.item, flashScore: r.score }));
    },

    teardown() {},
};

/**
 * Candidate 3: plain Fuse.js on the main thread, index built ONCE at setup.
 *
 * Represents the obvious optimization FlashFind does not currently do. The
 * gap between this and fuse-sync-rebuild is the price of per-query indexing.
 */
export const fuseSyncPrebuiltCandidate = {
    id: "fuse-sync-prebuilt",
    label: "Fuse.js sync, index built once",

    async setup(dataset, keys) {
        return { fuse: new self.Fuse(dataset, fuseOptionsFor(keys)) };
    },

    async search(state, query) {
        return state.fuse.search(query).map((r) => ({ ...r.item, flashScore: r.score }));
    },

    teardown() {},
};

/**
 * Candidate 4: naive substring filter on the main thread.
 *
 * Not fuzzy, so not feature-equivalent - included as the performance floor.
 * If fuzzy matching is not actually required, this is what it is competing
 * against, and the comparison is worth seeing.
 */
export const naiveFilterCandidate = {
    id: "naive-filter",
    label: "Array.filter substring (not fuzzy)",

    async setup(dataset, keys) {
        return { dataset, keys };
    },

    async search(state, query) {
        const q = query.trim().toLowerCase();
        if (q === "") return state.dataset;
        return state.dataset.filter((rec) =>
            state.keys.some((k) => String(rec[k] ?? "").toLowerCase().includes(q))
        );
    },

    teardown() {},
};

export const CANDIDATES = [
    flashFindCandidate,
    flashFindBundleCandidate,
    fuseSyncRebuildCandidate,
    fuseSyncPrebuiltCandidate,
    naiveFilterCandidate,
];

/** Candidates whose worker count varies with navigator.hardwareConcurrency. */
export const WORKER_BASED_CANDIDATE_IDS = new Set(["flashfind", "flashfind-bundle"]);

export function candidateById(id) {
    const c = CANDIDATES.find((x) => x.id === id);
    if (!c) throw new Error(`Unknown candidate: ${id}`);
    return c;
}
