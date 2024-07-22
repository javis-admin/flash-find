/*eslint-disable*/
export default () => {
    importScripts('https://cdn.jsdelivr.net/npm/fuse.js@6.4.6/dist/fuse.min.js');
    self.addEventListener("message", (e) => {
        if (!e) return;

        const { record, searchText } = e.data || {};
        const filteredData = performSearch(record, searchText);

        postMessage(filteredData);
    });

    const performSearch = (data, value) => {
        value = value?.trim();
        if (!data) return;
        const fuse = new Fuse(data, {
            shouldSort: true,
            threshold: 0.3,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 1,
            keys: Object.keys(data[0]), // Extract key names from data object
        });
        console.log("fuse", fuse,data);
        if (value == "") {
            return data;
        }
        const filteredData = fuse.search(value);

        console.log("filteredWorker: ", filteredData, data, value);
        return filteredData.map((res) => res.item);
    };
}
