import WebWorker from "./WebWorker";
import worker from "../public/worker";

class FlashFind {
    #workerPool = [];
    #dataChunks = [];
    #threadSyncFlag = 0;
    #searchResult = [];
    //   #workerScript = worker;
    #dataSource = null;
    #callback = undefined;
    fuseConfig = {}

    constructor(dataSource, fuseConfig = {}) {

        // singleton instance
        // if (!FlashFind.instance) {
        //     FlashFind.instance = this;
        // }

        this.#dataSource = dataSource;
        this.fuseConfig = fuseConfig;
    }

    /**
     * Initializes the worker pool and data chunks.
     * @param {function} callback - A function to be called to fetch the search results.
     */
    init(callback) {
        this.#workerPool = [];
        this.#callback = callback;
        for (let i = 0; i < navigator.hardwareConcurrency; i++) {
            const workerThread = new WebWorker(worker);
            this.#workerPool.push(workerThread);
            workerThread.addEventListener("message", (event) =>
                this.#handleMessage(event, callback)
            );
        }
        this.#dataChunks = this.#chunkifyRecordsPerCore(this.#dataSource);
    }

    updateDataSource(dataSource) { 
        this.#dataSource = dataSource;
        this.#dataChunks = this.#chunkifyRecordsPerCore(this.#dataSource);
    }

    /**
     * Handles incoming messages from worker threads.
     * @param {MessageEvent} event - The incoming message from the worker thread.
     * @param {function} callback - A function to be called to fetch the search results.
     */
    #handleMessage(event, callback) {
        const searchedRecords = event.data ? event.data : [];
        this.#threadSyncFlag += 1;
        if (this.#threadSyncFlag === 1) {
            this.#searchResult = [...searchedRecords];
        } else {
            this.#searchResult = [...this.#searchResult, ...searchedRecords];
        }

        // Check if all workers have finished
        if (this.#threadSyncFlag === navigator.hardwareConcurrency) {
            // Sort the search result based on the 'score' property (lower score means higher relevancy)
            this.#searchResult.sort((a, b) => (a.flashScore || 1) - (b.flashScore || 1));

            // Return the sorted result
            callback(this.#searchResult);
        }
    }

    /**
     * Splits the input data into chunks, with each chunk being processed by a separate worker thread.
     * @param {Array} data - The input data to be processed.
     * @returns {Array} An array of arrays, where each sub-array represents a chunk of data.
     */
    #chunkifyRecordsPerCore(data) {
        const recordsPerCore = [];
        let prevIdx = 0;
        for (let core = 0; core < this.#workerPool.length; core++) {
            recordsPerCore.push(
                data.slice(
                    prevIdx,
                    prevIdx + Math.ceil(data.length / this.#workerPool.length)
                )
            );
            prevIdx += Math.ceil(data.length / this.#workerPool.length);
        }
        return recordsPerCore;
    }

    /**
     * Searches the input data for the given query.
     * @param {String} query - The query to be searched.
     * @returns {Array} An array of records that match the given query.
     */
    search(query) {
        this.#threadSyncFlag = 0;
        this.#searchResult = [];

        // If query is an empty string, return dataSource as it is
        if (query?.trim() === '') {
            this.#callback(this.#dataSource)
            return
        }

        const taskQueue = [];

        const isWorkerAvailable = () => {
            return this.#workerPool.some((worker) => !worker.isBusy);
        };

        const executePendingTasks = () => {
            while (taskQueue.length > 0 && isWorkerAvailable()) {
                const task = taskQueue.shift();
                executeTask(task);
            }
        };

        const executeTask = ({ idx, workerThread }) => {
            workerThread.isBusy = true;
            workerThread.postMessage({
                record: this.#dataChunks[idx],
                searchText: `${query}`,
                fuseConfig: this.fuseConfig
            });

            workerThread.addEventListener("message", () => {
                workerThread.isBusy = false;
                executePendingTasks();
            });
        };

        for (const [idx, workerThread] of this.#workerPool.entries()) {
            if (isWorkerAvailable()) {
                executeTask({ idx, workerThread });
            } else {
                taskQueue.push({ idx, workerThread });
            }
        }
    }
}

export default FlashFind;
