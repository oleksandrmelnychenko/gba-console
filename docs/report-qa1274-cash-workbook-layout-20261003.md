# QA1274 cash workbook row layout — FILE implementation

The original cash workbook requires Account / Kind / Organization (`40,44,43`). This additive layout uses the existing exact current account kinds (Bank=1, Cash=2) and keeps each published currency-register leg in the aggregation basis. Different account currencies still cannot be added. Missing publication, missing management currency and duplicate leg evidence remain unavailable; no price/FX arithmetic is introduced.

The detailed `43,40,42,41` layout remains the default and is still required for a saved scalar exact-account request. The Console exposes the workbook layout only with the server's exact two-layout capability.

Original attachment: `/var/lib/docker/volumes/gba-bug-host_qa-uploads/_data/1790174450683-0c094cb2-429a-4f26-89f3-15e94785c1e6.xls`, SHA256 `59dbf9eda0ce22269e43ce35edf83ed41caa0e06cdc895fa08dad28a3ab57492`.

Authored cases: 7 server and 6 Console. No build, test, browser, SQL, Source or deployment was executed by the author. Current workbook saved selections, authenticated preview and parsed export/subtotal acceptance remain pending Root execution.
