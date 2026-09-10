#!/usr/bin/env node
/**
 * Turns a benchmark JSON artifact into a readable markdown report.
 *
 * Usage:
 *   node bench/report.js                          # reports bench/results/latest.json
 *   node bench/report.js path/to/run.json
 *   node bench/report.js run.json --baseline old.json
 *   node bench/report.js --out REPORT.md
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** Regression threshold: p50 deltas beyond this are flagged in the diff. */
const REGRESSION_PCT = 10;

function fmt(n, digits = 2) {
    if (n === null || n === undefined || Number.isNaN(n)) return "-";
    return n.toFixed(digits);
}

function loadArtifact(p) {
    const resolved = path.isAbsolute(p) ? p : path.join(ROOT, p);
    if (!fs.existsSync(resolved)) {
        console.error(`No such file: ${resolved}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

/** Stable identity for a result row, used to align two runs for diffing. */
function rowKey(r) {
    return [r.kind, r.shape, r.size, r.candidateId, r.workerCount ?? "-", r.scenarioId].join("|");
}

function mdTable(headers, rows) {
    if (!rows.length) return "_No data._\n";
    const head = `| ${headers.join(" | ")} |`;
    const sep = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
    return `${head}\n${sep}\n${body}\n`;
}

function uniq(arr) {
    return [...new Set(arr)];
}

function labelFor(candidateId) {
    const labels = {
        "flashfind": "FlashFind (ES source)",
        "flashfind-bundle": "FlashFind (shipped bundle)",
        "fuse-sync-rebuild": "Fuse sync, rebuilt",
        "fuse-sync-prebuilt": "Fuse sync, prebuilt",
        "naive-filter": "Naive filter",
    };
    return labels[candidateId] ?? candidateId;
}

function buildReport(artifact, baseline) {
    const { meta, results } = artifact;
    const out = [];
    const queryRows = results.filter((r) => r.kind === "query");
    const typingRows = results.filter((r) => r.kind === "typing");

    out.push("# FlashFind Benchmark Report\n");
    out.push(`**Run:** ${meta.timestamp}  `);
    out.push(`**Duration:** ${(meta.durationMs / 1000).toFixed(1)}s  `);
    out.push(`**Fuse source:** ${meta.fuseSource}\n`);

    out.push("## Environment\n");
    out.push(
        mdTable(
            ["Property", "Value"],
            [
                ["CPU", meta.environment.cpuModel],
                ["Cores", String(meta.environment.osCores)],
                ["Platform", meta.environment.platform],
                ["Memory (MB)", String(meta.environment.totalMemMB)],
                ["Node", meta.environment.nodeVersion],
                ["Browser", meta.environment.userAgent.replace(/^Mozilla\/5\.0 /, "")],
                ["Long Task API", String(meta.environment.longTaskSupported)],
            ]
        )
    );
    out.push(
        "> Absolute numbers are only meaningful on this machine. Compare runs on identical hardware.\n"
    );

    if (meta.pageErrors?.length) {
        out.push("## Page errors\n");
        const counts = new Map();
        for (const e of meta.pageErrors) counts.set(e, (counts.get(e) ?? 0) + 1);
        out.push(
            mdTable(
                ["Count", "Error"],
                [...counts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([e, c]) => [String(c), "`" + e.replace(/\|/g, "\\|").slice(0, 160) + "`"])
            )
        );
    }

    /* -------------------------------------------------------------- *
     * Latency by dataset size and worker count
     * -------------------------------------------------------------- */
    out.push("## Search latency (ms)\n");
    out.push("Sequential searches; each completes before the next begins.\n");

    for (const shape of uniq(queryRows.map((r) => r.shape))) {
        for (const size of uniq(queryRows.filter((r) => r.shape === shape).map((r) => r.size)).sort((a, b) => a - b)) {
            out.push(`### ${shape} shape, ${size.toLocaleString()} records\n`);
            const subset = queryRows.filter((r) => r.shape === shape && r.size === size);
            const scenarios = uniq(subset.map((r) => r.scenarioId));

            const variants = uniq(
                subset.map((r) => JSON.stringify([r.candidateId, r.workerCount]))
            ).map((s) => JSON.parse(s));

            const rows = variants.map(([cid, wc]) => {
                const label = wc === null ? labelFor(cid) : `${labelFor(cid)} · ${wc}w`;
                const cells = scenarios.map((sid) => {
                    const r = subset.find(
                        (x) => x.candidateId === cid && x.workerCount === wc && x.scenarioId === sid
                    );
                    if (!r) return "-";
                    if (r.latency.n === 0) return `**fail**`;
                    return `${fmt(r.latency.p50, 1)} / ${fmt(r.latency.p95, 1)}`;
                });
                return [label, ...cells];
            });

            out.push(mdTable(["Candidate (p50 / p95)", ...scenarios], rows));
        }
    }

    /* -------------------------------------------------------------- *
     * Worker-count scaling
     * -------------------------------------------------------------- */
    const workerRows = queryRows.filter((r) => r.workerCount !== null && r.latency.n > 0);
    if (workerRows.length) {
        out.push("## Worker-count scaling\n");
        out.push("Median p50 across all query scenarios, by worker count.\n");

        for (const cid of uniq(workerRows.map((r) => r.candidateId))) {
            const cidRows = workerRows.filter((r) => r.candidateId === cid);
            const sizes = uniq(cidRows.map((r) => r.size)).sort((a, b) => a - b);
            const counts = uniq(cidRows.map((r) => r.workerCount)).sort((a, b) => a - b);
            if (counts.length < 2) continue;

            out.push(`### ${labelFor(cid)}\n`);
            const rows = sizes.map((size) => {
                const cells = counts.map((wc) => {
                    const rs = cidRows.filter((r) => r.size === size && r.workerCount === wc);
                    if (!rs.length) return "-";
                    const meds = rs.map((r) => r.latency.p50).sort((a, b) => a - b);
                    return fmt(meds[Math.floor(meds.length / 2)], 1);
                });
                return [size.toLocaleString(), ...cells];
            });
            out.push(mdTable(["Records", ...counts.map((c) => `${c} workers`)], rows));
        }
    }

    /* -------------------------------------------------------------- *
     * Main-thread blocking
     * -------------------------------------------------------------- */
    out.push("## Main-thread blocking\n");
    out.push(
        "The library's core claim. TBT is total blocking time (sum of long-task time over 50ms). " +
            "Timer lag p95 catches smaller stalls the long-task API misses.\n"
    );

    for (const size of uniq(queryRows.map((r) => r.size)).sort((a, b) => a - b)) {
        const subset = queryRows.filter((r) => r.size === size && r.latency.n > 0);
        if (!subset.length) continue;
        out.push(`### ${size.toLocaleString()} records\n`);

        const variants = uniq(subset.map((r) => JSON.stringify([r.candidateId, r.workerCount]))).map(
            (s) => JSON.parse(s)
        );

        const rows = variants.map(([cid, wc]) => {
            const rs = subset.filter((r) => r.candidateId === cid && r.workerCount === wc);
            const tbt = rs.reduce((a, r) => a + r.blocking.totalBlockingTimeMs, 0);
            const longest = Math.max(...rs.map((r) => r.blocking.longestTaskMs), 0);
            const tasks = rs.reduce((a, r) => a + r.blocking.longTaskCount, 0);
            const lagP95 = rs
                .map((r) => r.blocking.timerLag.p95)
                .filter((x) => x !== null)
                .sort((a, b) => a - b);
            return [
                wc === null ? labelFor(cid) : `${labelFor(cid)} · ${wc}w`,
                String(tasks),
                fmt(tbt, 1),
                fmt(longest, 1),
                lagP95.length ? fmt(lagP95[Math.floor(lagP95.length / 2)], 1) : "-",
            ];
        });

        out.push(
            mdTable(
                ["Candidate", "Long tasks", "TBT (ms)", "Longest task (ms)", "Timer lag p95 (ms)"],
                rows
            )
        );
    }

    /* -------------------------------------------------------------- *
     * Typing simulation
     * -------------------------------------------------------------- */
    if (typingRows.length) {
        out.push("## Typing simulation (dropped queries)\n");
        out.push(
            "Keystrokes fire on a fixed interval without waiting for the previous search. " +
                "`Dropped` counts searches that never produced a callback. " +
                "`Staleness` is how many keystrokes behind the live input the results were when they landed.\n"
        );

        const rows = typingRows.map((r) => [
            `${r.size.toLocaleString()}`,
            r.workerCount === null ? labelFor(r.candidateId) : `${labelFor(r.candidateId)} · ${r.workerCount}w`,
            r.scenarioId,
            `${r.intervalMs}ms`,
            String(r.keystrokes),
            String(r.delivered),
            String(r.dropped),
            `${(r.dropRate * 100).toFixed(0)}%`,
            fmt(r.latency.p50, 1),
            fmt(r.staleness.max, 0),
        ]);

        out.push(
            mdTable(
                ["Records", "Candidate", "Scenario", "Interval", "Keys", "Delivered", "Dropped", "Drop rate", "Latency p50", "Max staleness"],
                rows
            )
        );
    }

    /* -------------------------------------------------------------- *
     * Baseline diff
     * -------------------------------------------------------------- */
    if (baseline) {
        out.push("## Regression vs. baseline\n");
        out.push(`Baseline: ${baseline.meta.timestamp}. Flagged when |Δp50| > ${REGRESSION_PCT}%.\n`);

        const baseMap = new Map(baseline.results.map((r) => [rowKey(r), r]));
        const diffs = [];

        for (const r of results) {
            if (r.kind !== "query" || !r.latency?.n) continue;
            const b = baseMap.get(rowKey(r));
            if (!b || !b.latency?.n) continue;
            const delta = ((r.latency.p50 - b.latency.p50) / b.latency.p50) * 100;
            if (Math.abs(delta) > REGRESSION_PCT) {
                diffs.push([
                    `${r.size.toLocaleString()} ${r.shape}`,
                    r.workerCount === null ? labelFor(r.candidateId) : `${labelFor(r.candidateId)} · ${r.workerCount}w`,
                    r.scenarioId,
                    fmt(b.latency.p50, 1),
                    fmt(r.latency.p50, 1),
                    `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`,
                    delta > 0 ? "slower" : "faster",
                ]);
            }
        }

        diffs.sort((a, b) => parseFloat(b[5]) - parseFloat(a[5]));
        out.push(
            diffs.length
                ? mdTable(["Dataset", "Candidate", "Scenario", "Base p50", "New p50", "Δ", ""], diffs)
                : `_No changes beyond ±${REGRESSION_PCT}%._\n`
        );
    }

    return out.join("\n");
}

function main() {
    const argv = process.argv.slice(2);
    let input = null;
    let baselinePath = null;
    let outPath = null;

    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--baseline") baselinePath = argv[++i];
        else if (argv[i] === "--out") outPath = argv[++i];
        else if (!input) input = argv[i];
    }

    const artifact = loadArtifact(input ?? "bench/results/latest.json");
    const baseline = baselinePath ? loadArtifact(baselinePath) : null;
    const md = buildReport(artifact, baseline);

    if (outPath) {
        const resolved = path.isAbsolute(outPath) ? outPath : path.join(ROOT, outPath);
        fs.writeFileSync(resolved, md);
        console.log(`Wrote ${path.relative(ROOT, resolved)}`);
    } else {
        console.log(md);
    }
}

main();
