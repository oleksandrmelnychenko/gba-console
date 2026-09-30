# Dataset38 registrar warehouse in Console

The Dataset38 server now advertises groupings `73,78,4,21`: receipt storage,
sale registrar warehouse, organization and supplier. Console previously
required exactly `73,4,21`, which would hide the whole report after the server
update. It now accepts both dataset versions and maps the new wire value `78`
to `SourceRegistrarWarehouse`.

The existing receipt-storage preset remains the default. When the server
advertises value `78`, Console also offers **Валовий прибуток за складом
продажу 1С**. Selecting it changes only the first row grouping to `78` and
preserves the chosen period, source world and filters. Saved settings using
`78` are refused against a server that does not advertise it. The workbook
shortcut mentions the new preset only when the server capability is present.
Preview and exports use the same server pivot result.

Two focused test files passed 8/8, changed-file ESLint passed, and the
production TypeScript/Vite build passed. No DEV Console deployment or
authenticated preview was run. The server still refuses this variant where
current OUR SQL lacks complete registrar evidence; these changes do not
establish XLS parity.
