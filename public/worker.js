/*eslint-disable*/
/**
 * The search worker, as a SOURCE STRING.
 *
 * WHY A STRING. `WebWorker.js` builds the worker by calling `.toString()` on this module's default
 * export and evaluating the text inside a Blob, so the worker body is a self-contained classic
 * script with NO module graph. A normal `import Fuse from "fuse.js"` inside it would be stringified
 * away and reference an undefined binding at runtime. That is why this file used to open by pulling
 * fuse 6.4.6 off a public CDN with the worker script-import call — third-party JS fetched over the
 * network, with no SRI, at a version no consumer's lockfile controlled.
 *
 * THAT FETCH IS GONE. `__FUSE_SOURCE__` is replaced at BUILD time (webpack DefinePlugin) with the
 * contents of the `fuse.js` this package depends on, rewritten from ESM into a classic script that
 * defines the `Fuse` global the body below calls. Nothing is fetched at runtime and the version is
 * whatever the lockfile pins. See webpack.config.js.
 *
 * A plain function could not carry the library: `.toString()` returns only its own literal source
 * text, so an interpolated value would be lost. Hence the `toString` override at the bottom.
 */
const FUSE_SOURCE = __FUSE_SOURCE__;

const createWorkerBody = () => `() => {
  ${FUSE_SOURCE}

  // Previously set from whether that CDN script-import threw. Fuse is compiled in now, so the
  // ranked path is always available - but the flag, and the fallback it guards, are kept so a
  // failure to evaluate degrades to substring matching rather than throwing inside the worker.
  const fuse = typeof Fuse !== 'undefined';

  self.addEventListener("message", (e) => {
    if (!e) return;

    const { record, searchText, fuseConfig } = e.data || {};
    const filteredData = fuse ? performSearch(record, searchText, fuseConfig) : performSearchFallback(record, searchText);

    postMessage(filteredData);
  });

  const performSearch = (data, value, fuseConfig) => {
    value = value?.trim();
    if (!data || data.length == 0) return;

    const config =
      Object.keys(fuseConfig).length > 0
        ? fuseConfig
        : {
            threshold: 0.3,
            location: 0,
            distance: 100,
            includeScore: true,
            keys: Object.keys(data[0]),
          };

    const fuseInstance = new Fuse(data, config);

    if (value == "") {
      return data;
    }

    return fuseInstance.search(value).map((res) =>
      Object.assign({}, res.item, { flashScore: res.score })
    );
  };

  const performSearchFallback = (data, value) => {
    value = value.trim();
    if (value == '') return data;

    return data.filter((record) => {
      return Object.keys(record).some((key) => {
        if (Array.isArray(record[key])) {
          // Filter into a LOCAL rather than reassigning record[key]: this used to mutate the
          // caller's object, and with it whatever cache the row came from.
          return performSearchFallback(record[key], value).length;
        }

        return String(record[key])
          .toLowerCase()
          .includes(value.toLowerCase());
      });
    });
  };
}`;

const worker = () => {};
worker.toString = createWorkerBody;

export default worker;
