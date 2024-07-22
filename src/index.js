import WebWorker from "./WebWorker";
import worker from "../public/worker";

class FlashFind {
    #workerPool = [];
    #dataChunks = [];
    #threadSyncFlag = 0;
    #searchResult = [];
    //   #workerScript = worker;
    #dataSource = null;

    constructor(dataSource) {
        console.log("PRASHANT");
        if (!FlashFind.instance) {
            FlashFind.instance = this;
        }

        FlashFind.instance.#dataSource = dataSource;
        return FlashFind.instance;
    }

    /**
     * Initializes the worker pool and data chunks.
     * @param {function} callback - A function to be called to fetch the search results.
     */
    init(callback) {
        this.#workerPool = [];
        for (let i = 0; i < navigator.hardwareConcurrency; i++) {
            const workerThread = new WebWorker(worker);
            this.#workerPool.push(workerThread);
            workerThread.addEventListener("message", (event) =>
                this.#handleMessage(event, callback)
            );
        }
        this.#dataChunks = this.#chunkifyRecordsPerCore(this.#dataSource);
    }

    /**
     * Handles incoming messages from worker threads.
     * @param {MessageEvent} event - The incoming message from the worker thread.
     * @param {function} callback - A function to be called to fetch the search results.
     */
    #handleMessage(event, callback) {
        const searchedRecords = event.data;

        this.#threadSyncFlag += 1;
        if (this.#threadSyncFlag === 1) {
            this.#searchResult = [...searchedRecords];
        } else {
            this.#searchResult = [...this.#searchResult, ...searchedRecords];
        }

        if (this.#threadSyncFlag === navigator.hardwareConcurrency) {
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
