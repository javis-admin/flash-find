# FlashFind ⚡: Parallel Search Optimization with Web Workers

FlashFind is a high-performance library that uses web workers to efficiently perform parallel searches on large datasets. It leverages Fuse.js for powerful fuzzy search capabilities, allowing for customizable search behavior tailored to your specific needs.

## Problem Statement

When handling large datasets, client-side searches can suffer from performance issues, leading to slow responses or application freezes. Common optimizations such as debouncing and simpler search algorithms can only go so far before the main thread becomes overloaded. FlashFind tackles this problem by distributing search tasks across multiple web workers, leveraging the full power of the user's CPU cores for parallel processing.

## Solution

FlashFind splits your dataset into chunks, each processed by a separate web worker. It integrates Fuse.js to enable advanced fuzzy searching, and lets you customize the search logic through Fuse.js configuration options. This parallelized approach enables faster search performance and ensures that the main thread remains responsive, even during complex searches.

## Features

- **Parallel Search Processing**: Uses web workers to handle search tasks concurrently.
- **Fuse.js Integration**: Incorporates Fuse.js to provide flexible and powerful fuzzy search options.
- **Dynamic Thread Allocation**: Adapts to the number of CPU cores available, ensuring optimal performance across different devices.
- **Chunk-Based Data Processing**: Divides the dataset into manageable chunks for efficient worker thread processing.
- **Aggregated Results**: Collects and sorts results from all worker threads to ensure a unified and relevant search output.

## Installation

To install FlashFind via npm:

```bash
npm install flash-find
```

## Usage

### Import and Initialize

```javascript
import FlashFind from 'flash-find';

// Define your data source, optional Fuse.js configuration, and a callback function to handle search results
const dataSource = [...]; // Your data source
const fuseConfig = { keys: ["title", "author"], threshold: 0.3 }; // Custom Fuse.js configuration
const callback = (results) => { console.log(results); };

// Initialize FlashFind with your data source and optional Fuse.js configuration
const flashFind = new FlashFind(dataSource, fuseConfig);

// Initialize the worker pool and prepare for search operations
flashFind.init(callback);
```

### Perform a Search

Use the `search` method to perform a search with the desired query:

```javascript
// Perform search with a query
flashFind.search("your search query");
```

### Update Data Source

To update the data source dynamically:

```javascript
// Update the data source
flashFind.updateDataSource(newDataSource);
```

## API Documentation

### `FlashFind(dataSource, fuseConfig)`

Creates a new FlashFind instance.

- **dataSource**: Array of data to be searched.
- **fuseConfig**: (Optional) Configuration object for Fuse.js to customize search behavior. You can adjust settings like threshold, distance, and keys to tailor the fuzzy search logic.

### `.init(callback)`

Initializes the worker pool and prepares the library for searching. Should be called before performing searches.

- **callback**: Function to handle the search results.

### `.search(query)`

Performs a search operation for the specified query.

- **query**: The query string to search for.

### `.updateDataSource(dataSource)`

Updates the data source and re-chunks it for worker processing.

- **dataSource**: The new data to be searched.

## Contributing

We welcome contributions! Please open an issue or submit a pull request on our [GitHub repository](https://github.com/your-repo-link).

## License

This project is licensed under the MIT License. See the LICENSE file for more details.

---

This version highlights the Fuse.js integration, allowing users to easily understand how to configure and leverage fuzzy search within FlashFind.
