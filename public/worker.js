/*eslint-disable*/
export default () => {
    let fuse;
    try {
        importScripts('https://cdn.jsdelivr.net/npm/fuse.js@6.4.6/dist/fuse.min.js');
        fuse = true;
    } catch (error) {
        fuse = false;
    }

    self.addEventListener("message", (e) => {
        if (!e) return;

        const { record, searchText, fuseConfig } = e.data || {};
        const filteredData = fuse ? performSearch(record, searchText, fuseConfig) : performSearchFallback(record, searchText);

        postMessage(filteredData);
    });

    const performSearch = (data, value, fuseConfig) => {
        console.log('vv: ', value)
        value = value?.trim();
        if (!data || data.length == 0) return;

        const config =
          Object.keys(fuseConfig).length > 0
            ? fuseConfig
            : {
                // shouldSort: true,
                threshold: 0.3,
                location: 0,
                distance: 100,
                maxPatternLength: 32,
                // minMatchCharLength: 1,
                keys: Object.keys(data[0]), // Extract key names from data object
              };

        const fuseInstance = new Fuse(data, config);

        if (value == "") {
            return data;
        }
        const filteredData = fuseInstance.search(value);

        return filteredData.map((res) => res.item);
    };

    const performSearchFallback = (data, value) => {
        value = value.trim()
        if (value == '') return data

        const filteredData = data.filter((record) => {
            return Object.keys(record).some((key) => {
                if (Array.isArray(record[key])) {
                    record[key] = performSearchFallback(record[key], value);
                    return record[key].length;
                }

                return String(record[key])
                    .toLowerCase()
                    .includes(value.toLowerCase());
            });
        });

        return filteredData
    }
}
