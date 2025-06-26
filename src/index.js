import WebWorker from "./WebWorker";
import worker from "../public/worker";

class FlashFind {
    #dataSource = null;
    #callback = undefined;
    #activeWorkers = new Set();
    #isSearching = false;
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
    }

    updateDataSource(dataSource) {
        this.#dataSource = dataSource;
        // Terminate any active workers when data source changes
        this.#terminateAllWorkers();
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
     * Searches the input data for the given query.
     * @param {String} query - The query to be searched.
     * @returns {Array} An array of records that match the given query.
     */
    search(query) {
        // Prevent concurrent searches
        if (this.#isSearching) {
            return;
        }

        // If query is an empty string, return dataSource as it is
        if (query?.trim() === '') {
            this.#callback(this.#dataSource);
            return;
        }

        this.#isSearching = true;

        // Terminate any existing workers before starting new search
        this.#terminateAllWorkers();

        const workerCount = navigator.hardwareConcurrency;
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
     * Cleanup method to terminate all workers and reset state.
     * Call this when the FlashFind instance is no longer needed.
     */
    destroy() {
        this.#terminateAllWorkers();
        this.#callback = undefined;
        this.#dataSource = null;
    }
}

export default FlashFind;
