# FlashFind Benchmark Report

**Run:** 2026-09-10T04:51:35.290Z  
**Duration:** 730.5s  
**Fuse source:** vendored-6.4.6

## Environment

| Property | Value |
| --- | --- |
| CPU | Apple M4 |
| Cores | 10 |
| Platform | darwin 25.6.0 |
| Memory (MB) | 16384 |
| Node | v25.8.1 |
| Browser | (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36 |
| Long Task API | true |

> Absolute numbers are only meaningful on this machine. Compare runs on identical hardware.

## Search latency (ms)

Sequential searches; each completes before the next begins.

### typical shape, 1,000 records

| Candidate (p50 / p95) | exact-common | exact-name | prefix | fuzzy-typo | single-char | rare-token | zero-hits | long-phrase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FlashFind (ES source) · 2w | 10.2 / 10.5 | 11.8 / 12.2 | 8.6 / 8.8 | 10.4 / 10.7 | 8.3 / 8.6 | 8.1 / 8.2 | 9.9 / 10.1 | 23.5 / 23.8 |
| FlashFind (ES source) · 4w | 11.8 / 12.9 | 12.6 / 13.4 | 10.3 / 10.8 | 11.8 / 13.2 | 9.7 / 10.3 | 9.8 / 10.6 | 11.5 / 12.7 | 19.5 / 20.5 |
| FlashFind (ES source) · 8w | 17.4 / 19.4 | 18.8 / 21.7 | 15.8 / 17.5 | 18.1 / 18.8 | 15.7 / 17.4 | 15.7 / 16.9 | 17.9 / 19.7 | 24.9 / 26.4 |
| FlashFind (ES source) · 10w | 22.0 / 23.5 | 21.9 / 23.2 | 19.9 / 20.9 | 21.5 / 23.3 | 17.9 / 19.0 | 19.4 / 20.8 | 22.2 / 22.7 | 30.1 / 33.6 |
| FlashFind (ES source) · 16w | 30.8 / 31.7 | 32.2 / 36.8 | 27.5 / 28.9 | 30.6 / 32.4 | 27.3 / 32.8 | 39.8 / 48.0 | 35.4 / 43.5 | 41.5 / 44.4 |
| Fuse sync, rebuilt | 6.0 / 7.2 | 6.8 / 6.9 | 3.4 / 42.9 | 6.2 / 6.5 | 2.4 / 2.7 | 3.1 / 3.3 | 6.3 / 6.6 | 25.4 / 25.7 |
| Fuse sync, prebuilt | 6.2 / 7.8 | 6.5 / 6.6 | 2.7 / 2.9 | 5.8 / 5.9 | 1.6 / 1.7 | 2.9 / 3.0 | 6.0 / 6.1 | 24.6 / 25.1 |
| Naive filter | 0.5 / 0.6 | 0.4 / 0.5 | 0.5 / 0.8 | 0.4 / 0.5 | 0.1 / 0.2 | 0.3 / 0.3 | 0.2 / 0.3 | 0.3 / 0.4 |

### typical shape, 10,000 records

| Candidate (p50 / p95) | exact-common | exact-name | prefix | fuzzy-typo | single-char | rare-token | zero-hits | long-phrase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FlashFind (ES source) · 2w | 42.1 / 42.4 | 46.9 / 47.9 | 28.5 / 29.8 | 43.3 / 44.4 | 28.8 / 29.6 | 28.3 / 28.9 | 42.5 / 43.8 | 143.3 / 144.1 |
| FlashFind (ES source) · 4w | 31.5 / 32.5 | 35.0 / 37.4 | 25.1 / 26.1 | 33.3 / 37.8 | 24.6 / 27.1 | 24.4 / 27.5 | 31.4 / 32.6 | 85.0 / 85.9 |
| FlashFind (ES source) · 8w | 39.7 / 44.1 | 41.5 / 47.9 | 32.6 / 37.0 | 38.8 / 54.2 | 30.8 / 40.2 | 32.3 / 34.1 | 40.5 / 43.3 | 82.7 / 85.4 |
| FlashFind (ES source) · 10w | 44.8 / 46.5 | 52.0 / 57.5 | 43.0 / 49.4 | 48.0 / 53.0 | 38.1 / 42.9 | 38.7 / 41.2 | 43.7 / 49.8 | 91.0 / 95.6 |
| FlashFind (ES source) · 16w | 62.8 / 69.5 | 66.4 / 73.8 | 51.8 / 67.6 | 64.8 / 72.7 | 50.3 / 58.3 | 52.8 / 56.1 | 61.7 / 68.2 | 113.1 / 122.3 |
| Fuse sync, rebuilt | 64.5 / 68.8 | 71.1 / 71.6 | 34.2 / 34.4 | 65.1 / 66.7 | 24.3 / 26.6 | 34.8 / 35.0 | 67.0 / 68.4 | 251.6 / 252.6 |
| Fuse sync, prebuilt | 57.8 / 58.3 | 64.1 / 64.6 | 27.6 / 28.6 | 58.3 / 58.9 | 18.3 / 20.1 | 28.0 / 28.3 | 59.7 / 59.9 | 245.3 / 245.9 |
| Naive filter | 3.2 / 4.4 | 1.6 / 1.7 | 2.2 / 2.3 | 2.0 / 2.0 | 0.3 / 0.4 | 1.4 / 1.4 | 1.2 / 1.3 | 1.5 / 1.7 |

### typical shape, 50,000 records

| Candidate (p50 / p95) | exact-common | exact-name | prefix | fuzzy-typo | single-char | rare-token | zero-hits | long-phrase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FlashFind (ES source) · 2w | 178.2 / 179.5 | 194.5 / 196.3 | 107.0 / 109.6 | 179.0 / 181.5 | 108.7 / 112.3 | 107.0 / 113.5 | 176.0 / 176.9 | 678.3 / 681.3 |
| FlashFind (ES source) · 4w | 113.5 / 121.8 | 122.2 / 127.3 | 79.6 / 82.2 | 113.7 / 116.6 | 80.6 / 82.3 | 81.7 / 84.9 | 111.2 / 114.5 | 397.9 / 410.1 |
| FlashFind (ES source) · 8w | 111.1 / 115.8 | 120.4 / 127.6 | 90.1 / 95.1 | 115.8 / 122.3 | 87.6 / 92.9 | 94.3 / 96.7 | 108.0 / 123.8 | 368.2 / 457.8 |
| FlashFind (ES source) · 10w | 132.3 / 136.8 | 137.3 / 149.7 | 93.7 / 103.5 | 133.2 / 144.3 | 106.5 / 113.4 | 95.4 / 111.1 | 122.5 / 130.3 | 324.8 / 331.6 |
| FlashFind (ES source) · 16w | 144.3 / 157.3 | 154.1 / 221.5 | 122.8 / 140.1 | 147.9 / 178.8 | 182.1 / 222.1 | 143.0 / 204.7 | 137.8 / 156.5 | 332.0 / 357.4 |
| Fuse sync, rebuilt | 323.6 / 332.2 | 362.8 / 375.6 | 173.3 / 177.7 | 364.8 / 369.3 | 139.8 / 147.2 | 198.2 / 203.1 | 379.5 / 384.5 | 1477.7 / 1480.3 |
| Fuse sync, prebuilt | 335.6 / 337.7 | 374.4 / 375.8 | 158.0 / 161.8 | 337.7 / 338.9 | 104.1 / 108.7 | 161.9 / 163.1 | 342.6 / 344.3 | 1441.6 / 1445.0 |
| Naive filter | 10.3 / 10.6 | 7.7 / 7.9 | 12.6 / 12.8 | 11.1 / 11.5 | 1.7 / 1.9 | 8.0 / 8.1 | 7.0 / 7.2 | 9.3 / 9.4 |

### typical shape, 100,000 records

| Candidate (p50 / p95) | exact-common | exact-name | prefix | fuzzy-typo | single-char | rare-token | zero-hits | long-phrase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FlashFind (ES source) · 2w | 377.4 / 388.9 | 412.5 / 429.3 | 224.2 / 229.0 | 371.8 / 377.9 | 250.8 / 253.1 | 226.3 / 229.2 | 369.1 / 371.5 | 1446.8 / 1456.5 |
| FlashFind (ES source) · 4w | 280.8 / 302.4 | 312.7 / 315.8 | 177.0 / 183.7 | 283.5 / 295.0 | 189.9 / 193.4 | 179.5 / 184.4 | 275.3 / 277.7 | 1062.4 / 1217.2 |
| FlashFind (ES source) · 8w | 280.0 / 360.9 | 257.4 / 420.8 | 348.5 / 375.4 | 250.9 / 307.6 | 190.6 / 198.2 | 183.5 / 192.2 | 447.0 / 490.1 | 773.0 / 1070.1 |
| FlashFind (ES source) · 10w | 252.2 / 279.6 | 347.0 / 377.2 | 180.9 / 200.5 | 273.7 / 303.2 | 197.1 / 204.5 | 188.1 / 207.1 | 252.4 / 262.0 | 730.8 / 794.3 |
| FlashFind (ES source) · 16w | 286.8 / 312.1 | 303.8 / 334.0 | 228.2 / 247.6 | 292.0 / 304.0 | 235.9 / 288.9 | 241.6 / 277.4 | 282.3 / 388.9 | 840.1 / 920.2 |
| Fuse sync, rebuilt | 732.3 / 744.1 | 815.1 / 833.1 | 391.4 / 401.0 | 752.0 / 759.2 | 281.8 / 303.9 | 397.9 / 412.0 | 759.2 / 772.1 | 2937.8 / 2973.3 |
| Fuse sync, prebuilt | 651.5 / 662.4 | 738.4 / 743.5 | 315.5 / 317.2 | 673.3 / 675.1 | 209.2 / 221.9 | 323.9 / 327.2 | 686.5 / 689.1 | 2871.2 / 2886.0 |
| Naive filter | 20.8 / 21.1 | 15.3 / 15.5 | 25.1 / 25.3 | 22.5 / 22.5 | 3.5 / 3.7 | 15.8 / 15.9 | 14.3 / 14.3 | 18.4 / 18.7 |

## Worker-count scaling

Median p50 across all query scenarios, by worker count.

### FlashFind (ES source)

| Records | 2 workers | 4 workers | 8 workers | 10 workers | 16 workers |
| --- | --- | --- | --- | --- | --- |
| 1,000 | 10.2 | 11.8 | 17.9 | 21.9 | 32.2 |
| 10,000 | 42.5 | 31.5 | 39.7 | 44.8 | 62.8 |
| 50,000 | 178.2 | 113.5 | 111.1 | 132.3 | 147.9 |
| 100,000 | 371.8 | 280.8 | 280.0 | 252.4 | 286.8 |

## Main-thread blocking

The library's core claim. TBT is total blocking time (sum of long-task time over 50ms). Timer lag p95 catches smaller stalls the long-task API misses.

### 1,000 records

| Candidate | Long tasks | TBT (ms) | Longest task (ms) | Timer lag p95 (ms) |
| --- | --- | --- | --- | --- |
| FlashFind (ES source) · 2w | 0 | 0.0 | 0.0 | 1.0 |
| FlashFind (ES source) · 4w | 0 | 0.0 | 0.0 | 1.8 |
| FlashFind (ES source) · 8w | 0 | 0.0 | 0.0 | 3.1 |
| FlashFind (ES source) · 10w | 0 | 0.0 | 0.0 | 5.8 |
| FlashFind (ES source) · 16w | 0 | 0.0 | 0.0 | 11.1 |
| Fuse sync, rebuilt | 0 | 0.0 | 0.0 | - |
| Fuse sync, prebuilt | 0 | 0.0 | 0.0 | - |
| Naive filter | 0 | 0.0 | 0.0 | - |

### 10,000 records

| Candidate | Long tasks | TBT (ms) | Longest task (ms) | Timer lag p95 (ms) |
| --- | --- | --- | --- | --- |
| FlashFind (ES source) · 2w | 0 | 0.0 | 0.0 | 2.4 |
| FlashFind (ES source) · 4w | 0 | 0.0 | 0.0 | 1.9 |
| FlashFind (ES source) · 8w | 0 | 0.0 | 0.0 | 5.3 |
| FlashFind (ES source) · 10w | 0 | 0.0 | 0.0 | 6.0 |
| FlashFind (ES source) · 16w | 0 | 0.0 | 0.0 | 10.6 |
| Fuse sync, rebuilt | 0 | 0.0 | 0.0 | - |
| Fuse sync, prebuilt | 0 | 0.0 | 0.0 | - |
| Naive filter | 0 | 0.0 | 0.0 | - |

### 50,000 records

| Candidate | Long tasks | TBT (ms) | Longest task (ms) | Timer lag p95 (ms) |
| --- | --- | --- | --- | --- |
| FlashFind (ES source) · 2w | 1 | 9.0 | 59.0 | 4.9 |
| FlashFind (ES source) · 4w | 0 | 0.0 | 0.0 | 6.9 |
| FlashFind (ES source) · 8w | 0 | 0.0 | 0.0 | 9.6 |
| FlashFind (ES source) · 10w | 0 | 0.0 | 0.0 | 9.5 |
| FlashFind (ES source) · 16w | 0 | 0.0 | 0.0 | 13.1 |
| Fuse sync, rebuilt | 0 | 0.0 | 0.0 | - |
| Fuse sync, prebuilt | 0 | 0.0 | 0.0 | - |
| Naive filter | 0 | 0.0 | 0.0 | - |

### 100,000 records

| Candidate | Long tasks | TBT (ms) | Longest task (ms) | Timer lag p95 (ms) |
| --- | --- | --- | --- | --- |
| FlashFind (ES source) · 2w | 1 | 21.0 | 71.0 | 1.2 |
| FlashFind (ES source) · 4w | 0 | 0.0 | 0.0 | 1.5 |
| FlashFind (ES source) · 8w | 0 | 0.0 | 0.0 | 1.7 |
| FlashFind (ES source) · 10w | 0 | 0.0 | 0.0 | 1.8 |
| FlashFind (ES source) · 16w | 0 | 0.0 | 0.0 | 1.8 |
| Fuse sync, rebuilt | 0 | 0.0 | 0.0 | - |
| Fuse sync, prebuilt | 0 | 0.0 | 0.0 | - |
| Naive filter | 0 | 0.0 | 0.0 | - |

## Typing simulation (dropped queries)

Keystrokes fire on a fixed interval without waiting for the previous search. `Dropped` counts searches that never produced a callback. `Staleness` is how many keystrokes behind the live input the results were when they landed.

| Records | Candidate | Scenario | Interval | Keys | Delivered | Dropped | Drop rate | Latency p50 | Max staleness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1,000 | FlashFind (ES source) · 2w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 12.5 | 0 |
| 1,000 | FlashFind (ES source) · 2w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 25.9 | 0 |
| 1,000 | FlashFind (ES source) · 4w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 18.3 | 0 |
| 1,000 | FlashFind (ES source) · 4w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 26.5 | 0 |
| 1,000 | FlashFind (ES source) · 8w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 21.8 | 0 |
| 1,000 | FlashFind (ES source) · 8w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 34.3 | 0 |
| 1,000 | FlashFind (ES source) · 10w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 23.0 | 0 |
| 1,000 | FlashFind (ES source) · 10w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 40.2 | 0 |
| 1,000 | FlashFind (ES source) · 16w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 29.0 | 0 |
| 1,000 | FlashFind (ES source) · 16w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 47.4 | 0 |
| 1,000 | Fuse sync, rebuilt | typing-fast | 80ms | 11 | 11 | 0 | 0% | 13.9 | 0 |
| 1,000 | Fuse sync, rebuilt | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 14.1 | 0 |
| 1,000 | Fuse sync, prebuilt | typing-fast | 80ms | 11 | 11 | 0 | 0% | 10.1 | 0 |
| 1,000 | Fuse sync, prebuilt | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 11.0 | 0 |
| 1,000 | Naive filter | typing-fast | 80ms | 11 | 11 | 0 | 0% | 0.7 | 0 |
| 1,000 | Naive filter | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 0.9 | 0 |
| 10,000 | FlashFind (ES source) · 2w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 35.6 | 0 |
| 10,000 | FlashFind (ES source) · 2w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 54.6 | 0 |
| 10,000 | FlashFind (ES source) · 4w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 33.0 | 0 |
| 10,000 | FlashFind (ES source) · 4w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 49.1 | 0 |
| 10,000 | FlashFind (ES source) · 8w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 35.9 | 0 |
| 10,000 | FlashFind (ES source) · 8w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 56.2 | 0 |
| 10,000 | FlashFind (ES source) · 10w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 40.1 | 0 |
| 10,000 | FlashFind (ES source) · 10w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 58.9 | 0 |
| 10,000 | FlashFind (ES source) · 16w | typing-fast | 80ms | 11 | 11 | 0 | 0% | 54.5 | 0 |
| 10,000 | FlashFind (ES source) · 16w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 66.0 | 0 |
| 10,000 | Fuse sync, rebuilt | typing-fast | 80ms | 11 | 11 | 0 | 0% | 50.7 | 0 |
| 10,000 | Fuse sync, rebuilt | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 67.1 | 0 |
| 10,000 | Fuse sync, prebuilt | typing-fast | 80ms | 11 | 11 | 0 | 0% | 42.2 | 0 |
| 10,000 | Fuse sync, prebuilt | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 57.3 | 0 |
| 10,000 | Naive filter | typing-fast | 80ms | 11 | 11 | 0 | 0% | 5.8 | 0 |
| 10,000 | Naive filter | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 6.3 | 0 |
| 50,000 | FlashFind (ES source) · 2w | typing-fast | 80ms | 11 | 6 | 5 | 45% | 111.0 | 1 |
| 50,000 | FlashFind (ES source) · 2w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 118.0 | 0 |
| 50,000 | FlashFind (ES source) · 4w | typing-fast | 80ms | 11 | 9 | 2 | 18% | 79.8 | 1 |
| 50,000 | FlashFind (ES source) · 4w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 91.0 | 0 |
| 50,000 | FlashFind (ES source) · 8w | typing-fast | 80ms | 11 | 7 | 4 | 36% | 98.7 | 1 |
| 50,000 | FlashFind (ES source) · 8w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 109.5 | 0 |
| 50,000 | FlashFind (ES source) · 10w | typing-fast | 80ms | 11 | 8 | 3 | 27% | 98.5 | 1 |
| 50,000 | FlashFind (ES source) · 10w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 103.8 | 0 |
| 50,000 | FlashFind (ES source) · 16w | typing-fast | 80ms | 11 | 6 | 5 | 45% | 108.2 | 1 |
| 50,000 | FlashFind (ES source) · 16w | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 114.9 | 0 |
| 50,000 | Fuse sync, rebuilt | typing-fast | 80ms | 11 | 11 | 0 | 0% | 207.1 | 0 |
| 50,000 | Fuse sync, rebuilt | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 217.1 | 0 |
| 50,000 | Fuse sync, prebuilt | typing-fast | 80ms | 11 | 11 | 0 | 0% | 167.7 | 0 |
| 50,000 | Fuse sync, prebuilt | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 176.0 | 0 |
| 50,000 | Naive filter | typing-fast | 80ms | 11 | 11 | 0 | 0% | 18.2 | 0 |
| 50,000 | Naive filter | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 18.9 | 0 |
| 100,000 | FlashFind (ES source) · 2w | typing-fast | 80ms | 11 | 4 | 7 | 64% | 271.0 | 2 |
| 100,000 | FlashFind (ES source) · 2w | typing-relaxed | 200ms | 11 | 8 | 3 | 27% | 228.1 | 1 |
| 100,000 | FlashFind (ES source) · 4w | typing-fast | 80ms | 11 | 4 | 7 | 64% | 227.5 | 2 |
| 100,000 | FlashFind (ES source) · 4w | typing-relaxed | 200ms | 11 | 7 | 4 | 36% | 242.6 | 1 |
| 100,000 | FlashFind (ES source) · 8w | typing-fast | 80ms | 11 | 4 | 7 | 64% | 226.7 | 2 |
| 100,000 | FlashFind (ES source) · 8w | typing-relaxed | 200ms | 11 | 10 | 1 | 9% | 188.7 | 1 |
| 100,000 | FlashFind (ES source) · 10w | typing-fast | 80ms | 11 | 4 | 7 | 64% | 235.9 | 2 |
| 100,000 | FlashFind (ES source) · 10w | typing-relaxed | 200ms | 11 | 9 | 2 | 18% | 195.2 | 1 |
| 100,000 | FlashFind (ES source) · 16w | typing-fast | 80ms | 11 | 3 | 8 | 73% | 301.2 | 3 |
| 100,000 | FlashFind (ES source) · 16w | typing-relaxed | 200ms | 11 | 7 | 4 | 36% | 283.0 | 1 |
| 100,000 | Fuse sync, rebuilt | typing-fast | 80ms | 11 | 11 | 0 | 0% | 406.7 | 0 |
| 100,000 | Fuse sync, rebuilt | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 421.3 | 0 |
| 100,000 | Fuse sync, prebuilt | typing-fast | 80ms | 11 | 11 | 0 | 0% | 332.7 | 0 |
| 100,000 | Fuse sync, prebuilt | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 338.9 | 0 |
| 100,000 | Naive filter | typing-fast | 80ms | 11 | 11 | 0 | 0% | 28.4 | 0 |
| 100,000 | Naive filter | typing-relaxed | 200ms | 11 | 11 | 0 | 0% | 30.3 | 0 |
