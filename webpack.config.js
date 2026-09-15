import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * fuse.js, inlined into the search worker at BUILD time.
 *
 * The worker is a stringified function evaluated inside a Blob (see src/WebWorker.js), so it has no
 * module graph and cannot `import` anything — which is why this package used to fetch fuse from a
 * public CDN at runtime. Reading the dependency off disk here and substituting it into
 * public/worker.js through DefinePlugin keeps the same bytes under the consumer's lockfile.
 *
 * The dist we need is an ES module (fuse ships no classic/UMD build from 7.1 on), and a Blob worker
 * created without `{ type: "module" }` is a CLASSIC script, where `export {...}` is a syntax error.
 * So the export tail is rewritten into a `var Fuse = ...` binding, which is exactly the global the
 * worker body calls.
 */
const FUSE_DIST = path.join(__dirname, "node_modules", "fuse.js", "dist");
const EXPORT_TAIL = /export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*;?\s*$/;

function readFuseAsClassicScript() {
  const file = path.join(FUSE_DIST, "fuse.min.mjs");
  if (!fs.existsSync(file)) {
    throw new Error(
      `fuse.js inlining failed: ${file} does not exist. Run \`npm install\` first, or update ` +
        `FUSE_DIST in webpack.config.js if the dist layout changed.`
    );
  }
  const esm = fs.readFileSync(file, "utf8");
  const classic = esm.replace(EXPORT_TAIL, (_match, id) => `var Fuse=${id};`);
  // Asserted, never tolerated: a worker that quietly lacks `Fuse` silently falls back to substring
  // matching with no error, which is the exact silent degradation this change removes.
  if (classic === esm) {
    throw new Error(
      "fuse.js inlining failed: could not rewrite the ESM export tail into a `Fuse` global. " +
        "The dist format changed — update EXPORT_TAIL in webpack.config.js."
    );
  }
  return classic;
}

export default {
  entry: "./src/index.js",
  mode: "production",
  // The library is browser-only: it needs Worker, Blob, URL.createObjectURL and
  // navigator.hardwareConcurrency.
  target: "web",
  experiments: {
    // Emit a real ES module so bundlers consume it without CJS/UMD interop guesswork.
    outputModule: true,
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
    module: true,
    library: {
      type: "module",
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            // Targets matter: without them preset-env lowers the class private fields in
            // src/index.js all the way to WeakMaps for no benefit. Every browser that has Worker +
            // Blob also has private fields.
            presets: [["@babel/preset-env", { targets: { esmodules: true } }]],
          },
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      // Inserted as CODE, so the value must itself be a string literal.
      __FUSE_SOURCE__: JSON.stringify(readFuseAsClassicScript()),
    }),
  ],
  resolve: {
    extensions: [".js"],
  },
};
