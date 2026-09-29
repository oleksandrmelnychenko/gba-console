# BUG-1274: current-data Vparivanie Console

## Contract

This candidate adds source 39, `NativeCurrentVparivanie`, alongside the existing source 36 certified pilot. It uses one server-calculated `Результат` (83), Product rows (5), and fixed columns CurrentVparivanieGroup (74) → CurrentVparivanieCounterparty (75). Product attributes are presentation columns, not additional identity dimensions.

The server must advertise the exact `currentVparivanie` version-1 capability before the dataset is offered. The exact catalogue identity for `ОтчетВпаривание` may advertise `[39,36]`; a title alone does not authorize catalogue launch.

The report requires an inclusive Kyiv sales period, 2000–7998, at most 366 days, and up to 128 exact products or one exact product group with InGroup. Optional Customer Equals applies only to the customer arm. Up to 32 exact Warehouse selections apply only to current stock. Buyer-manager filtering is unavailable; the Console rejects selected field 60 and does not substitute Sale.UserID. Sorting, TOP, Boolean filter trees, ABC and unrelated saved special options are refused before HTTP.

## Shared result and display

The screen uses `/report/stocks/preview` once. Its numeric/null cells and XLSX/PDF links belong to the same calculation; the Console performs no stock or sale arithmetic. Exact bigint keys remain strings in dataset lookup and selection Data. The seven product attributes must address exactly the visible Product row set and carry the same ResultSha256 as the preview. Duplicate captions remain separate columns because SourceIndex identifies columns.

Seven flat columns are Артикул, Наименование, Описание, Группа, OE, Размер, Топ. Null attributes remain unknown and empty strings remain empty. Server NULL cells, absent cells, real zero, negative values and raw decimal strings remain distinct on screen. HTML is rendered as text.

The downloaded workbook retains semantic `Рядки: Товар` and declares `Колонки товару: Артикул, Наименование, Описание, Группа, OE, Размер, Топ` before its separator. That explicit source-39 declaration changes only the display width used by the file reader. Empty attributes and quantities never carry from another product. Browser totals and file date filtering are disabled for this matrix. Own CSV round-trip preserves digit-only text and quoted multiline descriptions, with quantities formatted to eight decimal places.

## Meaning and limits

Stock is current recorded free ProductAvailability quantity. The selected sale period does not create a historical stock balance at its end. The Console shows this distinction and the server's observation timestamps, filters and notes directly. Unknown quantities and mixed-unit totals remain NULL. Current data acceptance does not imply original 2019/2020 XLS numeric parity, historical opening/closing, source register equivalence, manager support, or complete report readiness.

## Verification

Focused synthetic checks cover bounded request admission, exact IDs and hierarchy conditions, current capability refusal, saved templates and draft axes, real page form/lookup behavior, raw preview cells and seven attributes, and downloaded workbook/CSV structure. Accepted offline gates: 67/67 focused tests, all 3,659 existing/new reports and header-actions tests across 185 files, TypeScript + Vite build, and scoped ESLint. The final CSV escape-only lint correction passed its 9-case gate. React Doctor remains 89/100 with the same 12 warning count as the baseline. The two-tier matrix header uses normal flow to avoid overlapping sticky tiers. Exact logs and final build artifacts are retained in the private candidate packet.

No browser, API, Source/OWN SQL, Docker, sync or deployment is invoked by this implementation task. Root performs the actual ordinary screen/XLSX/PDF and OWN numeric checks only after the backend contract is compiled and accepted.
