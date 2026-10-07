# Current Впарювання: exact buyer-group columns

This Console candidate extends the isolated manager-filter candidate. It requires the paired server capability `CounterpartyIdentity=NativeClientOrFenixSourceGroupV1`; the deployed numeric-counterparty response remains accepted when that capability is absent.

The first column dimension remains the three numeric groups (Остатки, Продажи, Контрагенты). The second dimension accepts exact text keys only in the negotiated version: `native-client:<positive native ID>` for a child, or `source-group:Fenix:<uppercase 32-hex reference>` for a captured parent. Null remains a separate unknown customer column. Equal captions do not combine different keys. The Console does not create a native ClientGroup or infer an owner from a caption.

The server preview has four column-axis levels: group, counterparty, measure group and measure. The table now shows one “Результат” label in its second header row. Stock and sales omit the absent counterparty label; the customer arm shows its caption or “Не вказано” before that label. Seven product attributes and sparse decimal/null cells still come from the same server preview as the files. The server owns XLSX and PDF values.

No Source, OWN SQL, API, browser, Docker or deployment call is made by this Console candidate. Historical stock, old XLS numeric parity and all-report readiness remain unverified. The candidate must be paired with the server implementation and tested on the actual response before deployment.

Verification: 33/33 focused preview cases, 3,701/3,701 reports/header cases across 188 files, scoped ESLint and TypeScript/Vite build passed. React Doctor scored the changed scope 92/100 with no findings; the whole-project baseline remains 89/100 with 12 existing findings. The stored actual numeric-axis preview was authenticated and its schema, key kinds and four-level shape matched this validator. The new text-axis response awaits the paired server's actual run.
