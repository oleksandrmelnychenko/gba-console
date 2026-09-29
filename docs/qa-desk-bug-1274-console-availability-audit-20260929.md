# BUG-1274 Console availability audit, 2026-09-29

This audit compares Console commit `b6c1ca61` with the server's tracked
`Catalogue.json` in the report release worktree. It made no 1C, SQL, API, or
deployment call. The six old XLS files specify form and logic for current GBA
data; their printed historical amounts are not an acceptance target.

| XLS form | Current Console route | Limit |
| --- | --- | --- |
| `ВП по постачальниках.xls` | Fenix native Dataset 38 through its partial catalogue source. | AMG catalogue source remains `captured`; dataset presence does not grant a source launch. Full warehouse and period parity remain open. |
| `ВП.xls` | Fenix native Dataset 35 through its partial catalogue source; a separate legacy 1C turnover panel is also listed. | Signed complete days only; the full XLS period and both worlds remain open. |
| `Ведомость по денежным средствам.xls` | New independent GBA shortcut to native Dataset 40, one Fenix account in its own currency. | The 1C catalogue source still advertises Dataset 11, a **current balance** without opening or movements. Four management-currency XLS columns and general coverage remain open. |
| `Взаємороз всі.xls` | New independent GBA shortcut to native Dataset 41, one exact agreement in settlement currency. | The 1C catalogue source still advertises Dataset 10, **current debt** without opening or movements. The grouped all-counterparties form remains open. |
| `Впарювання.xls` | Fenix partial catalogue source advertises native Datasets 39 and 36. | The complete 35-product form and native result formula remain open. |
| `ДБіторка.xls` | No grouped period route or shortcut. | A single-agreement Dataset 41 result cannot stand in for the grouped debtor workbook. |

The source catalogue's `NativeDataSources` and its validation evidence are not
altered. In particular, the Dataset 10/11 proof is not reused for 41/40. The
two new shortcuts require one unique, structurally valid live dataset
capability and report-generation permission. They select a fresh native form;
the exact account or agreement remains unselected, a completed Kyiv day is the
default, and the server refuses incomplete period publications. Existing 10/11
datasets remain in the normal dataset picker and in their other partial
catalogue mappings. Their two potentially confusing workbook names now show
`Поточний стан` and explain the missing period measures.

The Fenix custom constructors `Типы цен покупателей`, `Отношение дебиторской
задолженности к объему продаж`, and `Коэффициент инкассации дебиторской
задолженности текущего периода` are `captured` with no native datasets in the
tracked catalogue. The Console registry has no launch for them; this audit
does not promote the bounded checkpoint kernels into report eligibility.

Verification in the isolated Console worktree: four focused test files,
70 tests passed; the affected report suite passed 3,666 tests with one
fixture-dependent integration test skipped; production build passed.
React Doctor's changed-file scan scored 93/100 with one pre-existing
`ReportsStocksPage` complexity warning.
