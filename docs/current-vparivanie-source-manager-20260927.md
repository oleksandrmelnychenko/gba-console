# Current Vparivanie: source buyer-manager filter

This candidate is isolated from Console3981 and its already frozen artifacts. It requires the paired server manager capability; it does not activate a source read, sync, migration or deployment.

## Declared behavior

- Dataset39 retains Product5 rows, Group74/Counterparty75 dynamic columns, sole Result83 and seven product display attributes.
- Manager60 is the exact current buyer-manager reference from Fenix. It affects only the customer arm before parent selection. It does not filter total sales or current stock and is not Sale.UserID, the current user, warehouse ownership or access policy.
- A selectable manager field appears only when the valid server capability has ManagerFilterSupported=true AND field60 Selectable=true. False capability still hides the picker and explicitly refuses a saved selected-manager variant.
- Request: one Equals0 selection; one Data.Id string encoding16bytes as32hex, Value0. ASCII hexcase is accepted in saved syntax, normalized to uppercase on the cloned outbound request; caller data is unchanged. Numeric IDs, GUID punctuation/prefixes, zero refs, invalid lengths/hex, duplicate identity aliases and alternate conditions are rejected.
- Lookup route remains /report/datasets/lookup with dataSource39/field60 and cancellation. Uppercase exact IDs and full server labels are retained; duplicate refs are refused. Equal labels with distinct refs stay distinct. No native User catalogue or Number conversion is used.
- Current server name/fallback plus full source-reference disambiguator is displayed in the existing picker. Unknown/unobserved or contradictory buyer-manager bindings return the server instruction to update client sync; they are not silently excluded. Known unassigned manager refs are a different condition handled by the server.
- Without a supplied dataset, API/template validation checks only syntax; actual server remains final authority. With current dataset, capability is mandatory. No support flag is added to the request wire.

## Files and verification

The candidate changes only current-matrix capability/request validation, dataset field availability, dedicated lookup/request serialization and conditional form notice, plus their tests. Preview/export computations and fixed axes are unchanged; one server result remains common to screen/XLSX/PDF. Existing general request/page cancellation and permissions remain in force.

Focused validation:67/67 passed across5 files (26 new manager cases plus adjacent41), including actual page picker and exact source-reference transport. Scoped ESLint passed. ReactDoctor changed-scope93/100 with no findings; this is not a whole-project score. Full reports/header-actions:3,685/3,685 passed across187 files. Final TypeScript/Vite build passed. The new API test fixture was corrected to pass the complete duplicate-ref pool; its final7/7 cases were rerun successfully. Production bytes did not change during the full gate. Existing Vite large-chunk warning remains.

Source/OWN SQL/API/browser/Docker calls by this candidate author:0. Backend f51aaf96 is a separate paired candidate pending Root's actual SQL/migration/release review. No all-reports Ready, source ACL, historical XLS numeric parity or authoritative native User mapping is claimed.
