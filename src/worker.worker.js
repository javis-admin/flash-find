/*eslint-disable*/
import Fuse from "fuse.js";

// export default () => {
self.addEventListener("message", (e) => {
  if (!e) return;

  const { record, searchText } = e.data || {};
  const filteredData = performSearch(record, searchText);

  postMessage(filteredData);
});

// const performSearch = (data, value) => {
//   value = value.trim();
//   if (value == "") return data;

//   const filteredData = data.filter((record) => {
//     return Object.keys(record).some((key) => {
//       if (Array.isArray(record[key])) {
//         record[key] = performSearch(record[key], value);
//         return record[key].length;
//       }

//       return String(record[key]).toLowerCase().includes(value.toLowerCase());
//     });
//   });

//   return filteredData;
// };

const performSearch = (data, value) => {
  value = value?.trim();
  if (!data) return;
  const fuse = new Fuse(data, {
    threshold: 0,
    keys: Object.keys(data[0]),
    // includeMatches: true,
    // ignoreLocation: true,
  });
  console.log("fuse", fuse);
  if (value == "") {
    return data;
  }
  const filteredData = fuse.search(value);

  console.log("filteredWorker: ", filteredData, data, value);
  return filteredData.map((res) => res.item);
};
// }
