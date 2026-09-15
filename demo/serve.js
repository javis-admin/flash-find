#!/usr/bin/env node
/**
 * Tiny zero-dependency static server for the interactive demo.
 *
 * ESM, matching the root package.json's "type": "module".
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 8899;

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
};

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const rel = urlPath === "/" ? "/demo/index.html" : urlPath;
    let filePath = path.join(ROOT, rel);

    // Prevent path traversal outside the served root.
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end("Forbidden");
        return;
    }

    // src/index.js imports "./WebWorker" and "../public/worker" with no file
    // extension. Bundlers resolve that; native ES modules do not.
    if (!path.extname(filePath) && fs.existsSync(filePath + ".js")) filePath += ".js";

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404).end("Not found: " + rel);
            return;
        }
        res.writeHead(200, {
            "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
            "Cache-Control": "no-store",
        });
        res.end(data);
    });
});

function announce(server) {
    const { port } = server.address();
    console.log(`\n  FlashFind demo \u2192 http://127.0.0.1:${port}\n`);
    console.log("  Ctrl+C to stop.\n");
}

// Dev machines commonly already have something on a well-known dev port
// (Vite defaults to 5173, for instance). Fall back to any free port rather
// than dying, so `npm run demo` always works.
server.on("error", (err) => {
    if (err.code !== "EADDRINUSE") throw err;
    console.warn(`  Port ${PORT} is in use; picking a free port instead.`);
    server.listen(0, "127.0.0.1", () => announce(server));
});

server.listen(PORT, "127.0.0.1", () => announce(server));
