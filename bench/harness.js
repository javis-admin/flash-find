/**
 * In-page measurement core.
 *
 * Runs inside the browser. Knows nothing about Playwright, so the same code
 * backs both the automated driver and manual exploration in runner.html.
 */

import { generateDataset, keysForShape } from "./datasets.js";
import { QUERY_SCENARIOS, TYPING_SCENARIOS, keystrokesFor } from "./scenarios.js";
import { candidateById, WORKER_BASED_CANDIDATE_IDS, DROPPED_SYNC } from "./candidates.js";

/**
 * A search that dispatched but never called back is treated as FAILED after
 * this long. This catches broken workers (see the shipped-bundle defect).
 *
 * Kept modest because it is a failure path, not a latency measurement: a
 * legitimate search on the largest dataset completes far under this. Searches
 * the library refuses outright are detected synchronously instead, so they
 * never reach this timeout.
 */
const SEARCH_TIMEOUT_MS = 5000;

/* ------------------------------------------------------------------ *
 * Statistics
 * ------------------------------------------------------------------ */

/**
 * Percentile via linear interpolation between closest ranks.
 * @param {number[]} sorted - ascending, non-empty
 * @param {number} p - 0..100
 */
export function percentile(sorted, p) {
    if (sorted.length === 0) return null;
    if (sorted.length === 1) return sorted[0];
    const rank = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/**
 * Summarizes a sample set. Means are included but the report leads with
 * percentiles, since tail latency is what users actually perceive.
 */
export function summarize(samples) {
    if (!samples.length) {
        return { n: 0, min: null, p50: null, p95: null, p99: null, max: null, mean: null, stddev: null };
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((acc, x) => acc + (x - mean) ** 2, 0) / samples.length;
    return {
        n: samples.length,
        min: sorted[0],
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        max: sorted[sorted.length - 1],
        mean,
        stddev: Math.sqrt(variance),
    };
}

/* ------------------------------------------------------------------ *
 * Main-thread blocking
 * ------------------------------------------------------------------ */

/**
 * Measures main-thread responsiveness, which is FlashFind's core claim.
 *
 * Two independent signals are collected because they answer different
 * questions and have different blind spots:
 *
 * 1. Long Tasks (PerformanceObserver 'longtask'): browser-reported tasks
 *    over 50ms. Authoritative, but only counts tasks ABOVE the threshold.
 * 2. Timer lag: a repeating timer whose actual vs. scheduled delay reveals
 *    blocking of any size, including many small stalls a long-task observer
 *    would miss entirely.
 *
 * Total Blocking Time is the standard derived metric: the sum of the portion
 * of each long task exceeding 50ms.
 */
export class MainThreadMonitor {
    constructor(tickMs = 8) {
        this.tickMs = tickMs;
        this.longTasks = [];
        this.lags = [];
        this.observer = null;
        this.timer = null;
        this.supported = typeof PerformanceObserver !== "undefined";
    }

    start() {
        this.longTasks = [];
        this.lags = [];

        if (this.supported) {
            try {
                this.observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.longTasks.push({ start: entry.startTime, duration: entry.duration });
                    }
                });
                this.observer.observe({ entryTypes: ["longtask"] });
            } catch {
                // longtask unsupported in this browser; timer lag still works.
                this.observer = null;
            }
        }

        let expected = performance.now() + this.tickMs;
        const tick = () => {
            const now = performance.now();
            const lag = now - expected;
            if (lag > 0) this.lags.push(lag);
            expected = now + this.tickMs;
            this.timer = setTimeout(tick, this.tickMs);
        };
        this.timer = setTimeout(tick, this.tickMs);
    }

    stop() {
        if (this.observer) {
            // Drain any entries still queued in the observer before disconnecting.
            try {
                for (const entry of this.observer.takeRecords()) {
                    this.longTasks.push({ start: entry.startTime, duration: entry.duration });
                }
            } catch { /* takeRecords may be unavailable; ignore */ }
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        const totalBlockingTime = this.longTasks.reduce(
            (acc, t) => acc + Math.max(0, t.duration - 50),
            0
        );
        const longTaskDurations = this.longTasks.map((t) => t.duration);

        return {
            longTaskCount: this.longTasks.length,
            longTaskTotalMs: longTaskDurations.reduce((a, b) => a + b, 0),
            longestTaskMs: longTaskDurations.length ? Math.max(...longTaskDurations) : 0,
            totalBlockingTimeMs: totalBlockingTime,
            longTaskSupported: this.supported && longTaskDurations.length >= 0,
            timerLag: summarize(this.lags),
        };
    }
}

/* ------------------------------------------------------------------ *
 * Worker-count override
 * ------------------------------------------------------------------ */

/**
 * Overrides navigator.hardwareConcurrency so worker count can be swept.
 *
 * src/index.js reads this property directly at search time, so redefining it
 * on the navigator object is sufficient and requires no library changes.
 * Returns a restore function. Throws if the override does not take effect,
 * because silently benchmarking the wrong worker count would invalidate the
 * entire sweep.
 */
export function overrideHardwareConcurrency(count) {
    const original = navigator.hardwareConcurrency;
    Object.defineProperty(navigator, "hardwareConcurrency", {
        value: count,
        configurable: true,
        writable: false,
    });
    if (navigator.hardwareConcurrency !== count) {
        throw new Error(
            `hardwareConcurrency override failed: wanted ${count}, got ${navigator.hardwareConcurrency}`
        );
    }
    return () => {
        Object.defineProperty(navigator, "hardwareConcurrency", {
            value: original,
            configurable: true,
            writable: false,
        });
    };
}

/* ------------------------------------------------------------------ *
 * Timing helpers
 * ------------------------------------------------------------------ */

function withTimeout(promise, ms, onTimeout) {
    let timer;
    const guard = new Promise((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), ms);
    });
    return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

/** Search dispatched but never produced a result within SEARCH_TIMEOUT_MS. */
const TIMED_OUT = Symbol("timed-out");

/* ------------------------------------------------------------------ *
 * Single-shot scenario
 * ------------------------------------------------------------------ */

/**
 * Runs one candidate against one query, sequentially: each search fully
 * completes before the next begins. This yields clean latency numbers with
 * no dropped queries, and is the basis for the size/worker-count sweep.
 */
async function runQueryScenario({ candidate, dataset, keys, scenario, warmup, iterations }) {
    const handle = await candidate.setup(dataset, keys);
    const samples = [];
    let resultCount = null;
    let dropped = 0;
    let failed = 0;

    try {
        for (let i = 0; i < warmup + iterations; i++) {
            const t0 = performance.now();
            const res = await withTimeout(
                candidate.search(handle, scenario.query),
                SEARCH_TIMEOUT_MS,
                () => TIMED_OUT
            );
            const dt = performance.now() - t0;

            if (res === DROPPED_SYNC) {
                // Should not happen in a sequential run; recorded rather than
                // ignored so an unexpected occurrence is visible.
                dropped++;
                continue;
            }
            if (res === TIMED_OUT) {
                failed++;
                // A broken candidate would otherwise burn the timeout on every
                // iteration; one demonstration is enough.
                break;
            }
            // Discard warmup iterations: they include JIT compilation, worker
            // script fetch/parse, and first-run allocation.
            if (i >= warmup) {
                samples.push(dt);
                if (resultCount === null) resultCount = Array.isArray(res) ? res.length : 0;
            }

            // Yield a MACROTASK before the next iteration. A synchronous
            // candidate resolves its promise immediately, so `await` above
            // yields only a microtask - the event loop never runs, the lag
            // timer never ticks, and the long task never ends to be observed.
            // Without this, every main-thread candidate reports zero blocking,
            // which inverts the headline result. Placed after dt is taken so
            // it cannot inflate the latency sample.
            await new Promise((r) => setTimeout(r, 0));
        }

        // Let the final task close out and the observer flush before stop().
        await new Promise((r) => setTimeout(r, 20));
    } finally {
        candidate.teardown(handle);
    }

    return { samples, resultCount, dropped, failed };
}

/* ------------------------------------------------------------------ *
 * Typing scenario
 * ------------------------------------------------------------------ */

/**
 * Simulates search-as-you-type WITHOUT awaiting each search.
 *
 * Keystrokes are dispatched on a fixed interval regardless of whether the
 * previous search finished. This reproduces real input behavior and exposes
 * FlashFind's concurrent-search guard, which returns early and never invokes
 * the callback for the dropped query.
 *
 * Metrics captured:
 * - delivered / dropped counts
 * - staleness: when results finally arrive, how many keystrokes behind the
 *   current input value were they? This is what a user sees as "the list is
 *   showing results for what I typed three letters ago".
 */
async function runTypingScenario({ candidate, dataset, keys, scenario }) {
    const handle = await candidate.setup(dataset, keys);
    const keys_ = keystrokesFor(scenario.target);

    let currentIndex = -1;
    let delivered = 0;
    let dropped = 0;
    let failed = 0;
    const latencies = [];
    const staleness = [];
    const inFlight = [];

    try {
        for (let i = 0; i < keys_.length; i++) {
            const query = keys_[i];
            currentIndex = i;
            const issuedAtIndex = i;
            const t0 = performance.now();

            // Fire without awaiting - this is the entire point of the scenario.
            const p = withTimeout(
                candidate.search(handle, query),
                SEARCH_TIMEOUT_MS,
                () => TIMED_OUT
            ).then((res) => {
                if (res === DROPPED_SYNC) {
                    // The library refused this keystroke outright. The user
                    // typed a character and no search ever ran for it.
                    dropped++;
                    return;
                }
                if (res === TIMED_OUT) {
                    failed++;
                    return;
                }
                delivered++;
                latencies.push(performance.now() - t0);
                // How far behind the live input was this result when it landed?
                staleness.push(Math.max(0, currentIndex - issuedAtIndex));
            });
            inFlight.push(p);

            await new Promise((r) => setTimeout(r, scenario.intervalMs));
        }

        await Promise.all(inFlight);
    } finally {
        candidate.teardown(handle);
    }

    // The keystroke the user last typed is the one whose results they expect
    // to see. If it was dropped, the UI is showing results for an earlier
    // prefix and will never catch up on its own.
    const finalKeystrokeDelivered = staleness.length > 0 && delivered > 0;

    return {
        keystrokes: keys_.length,
        delivered,
        dropped,
        failed,
        dropRate: keys_.length ? dropped / keys_.length : 0,
        finalKeystrokeDelivered,
        latency: summarize(latencies),
        staleness: summarize(staleness),
    };
}

/* ------------------------------------------------------------------ *
 * Orchestration
 * ------------------------------------------------------------------ */

/**
 * Executes a full benchmark matrix inside the page.
 *
 * @param {Object} cfg
 * @param {number[]} cfg.sizes
 * @param {string[]} cfg.shapes
 * @param {number[]} cfg.workerCounts - only applied to FlashFind
 * @param {string[]} cfg.candidateIds
 * @param {number} cfg.warmup
 * @param {number} cfg.iterations
 * @param {boolean} cfg.includeTyping
 * @param {function} [onProgress]
 */
export async function runMatrix(cfg, onProgress = () => {}) {
    const results = [];
    const {
        sizes,
        shapes,
        workerCounts,
        candidateIds,
        warmup,
        iterations,
        includeTyping,
    } = cfg;

    for (const shape of shapes) {
        const keys = keysForShape(shape);

        for (const size of sizes) {
            const dataset = generateDataset(size, shape);

            for (const candidateId of candidateIds) {
                const candidate = candidateById(candidateId);

                // Only worker-based candidates are affected by worker count;
                // running the single-threaded baselines once per worker count
                // would waste time and imply a dependency that does not exist.
                const counts = WORKER_BASED_CANDIDATE_IDS.has(candidateId)
                    ? workerCounts
                    : [null];

                for (const workerCount of counts) {
                    const restore = workerCount === null ? null : overrideHardwareConcurrency(workerCount);

                    try {
                        for (const scenario of QUERY_SCENARIOS) {
                            onProgress({ shape, size, candidateId, workerCount, scenario: scenario.id });

                            const monitor = new MainThreadMonitor();
                            monitor.start();
                            const { samples, resultCount, dropped, failed } = await runQueryScenario({
                                candidate, dataset, keys, scenario, warmup, iterations,
                            });
                            const blocking = monitor.stop();

                            results.push({
                                kind: "query",
                                shape, size, candidateId, workerCount,
                                scenarioId: scenario.id,
                                query: scenario.query,
                                resultCount,
                                dropped,
                                failed,
                                latency: summarize(samples),
                                blocking,
                            });
                        }

                        if (includeTyping) {
                            for (const scenario of TYPING_SCENARIOS) {
                                onProgress({ shape, size, candidateId, workerCount, scenario: scenario.id });

                                const monitor = new MainThreadMonitor();
                                monitor.start();
                                const typing = await runTypingScenario({
                                    candidate, dataset, keys, scenario,
                                });
                                const blocking = monitor.stop();

                                results.push({
                                    kind: "typing",
                                    shape, size, candidateId, workerCount,
                                    scenarioId: scenario.id,
                                    intervalMs: scenario.intervalMs,
                                    ...typing,
                                    blocking,
                                });
                            }
                        }
                    } finally {
                        if (restore) restore();
                    }
                }
            }
        }
    }

    return results;
}
