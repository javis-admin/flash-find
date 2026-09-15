#!/usr/bin/env node
/**
 * Playwright driver for the FlashFind benchmark.
 *
 * Serves the repo over a local static server, launches Chromium, runs the
 * matrix in-page, and writes a JSON artifact to bench/results/.
 *
 * Usage:
 *   node bench/run.js                          # default matrix
 *   node bench/run.js --quick                  # small matrix, fast feedback
 *   node bench/run.js --sizes 1000,50000
 *   node bench/run.js --workers 2,4,8,16
 *   node bench/run.js --cdn                    # measure the real CDN fetch
 *   node bench/run.js --out my-run.json
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/* ------------------------------------------------------------------ *
 * Arg parsing
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
    const args = { cdn: false, quick: false, headed: false, out: null };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === "--cdn") args.cdn = true;
        else if (a === "--quick") args.quick = true;
        else if (a === "--headed") args.headed = true;
        else if (a === "--out") args.out = next();
        else if (a === "--sizes") args.sizes = next().split(",").map(Number);
        else if (a === "--workers") args.workers = next().split(",").map(Number);
        else if (a === "--shapes") args.shapes = next().split(",");
        else if (a === "--candidates") args.candidates = next().split(",");
        else if (a === "--iterations") args.iterations = Number(next());
        else if (a === "--warmup") args.warmup = Number(next());
        else if (a === "--no-typing") args.noTyping = true;
        else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
        else { console.error(`Unknown flag: ${a}`); printHelp(); process.exit(1); }
    }
    return args;
}

function printHelp() {
    console.log(`
FlashFind benchmark driver

  --quick              Small fast matrix (smoke test)
  --sizes a,b,c        Dataset sizes         (default 1000,10000,50000,100000)
  --workers a,b,c      Worker counts to sweep (default 2,4,8,10,16)
  --shapes a,b         Dataset shapes: narrow,typical,wide (default typical)
  --candidates a,b     Candidate ids (default all)
  --iterations N       Measured iterations per cell (default 10)
  --warmup N           Discarded warmup iterations (default 3)
  --no-typing          Skip the typing simulation
  --cdn                Let the worker fetch Fuse from jsdelivr (default: local)
  --headed             Show the browser
  --out FILE           Output filename inside bench/results/
`);
}

/* ------------------------------------------------------------------ *
 * Static server
 * ------------------------------------------------------------------ */

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
};

function startServer(rootDir) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url.split("?")[0]);
            const rel = urlPath === "/" ? "/bench/runner.html" : urlPath;
            let filePath = path.join(rootDir, rel);

            // Prevent path traversal outside the served root.
            if (!filePath.startsWith(rootDir)) {
                res.writeHead(403).end("Forbidden");
                return;
            }

            // src/index.js imports "./WebWorker" and "../public/worker" with no
            // file extension. Bundlers resolve that; native ES modules do not.
            // Resolving it here keeps the library source untouched.
            if (!path.extname(filePath) && fs.existsSync(filePath + ".js")) {
                filePath += ".js";
            }

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404).end("Not found: " + rel);
                    return;
                }
                res.writeHead(200, {
                    "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
                    // Workers are created from blob: URLs; no special CORS needed
                    // for same-origin blobs, but this keeps importScripts happy.
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-store",
                });
                res.end(data);
            });
        });
        server.listen(0, "127.0.0.1", () => resolve(server));
    });
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function main() {
    const args = parseArgs(process.argv);

    const cfg = args.quick
        ? {
              sizes: args.sizes ?? [1000, 10000],
              shapes: args.shapes ?? ["typical"],
              workerCounts: args.workers ?? [4, 8],
              candidateIds: args.candidates ?? ["flashfind", "fuse-sync-prebuilt"],
              warmup: args.warmup ?? 2,
              iterations: args.iterations ?? 5,
              includeTyping: !args.noTyping,
          }
        : {
              sizes: args.sizes ?? [1000, 10000, 50000, 100000],
              shapes: args.shapes ?? ["typical"],
              workerCounts: args.workers ?? [2, 4, 8, 10, 16],
              candidateIds:
                  args.candidates ?? [
                      "flashfind",
                      "fuse-sync-rebuild",
                      "fuse-sync-prebuilt",
                      "naive-filter",
                  ],
              warmup: args.warmup ?? 3,
              iterations: args.iterations ?? 10,
              includeTyping: !args.noTyping,
          };

    const server = await startServer(ROOT);
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const browser = await chromium.launch({ headless: !args.headed });
    const context = await browser.newContext();

    // Route the worker's CDN import to the vendored copy unless --cdn.
    // This measures the search algorithm rather than network weather, while
    // serving byte-identical Fuse 6.4.6.
    let cdnIntercepts = 0;
    if (!args.cdn) {
        const vendored = fs.readFileSync(
            path.join(ROOT, "bench/vendor/fuse-6.4.6.min.js")
        );
        await context.route("https://cdn.jsdelivr.net/**", async (route) => {
            cdnIntercepts++;
            await route.fulfill({
                status: 200,
                contentType: "text/javascript; charset=utf-8",
                body: vendored,
            });
        });
    }

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    page.on("console", (m) => {
        if (m.type() === "error") pageErrors.push(m.text());
    });

    await page.goto(`${base}/bench/runner.html`, { waitUntil: "load" });

    // Module scripts evaluate after 'load' fires, so wait for the explicit
    // ready flag rather than racing module evaluation.
    await page.waitForFunction(() => window.__benchReady === true, { timeout: 15000 });

    // Verify environment assumptions before spending time on a full run.
    const probe = await page.evaluate(() => window.__probe());
    if (!probe.fuseLoaded) throw new Error("Fuse failed to load for baselines");
    if (cfg.candidateIds.includes("flashfind") && !probe.flashFindEsmLoaded) {
        throw new Error("FlashFind ES source failed to load");
    }
    if (cfg.candidateIds.includes("flashfind-bundle") && !probe.flashFindBundleLoaded) {
        throw new Error("FlashFind bundle failed to load");
    }

    console.log("Environment:");
    console.log(`  cores (os)          : ${os.cpus().length}`);
    console.log(`  hardwareConcurrency : ${probe.hardwareConcurrency}`);
    console.log(`  longtask support    : ${probe.longTaskSupported}`);
    console.log(`  fuse source         : ${args.cdn ? "CDN (live network)" : "vendored 6.4.6"}`);
    console.log("");
    console.log("Matrix:");
    console.log(`  sizes      : ${cfg.sizes.join(", ")}`);
    console.log(`  shapes     : ${cfg.shapes.join(", ")}`);
    console.log(`  workers    : ${cfg.workerCounts.join(", ")}`);
    console.log(`  candidates : ${cfg.candidateIds.join(", ")}`);
    console.log(`  iterations : ${cfg.iterations} (+${cfg.warmup} warmup)`);
    console.log("");

    page.on("console", (m) => {
        if (m.type() === "log" && process.env.BENCH_VERBOSE) console.log("  " + m.text());
    });

    const started = Date.now();
    let results;
    try {
        results = await page.evaluate(
            (c) => window.__runBenchmark(c),
            cfg
        );
    } catch (err) {
        console.error("Benchmark failed:", err.message);
        if (pageErrors.length) {
            console.error("Page errors:");
            for (const e of pageErrors.slice(0, 10)) console.error("  " + e);
        }
        await browser.close();
        server.close();
        process.exit(1);
    }

    const elapsed = Date.now() - started;

    const artifact = {
        meta: {
            // Timestamp is stamped here rather than in-page so the harness
            // stays deterministic and reusable.
            timestamp: new Date().toISOString(),
            durationMs: elapsed,
            fuseSource: args.cdn ? "cdn" : "vendored-6.4.6",
            cdnIntercepts,
            config: cfg,
            environment: {
                osCores: os.cpus().length,
                cpuModel: os.cpus()[0]?.model ?? "unknown",
                platform: `${os.platform()} ${os.release()}`,
                totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
                nodeVersion: process.version,
                userAgent: probe.userAgent,
                longTaskSupported: probe.longTaskSupported,
            },
            pageErrors,
        },
        results,
    };

    const outDir = path.join(ROOT, "bench/results");
    fs.mkdirSync(outDir, { recursive: true });
    const outName = args.out ?? `run-${artifact.meta.timestamp.replace(/[:.]/g, "-")}.json`;
    const outPath = path.join(outDir, outName);
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));

    // A stable pointer to the most recent run, for the reporter's convenience.
    fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(artifact, null, 2));

    console.log(`\nWrote ${results.length} rows in ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`  ${path.relative(ROOT, outPath)}`);
    if (pageErrors.length) {
        console.log(`\n  ${pageErrors.length} page error(s) captured; see meta.pageErrors`);
    }

    await browser.close();
    server.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
