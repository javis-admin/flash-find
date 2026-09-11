/**
 * Loads FlashFind from ES source, bypassing the webpack/Babel build.
 *
 * WHY THIS EXISTS
 * ---------------
 * The shipped dist/bundle.js is broken: Babel compiles the object spread in
 * public/worker.js (`{...res.item, flashScore: res.score}`) into a call to a
 * module-scope helper, minified to `s`. WebWorker.js stringifies the worker
 * function with Function.prototype.toString(), which captures only the
 * function body - not the closure it referenced. Inside the worker, `s` is
 * undefined, so every Fuse-path search throws `ReferenceError: s is not
 * defined` and the callback never fires.
 *
 * The try/catch in public/worker.js guards only importScripts, so the error
 * is not caught and no fallback runs.
 *
 * Modern browsers support class private fields and object spread natively, so
 * loading the untranspiled source runs the SAME algorithm without the
 * transpilation defect. This lets the benchmark measure the library's design
 * (worker fan-out, per-query indexing, chunking) rather than the build bug.
 *
 * The broken bundle is benchmarked separately as its own candidate so the
 * defect is visible in the results rather than hidden by this workaround.
 */

import FlashFindSource from "/src/index.js";

export default FlashFindSource;
