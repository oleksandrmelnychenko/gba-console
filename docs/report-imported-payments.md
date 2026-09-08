# Imported payment documents in the console

Source 14 (`NativeImportedPayments`) offers **Імпортовані платежі за валютами й рахунками**, with currency → direction → account rows and three selected own-currency document measures: recorded incoming (29), outgoing (30), and net (31). Dates are required and use the backend's supported 1900–9998 range. The console exposes only the server-published groupings, filters and ordering. Exact ClientAgreement IDs remain distinct even when their shared Agreement terms are identical. Both row and column axes are supported, with any nonempty distinct subset of the three measures.

The request and template boundaries reject unsupported TOP, threshold, ABC, hide-zero, valuation and comparison options before I/O. Saved dates, selected fields, filters and revision survive reload. An omitted measurement IsChecked flag keeps that measure active, matching the backend contract. Automatic translation of saved 1C variants remains disabled.

The workbook profile requires the recorded-document period, UTC observation interval, all six provenance explanations and the selected resource captions. Numeric money retains four decimal places in the table, CSV and chart formatting, including negative values and genuine zeros. Unknown money remains blank independently of descriptive metadata. The browser cannot recover the server's private currency/provenance basis from printed amounts, so all three columns preserve server totals and never infer local additivity. Local filtering removes stale totals; charts use leaf values with unknown gaps. Confirmed empty reports retain the selected headers and explicit state, with no leaf or monetary total row.

Display joins six logical explanations for wrapping, while CSV retains the original physical metadata lines. The title's current recorded state does not suppress the event period: this source is a report over current imported documents by their verified recorded dates.

Offline validation covers constructor defaults, all advertised row/column dimensions, exact native lookups, template revision/invalid imports, all selected masks, strict metadata, numeric precision, actual binary XLSX input, CSV filtering and three chart kinds. Actual backend writer files generated from an isolated SQL fixture are also checked against independently specified header amounts and currency proof. This validates the native document profile, not full parity with historical 1C cash-flow reports, bank settlement, transfer/FX documents, management-currency measures or source permissions.


### Currency scope in charts

Source14 charts require a declared `Валюта рахунку` axis. An exact native currency ID in that axis identifies the domain; the viewer does not infer it from an account name, a filter caption, an amount, or a blank grand total. With one known row currency the chart selects it automatically. With multiple row currencies the user must choose one before a numeric chart appears. Only the chosen currency's leaf rows are plotted, including signed four-decimal amounts and gaps for unknown money. Unknown currency rows remain in the table and are explicitly counted as excluded from the chart.

For pivot columns, the selected measurement column must have an unambiguous currency segment at the declared position. That column fixes the chart currency; choosing another column revalidates it. A missing or unknown currency axis, an ambiguous flattened column caption, or currency declared on both axes blocks numeric plotting and gives an actionable instruction. The current chart plots one selected value column; no other value column inherits its currency proof. Currency choice does not carry over to another sheet.

This restriction affects only source14 chart presentation. It performs no conversion, aggregation, report regeneration, or change to table rows, XLSX/CSV bytes, server values or requests. Source13 and earlier report chart behavior is unchanged.
