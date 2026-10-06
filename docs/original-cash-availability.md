# Original cash availability Console

The dedicated Fenix catalogue launch belongs to captured original `0742f621-fa58-46bb-9819-e4bc51a03f14`. It reads the capability and preview at `/report/originals/cash-availability`; the server reads OUR data. Existing report generation permission and caller authentication apply. AMG does not borrow the Fenix implementation.

## Request and display

- `DateKon` is an exact native local whole second, `yyyy-MM-ddTHH:mm:ss`. A datetime-local minute value receives literal zero seconds; no UTC conversion, next-day endpoint or calendar range is applied.
- Organization, account/cash kind, typed bank account/cash and currency filters use complete returned typed choices. Account type `08` and reference tables `0000000F` / `00000038` remain distinct, even for the same reference. No caption-to-reference inference occurs.
- Native defaults have no row dimensions and five own-currency measures: current, writeoff, receipts, reserve, free. Optional intrinsic row dimensions and five management measures are explicit selections.
- Server rationals are validated with bigint arithmetic, final half-away rounding and current minus writeoff plus receipts minus reserve. Javascript floating-point conversion is not used for money. Actual management currency is retained. Missing FX does not block complete own-only amounts.
- The completed server table supplies display and export. Unknown cells display “Недоступно”; missing captions remain explicit. Partial results retain known amounts and disable complete exports. Nothing invents a row or zero from absent inputs.
- Only 50 rows are rendered per page. Whole completed table is supplied to existing CSV/XLSX/PDF exporters and their existing whole-file size guard; no first-N export is produced. Export metadata states the exact point, rather than an inclusive period.
- Date, filter, dimensions, management selection, caller and permission changes clear old results. Owned fetches abort and late responses cannot restore previous caller/date scopes. Pending export cannot download after its output unmounts.

## Shared changes

`OriginalDefaultSheet.scopeLabel` and `OriginalDefaultReportOutput.allowExport` are optional; other report defaults remain unchanged. The existing output shell now settles its mounted-state guard in a layout effect so caller/permission scope removal cancels deferred downloads synchronously. The catalogue panel adds the dedicated lazy launch. Existing generic report registration is unchanged.

## Verification status

Cases are authored but unrun. No Node, SDK, browser, SQL, Source, Docker, profile read or deployment was performed by the author. Root owns test/lint/Doctor/TSC/Vite and authenticated browser/export validation. Server donor `84800ac99a386f94e182502de0332f1fa085bc01` is the DTO baseline; actual Console and native parity/export acceptance remain pending.
