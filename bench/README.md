# FlashFind Benchmark Suite

A reusable, reproducible benchmark for FlashFind. Runs in a real headless
Chromium (the library is browser-only: it needs `Worker`, `Blob`,
`URL.createObjectURL`, and `navigator.hardwareConcurrency`), sweeps dataset
size / query character / worker count, and reports latency percentiles
alongside main-thread blocking.

## Quick start

```bash
npm run bench:quick     # small matrix, ~seconds, for smoke-testing changes
npm run bench           # full matrix
npm run bench:report    # render the latest run as markdown
```

Compare two runs to catch regressions:

```bash
node bench/report.js bench/results/latest.json --baseline bench/results/known-good.json
```

## Layout

| File | Role |
|---|---|
| `datasets.js` | Seeded deterministic data generation. Same seed ⇒ byte-identical dataset, so run-to-run deltas are code, not data. |
| `scenarios.js` | The query grid + typing simulation definitions. |
| `candidates.js` | FlashFind and the baselines behind one `setup/search/teardown` interface. |
| `harness.js` | In-page measurement core: percentiles, main-thread monitoring, worker-count override, matrix orchestration. |
| `runner.html` | The page. Also usable manually in a normal browser. |
| `run.js` | Playwright driver: static server, CDN interception, JSON artifact. |
| `report.js` | JSON → markdown, with optional baseline diff. |
| `vendor/` | Fuse 6.4.6, byte-identical to what the worker pulls from jsdelivr. |
| `results/` | Run artifacts. `latest.json` always points at the most recent. |

## What gets measured

**Latency** — p50/p95/p99, not means. Tail latency is what users feel; a mean
hides the GC pause and the cold-start outlier. Warmup iterations are discarded
so JIT compilation and first-run allocation don't pollute the sample.

**Main-thread blocking** — the library's actual selling point. Two independent
signals, because they have different blind spots:
- *Long Tasks* via `PerformanceObserver` — authoritative, but only sees tasks
  above 50ms. Total Blocking Time is derived from these.
- *Timer lag* — a repeating timer measuring scheduled-vs-actual delay. Catches
  many small stalls that never individually cross the long-task threshold.

A candidate can be **slower in wall-clock** yet **dramatically better on
blocking**, and that is still a win for a UI. Reporting only latency would
miss the entire point.

**Dropped queries** — see below.

## Axes

- **Size**: 1k / 10k / 50k / 100k records (configurable)
- **Shape**: `narrow` (3 short fields), `typical` (6 fields), `wide` (long
  descriptions). Field count and text volume drive Fuse indexing cost.
- **Worker count**: swept via `navigator.hardwareConcurrency` override, since
  `src/index.js` reads it directly at search time. **The override is verified
  to change the real number of `Worker` constructions** — it is not assumed.
- **Query character**: exact / prefix / fuzzy-typo / single-char / rare /
  zero-hit / long-phrase. A query matching nothing and one matching 40% of the
  corpus exercise completely different paths, and result-serialization cost
  over `postMessage` scales with match count.

## Candidates

| id | What it is |
|---|---|
| `flashfind` | FlashFind from **ES source**. Real algorithm, no build defect. See below. |
| `flashfind-bundle` | The **shipped `dist/bundle.js`**. Currently broken; kept so the defect shows up in results. |
| `fuse-sync-rebuild` | Main-thread Fuse, index rebuilt per query. The apples-to-apples control, since FlashFind also rebuilds per query. |
| `fuse-sync-prebuilt` | Main-thread Fuse, index built once. Shows the price of per-query indexing. |
| `naive-filter` | `Array.filter` substring. Not fuzzy — the performance floor. |

## Known defect in the shipped bundle

`dist/bundle.js` is broken. Every Fuse-path search throws inside every worker
and **the result callback never fires**.

Mechanism: `WebWorker.js` stringifies the worker function with
`Function.prototype.toString()` and evals it inside a Blob. Babel compiles the
object spread in `public/worker.js`

```js
({ ...res.item, flashScore: res.score })
```

into a call to a **module-scope** helper (`_objectSpread`, minified to `s`).
`toString()` captures only the function body, not the closure it referenced —
so inside the worker `s` is undefined and every search throws
`ReferenceError: s is not defined`.

The `try/catch` in `public/worker.js` guards only `importScripts`, so this
error is neither caught nor does it trigger the substring fallback.

Verified: the same logic written without transpilation returns results
correctly, which localizes the fault to the build, not the source.

Because of this, `bench/flashfind-esm.js` loads the untranspiled source so the
benchmark can measure the library's *design*. The broken bundle remains a
separate candidate so the defect stays visible.

## Fuse version

`package.json` depends on `fuse.js ^7.0.0`, but `public/worker.js` pins
**6.4.6** from jsdelivr. The CDN pin is what actually runs in production, so
the bench vendors 6.4.6 to match. Requests to jsdelivr are intercepted and
served from `vendor/` so you measure the algorithm rather than network
conditions; pass `--cdn` to measure the real network path instead.

## Reproducibility

Benchmark numbers are only comparable **on the same machine, same browser
build, otherwise idle**. Cross-machine absolute numbers are meaningless. Every
artifact records CPU model, core count, platform, and browser UA so a stale
comparison is obvious. Close other applications before a run that matters.

Determinism guarantees:
- Datasets come from a seeded PRNG (`mulberry32`); `Math.random()` is never used.
- Warmup iterations are discarded.
- The rare-token query matches a planted token at a fixed cadence, so low-hit
  scenarios are reproducible rather than PRNG-dependent.

## Adding to the suite

- **New query**: append to `QUERY_SCENARIOS` in `scenarios.js`.
- **New candidate**: implement `setup/search/teardown` in `candidates.js`, add
  it to `CANDIDATES`. Add its id to `WORKER_BASED_CANDIDATE_IDS` if worker
  count affects it.
- **New dataset shape**: add to `SHAPES` in `datasets.js` and teach
  `keysForShape` which fields it exposes.

No changes to the runner or reporter are needed for any of these.
