# Fenix planned cash flow and client report

This Console child starts from `f30a6f6249023a6e0cdd41b3b79d81f2f5b21d10`. The server contract is the exact cumulative `0a88c47c1e2d35e489e550aa0fb5cc8dd4198056` / `8ebedb75327f0aa69a4048e7daa860590b40a304` source. Both forms use the existing catalogue and generate permission. They make OUR report API requests; they do not invoke sync or open Source connections.

## Planned cash flow

The own catalogue entry is `builtin:ПланыДвиженияДенежныхСредств`, Fenix SourceId `5400433b-b9b6-4dc3-8699-86845c81588b`, definition `79900d4517da9c5c12d7c28890f31424e4527a0504a89cd73a337cdc4599cf6c`. Its capability request is `GET /report/originals/planned-cash-flow/capabilities?world=fenix`; preview is `POST /report/originals/planned-cash-flow/preview` without query parameters.

The screen starts with the server's four default measures and offers all six currency and management income, expense and net measures. Each displayed value comes from the server's exact signed decimal string. There is no absolute-value conversion, FX calculation, local aggregation or fabricated total. Known empty responses have no totals, as the actual contract specifies.

Scenario, project and department controls remain disabled. The capability declares `HumanChoicesAvailable=false`, and the server has no choices endpoint. The request sends all three required empty arrays. It does not reuse choices from the separate cash-plan forms or accept pasted technical references. Article captions come only from the result; a missing caption displays “Назва недоступна” while its distinct row and amounts are retained.

The article caption follows the server's own lossless catalogue-description rule: at most 100 UTF16 units, valid surrogate pairs and not entirely whitespace. Padding, numeric or GUID-like text in a genuine retained description is preserved. It is never substituted from `ArticleReference`. This rule is distinct from fb9's human-name policy.

`Implemented=true` is code capability. It does not establish current data readiness. The form waits for the period-specific preview's complete input and owned OUR Snapshot evidence. Missing branch11 months, planning headers, department observations and unresolved empty planning documents stay unavailable with no partial table or export.

## Client report

The own catalogue entry is `builtin:ОтчетПоКлиентам`, Fenix SourceId `fb9a5d53-8a42-4d2d-ab19-a58603d36bd9`, definition `fd23adf25d791b4f155460692a76bf0c1fe08cc2370a9d56d17d91158027cd40`. Its routes are `GET /report/original-client-report/capabilities` and `POST /report/original-client-report/preview`, both without query parameters.

The screen preserves the organization → counterparty → agreement hierarchy and all ten default server values. Quantities retain three decimals; the other resources retain two decimals. Stored default prices are displayed as returned. There is no local allocation or optional product/report-unit layout. Independent totals and subtotals are displayed from the server, not reconstructed from paginated rows.

The first unfiltered preview returns the complete unfiltered `Choices` dictionaries in the same Snapshot. Only fields whose entire choices list has available human captions become selectable. Other fully named fields stay usable. `NULL` is a counterparty value only and uses the server's genuine “Не задано” caption. Missing names never become GUID labels or a selectable partial list.

Canonical all-zero32 references remain legitimate organization, counterparty and agreement keys, as the server's `OriginalSalesContract.Ref` specifies. Their captions are not invented; unknown zero-key names remain unavailable like other missing names.

The current choices carry the result's input witness locally and belong to one caller, permission state and explicit date range. Selection requests contain only the three contract arrays (`Organizations`, `Counterparties`, `Agreements`); the server rejects unknown properties, so no invented choices-witness request field is added. Every response must echo the exact period and selected arrays. Its row names and keys must belong to the full unfiltered dictionaries. After a new complete result rotates the witness/choice universe, selected keys must still be named in the new universe. Otherwise generation stops until the user resets the selection. Date, caller or permission changes remove rows and choices immediately and abort the original request.

When a previously selected key leaves the fresh universe, its old human caption may remain on the selected pill solely for clearing. That retained caption cannot authorize a new selection or generation; the old key is disabled as an option and the current full-universe check still refuses. This prevents a stale selector from displaying a technical reference.

Legacy branch0 journals with null source context remain unavailable. Full nine-symbol purchase status coverage and all four ordinary input families are server prerequisites. Schema1293 and fresh ordinary resync are not claimed by this Console.

## Shared output and limits

Tables render at most fifty rows at once and preserve all admitted rows for export. CSV, XLSX and PDF use the same complete result; files above one million cells refuse rather than truncate. CSV escapes label formulas while preserving signed resource strings. Unknown names remain separate rows. Asynchronous requests and exports discard late results after form invalidation or unmount.

Neither form claims native parity, native date/zero semantics, full task acceptance or current source coverage. No availability flag is flipped to hide missing data. Authored regression tests cover the exact API wire, unavailable/known-empty states, signed cells, human names, selected echo, stale owners and export limits. Tests, lint, build, Doctor, browser and export runtime are unrun here; Root owns those gates.
