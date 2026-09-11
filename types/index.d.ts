/**
 * Type definitions for @okjavis/flash-find.
 *
 * Hand-written against src/index.js — keep them in step with it. `search()` returns void: results
 * arrive through the callback registered with `init()`, never as a return value.
 */

/**
 * Fuse.js options, forwarded verbatim into the worker and handed to `new Fuse(data, config)` there.
 *
 * Deliberately a loose record rather than a re-declaration of fuse's own option type: fuse is a
 * BUILD-time input inlined into the worker (see webpack.config.js), not a peer the consumer
 * installs, so pinning this to one fuse major would assert a coupling consumers cannot act on.
 *
 * When empty, the worker falls back to its own defaults: `threshold: 0.3`, `location: 0`,
 * `distance: 100`, `includeScore: true`, and `keys` taken from the first record's own keys.
 */
export type FlashFindFuseConfig = Record<string, unknown>;

/**
 * A result row: the original record plus fuse's relevance score (0..1, LOWER is better).
 *
 * `flashScore` is absent when the ranked path did not run and the worker fell back to substring
 * matching — an absent score across a non-empty result set is the signal that search degraded.
 */
export type FlashFindResult<T> = T & { readonly flashScore?: number };

export default class FlashFind<T = unknown> {
  constructor(dataSource: readonly T[], fuseConfig?: FlashFindFuseConfig);

  /**
   * Registers the results callback. Also terminates any workers left from a previous `init()` and
   * clears any held query.
   */
  init(callback: (results: FlashFindResult<T>[]) => void): void;

  /** Swaps the searched collection, terminating in-flight workers and dropping any held query. */
  updateDataSource(dataSource: readonly T[]): void;

  /**
   * Fires a search. Results arrive via the `init()` callback.
   *
   * An empty/whitespace query short-circuits to the full dataSource without spawning a worker. A
   * query fired while another search is in flight is HELD, not dropped, and runs when that one
   * finishes; only the most recent held query survives.
   */
  search(query: string): void;

  /** Terminates all workers and drops the callback, held query, and data reference. */
  destroy(): void;
}
