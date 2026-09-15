import WebWorker from "./WebWorker.js";
import worker from "../public/worker.js";

/**
 * Minimum records a worker must be given before spawning another one is worth
 * it. Each worker costs a Worker construction, a Blob URL, an importScripts
 * round-trip for Fuse, and a postMessage of its chunk in each direction -
 * roughly 13ms of fixed overhead on a 10-core machine whether it searches
 * 2 records or 2000. Below this threshold that overhead dominates the search
 * itself, so we scale worker count to the data instead of always using every
 * core.
 */
const MIN_RECORDS_PER_WORKER = 2000;

class FlashFind {
    #dataSource = null;
    #callback = undefined;
    #activeWorkers = new Set();
    #isSearching = false;
    #pendingQuery = null;
    fuseConfig = {}

    constructor(dataSource, fuseConfig = {}) {
        this.#dataSource = dataSource;
        this.fuseConfig = fuseConfig;
    }

    /**
     * Initializes the callback for search results.
     * @param {function} callback - A function to be called to fetch the search results.
     */
    init(callback) {
        this.#callback = callback;
        // Clean up any existing workers
        this.#terminateAllWorkers();
        this.#pendingQuery = null;
    }

    updateDataSource(dataSource) {
        this.#dataSource = dataSource;
        // Terminate any active workers when data source changes
        this.#terminateAllWorkers();
        this.#pendingQuery = null;
    }

    /**
     * Terminates all active workers and clears the active workers set.
     */
    #terminateAllWorkers() {
        this.#activeWorkers.forEach(worker => {
            worker.terminate();
        });
        this.#activeWorkers.clear();
        this.#isSearching = false;
    }

    /**
     * Splits the input data into chunks, with each chunk being processed by a separate worker thread.
     * @param {Array} data - The input data to be processed.
     * @param {number} workerCount - Number of workers to split data for.
     * @returns {Array} An array of arrays, where each sub-array represents a chunk of data.
     */
    #chunkifyRecordsPerCore(data, workerCount) {
        const recordsPerCore = [];
        let prevIdx = 0;
        for (let core = 0; core < workerCount; core++) {
            recordsPerCore.push(
                data.slice(
                    prevIdx,
                    prevIdx + Math.ceil(data.length / workerCount)
                )
            );
            prevIdx += Math.ceil(data.length / workerCount);
        }
        return recordsPerCore;
    }

    /**
     * Decides how many workers to use for a given record count.
     *
     * Returns at least 1, never more than the number of cores, and otherwise
     * one worker per MIN_RECORDS_PER_WORKER records. A 100-record dataset gets
     * a single worker rather than ten mostly-empty ones.
     *
     * @param {number} recordCount
     * @returns {number}
     */
    #workerCountFor(recordCount) {
        const cores = navigator.hardwareConcurrency || 1;
        const needed = Math.ceil(recordCount / MIN_RECORDS_PER_WORKER);
        return Math.max(1, Math.min(cores, needed));
    }

    /**
     * Searches the input data for the given query.
     *
     * Results are delivered to the callback registered in init(); this returns
     * nothing. If a search is already running, the query is held and run when
     * that one finishes - only the most recent held query survives, so a fast
     * typist collapses to one follow-up search rather than a queue of stale
     * ones.
     *
     * @param {String} query - The query to be searched.
     */
    search(query) {
        // Empty query short-circuits to the full dataset without any worker.
        if (query?.trim() === '') {
            this.#pendingQuery = null;
            this.#terminateAllWorkers();
            this.#callback(this.#dataSource);
            return;
        }

        // Supersede: keep only the latest query rather than tearing down the
        // in-flight search (which loses its result) or discarding this one.
        if (this.#isSearching) {
            this.#pendingQuery = query;
            return;
        }

        this.#dispatch(query);
    }

    /**
     * Fans a query out across workers. Assumes no search is currently running.
     * @param {String} query
     */
    #dispatch(query) {
        // Order matters: #terminateAllWorkers() clears #isSearching, so the
        // flag has to be raised after it, not before.
        this.#terminateAllWorkers();
        this.#isSearching = true;

        const workerCount = this.#workerCountFor(this.#dataSource?.length ?? 0);
        const dataChunks = this.#chunkifyRecordsPerCore(this.#dataSource, workerCount);

        let completedWorkers = 0;
        let searchResults = [];

        // Create workers on-demand for this search
        for (let i = 0; i < workerCount; i++) {
            const workerThread = new WebWorker(worker);
            this.#activeWorkers.add(workerThread);

            workerThread.addEventListener("message", (event) => {
                const searchedRecords = event.data ? event.data : [];
                searchResults = [...searchResults, ...searchedRecords];
                completedWorkers++;

                // Check if all workers have finished
                if (completedWorkers === workerCount) {
                    // Sort the search result based on the 'score' property (lower score means higher relevancy)
                    searchResults.sort((a, b) => (a.flashScore || 1) - (b.flashScore || 1));

                    // Return the sorted result
                    this.#callback(searchResults);

                    // Terminate all workers after search completes
                    this.#terminateAllWorkers();

                    // Run whatever the user typed while this was in flight.
                    this.#runPendingQuery();
                }
            });

            // Send work to the worker
            workerThread.postMessage({
                record: dataChunks[i],
                searchText: `${query}`,
                fuseConfig: this.fuseConfig
            });
        }
    }

    /**
     * Runs the most recent query received while a search was in flight, if any.
     */
    #runPendingQuery() {
        if (this.#pendingQuery === null) return;
        const next = this.#pendingQuery;
        this.#pendingQuery = null;
        this.search(next);
    }

    /**
     * Cleanup method to terminate all workers and reset state.
     * Call this when the FlashFind instance is no longer needed.
     */
    destroy() {
        this.#terminateAllWorkers();
        this.#pendingQuery = null;
        this.#callback = undefined;
        this.#dataSource = null;
    }
}

export default FlashFind;
